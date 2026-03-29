'use server';

import { createHash, randomBytes } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import {
  getWorkflowProgressPercent,
  getWorkflowStage,
  ONBOARDING_STEP_BLUEPRINTS,
  type OnboardingStepKey,
  type OnboardingStepRecord,
  type OnboardingStepStatus,
  type ShareLinkStatus,
} from '@/lib/onboarding';
import { logProjectTransparencyEvent } from '@/lib/project-transparency';
import { auditLog, requirePermission, resolveActiveOrgId } from '@/lib/rbac';
import type { Permission } from '@/lib/rbac-types';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { createClient } from '@/utils/supabase/server';
import { enqueue, TOPICS } from '@/lib/queue';
import {
  getContractAdapter,
  type ContractProvider,
} from '@/lib/onboarding-providers/contracts';
import {
  getEmailAdapter,
  type EmailProvider,
} from '@/lib/onboarding-providers/email';
import {
  getSchedulingAdapter,
  type SchedulingProvider,
} from '@/lib/onboarding-providers/scheduling';

export type OnboardingClientProfile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  notes: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_at: string;
};

export type OnboardingProjectOption = {
  id: string;
  name: string;
  published: boolean;
};

export type OnboardingStepSummary = {
  id: string;
  step_key: OnboardingStepKey;
  title: string;
  description: string;
  status: OnboardingStepStatus;
  sort_order: number;
  completed_at: string | null;
};

export type OnboardingShareLinkSummary = {
  id: string;
  status: ShareLinkStatus;
  expires_at: string | null;
  created_at: string;
};

export type OnboardingAssignmentSummary = {
  id: string;
  client: OnboardingClientProfile;
  project: OnboardingProjectOption;
  status: string;
  assigned_at: string;
  workflowId: string | null;
  stage: string;
  progressPercent: number;
  steps: OnboardingStepSummary[];
  shareLink: OnboardingShareLinkSummary | null;
  inventoryCount: number;
  availableCount: number;
  soldCount: number;
};

export type OnboardingDashboardData = {
  orgId: string;
  orgName: string;
  clients: OnboardingClientProfile[];
  projects: OnboardingProjectOption[];
  assignments: OnboardingAssignmentSummary[];
};

export type ActionResult = {
  success?: true;
  error?: string;
  data?: {
    shareUrl?: string;
    expiresAt?: string | null;
  };
};

type WorkflowRow = {
  id: string;
  stage: string;
  progress_percent: number;
  project_share_status: ShareLinkStatus | 'pending';
};

type StepRow = {
  id: string;
  org_id: string;
  workflow_id: string;
  step_key: OnboardingStepKey;
  title: string;
  description: string;
  status: OnboardingStepStatus;
  sort_order: number;
  completed_at: string | null;
};

async function getActionContext(permission: Permission): Promise<
  | { error: string }
  | { userId: string; orgId: string }
> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in to manage onboarding.' };
  }

  const orgId = await resolveActiveOrgId(user.id);
  if (!orgId) {
    return { error: 'Select an organization before managing onboarding.' };
  }

  const check = await requirePermission(orgId, user.id, permission);
  if (!check.granted) {
    return { error: check.error };
  }

  return { userId: user.id, orgId };
}

async function refreshWorkflowState(
  workflowId: string,
  overrides?: Partial<{
    contractStatus: string;
    walkthroughStatus: string;
    welcomeStatus: string;
    projectShareStatus: string;
  }>,
): Promise<void> {
  const { data: stepRows, error: stepError } = await supabase
    .from('onboarding_steps')
    .select('step_key, status')
    .eq('workflow_id', workflowId)
    .order('sort_order', { ascending: true });

  if (stepError || !stepRows) {
    if (stepError) {
      console.error('Failed to refresh onboarding workflow state:', stepError);
    }
    return;
  }

  const steps = stepRows as OnboardingStepRecord[];
  const progressPercent = getWorkflowProgressPercent(steps);
  const stage = getWorkflowStage(steps);

  const updatePayload: Record<string, unknown> = {
    progress_percent: progressPercent,
    stage,
    updated_at: new Date().toISOString(),
  };

  if (overrides?.contractStatus) {
    updatePayload.contract_status = overrides.contractStatus;
  }
  if (overrides?.walkthroughStatus) {
    updatePayload.walkthrough_status = overrides.walkthroughStatus;
  }
  if (overrides?.welcomeStatus) {
    updatePayload.welcome_status = overrides.welcomeStatus;
  }
  if (overrides?.projectShareStatus) {
    updatePayload.project_share_status = overrides.projectShareStatus;
  }

  const { error: workflowError } = await supabase
    .from('onboarding_workflows')
    .update(updatePayload)
    .eq('id', workflowId);

  if (workflowError) {
    console.error('Failed to update onboarding workflow:', workflowError);
  }
}

function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function getOnboardingDashboard(
  userId: string,
  orgId: string | null,
): Promise<{ data?: OnboardingDashboardData; error?: string }> {
  try {
    if (!orgId) {
      return { error: 'No active organization selected.' };
    }

    const permissionCheck = await requirePermission(orgId, userId, 'onboarding:view');
    if (!permissionCheck.granted) {
      return { error: permissionCheck.error };
    }

    const [{ data: org }, { data: clients }, { data: projects }, { data: assignments, error: assignmentError }] =
      await Promise.all([
        supabase.from('organizations').select('name').eq('id', orgId).single(),
        supabase
          .from('client_profiles')
          .select('*')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false }),
        supabase
          .from('projects')
          .select('id, name, published')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false }),
        supabase
          .from('client_project_assignments')
          .select('id, client_profile_id, project_id, status, assigned_at')
          .eq('org_id', orgId)
          .order('assigned_at', { ascending: false }),
      ]);

    if (assignmentError) {
      console.error('Supabase error:', assignmentError);
      return { error: 'Failed to load onboarding assignments.' };
    }

    const clientList = (clients ?? []) as OnboardingClientProfile[];
    const projectList = (projects ?? []) as OnboardingProjectOption[];
    const assignmentRows = (assignments ?? []) as Array<{
      id: string;
      client_profile_id: string;
      project_id: string;
      status: string;
      assigned_at: string;
    }>;

    if (assignmentRows.length === 0) {
      return {
        data: {
          orgId,
          orgName: (org?.name as string | undefined) ?? 'Organization',
          clients: clientList,
          projects: projectList,
          assignments: [],
        },
      };
    }

    const assignmentIds = assignmentRows.map((assignment) => assignment.id);
    const projectIds = [...new Set(assignmentRows.map((assignment) => assignment.project_id))];

    const [workflowRes, stepRes, shareRes, inventoryRes] = await Promise.all([
      supabase
        .from('onboarding_workflows')
        .select('id, assignment_id, stage, progress_percent, project_share_status')
        .in('assignment_id', assignmentIds),
      supabase
        .from('onboarding_steps')
        .select('id, workflow_id, step_key, title, description, status, sort_order, completed_at')
        .eq('org_id', orgId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('project_share_links')
        .select('id, assignment_id, status, expires_at, created_at')
        .in('assignment_id', assignmentIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('inventory_items')
        .select('project_id, status')
        .in('project_id', projectIds),
    ]);

    if (workflowRes.error || stepRes.error || shareRes.error || inventoryRes.error) {
      console.error('Supabase error:', workflowRes.error ?? stepRes.error ?? shareRes.error ?? inventoryRes.error);
      return { error: 'Failed to load onboarding details.' };
    }

    const clientsById = new Map(clientList.map((client) => [client.id, client]));
    const projectsById = new Map(projectList.map((project) => [project.id, project]));
    const workflowsByAssignmentId = new Map(
      ((workflowRes.data ?? []) as Array<WorkflowRow & { assignment_id: string }>).map((workflow) => [
        workflow.assignment_id,
        workflow,
      ]),
    );

    const stepsByWorkflowId = new Map<string, OnboardingStepSummary[]>();
    for (const step of (stepRes.data ?? []) as Array<StepRow>) {
      const existingSteps = stepsByWorkflowId.get(step.workflow_id) ?? [];
      existingSteps.push({
        id: step.id,
        step_key: step.step_key,
        title: step.title,
        description: step.description,
        status: step.status,
        sort_order: step.sort_order,
        completed_at: step.completed_at,
      });
      stepsByWorkflowId.set(step.workflow_id, existingSteps);
    }

    const shareLinksByAssignmentId = new Map<string, OnboardingShareLinkSummary>();
    for (const link of (shareRes.data ?? []) as Array<OnboardingShareLinkSummary & { assignment_id: string }>) {
      if (!shareLinksByAssignmentId.has(link.assignment_id)) {
        shareLinksByAssignmentId.set(link.assignment_id, {
          id: link.id,
          status: link.status,
          expires_at: link.expires_at,
          created_at: link.created_at,
        });
      }
    }

    const inventoryStatsByProjectId = new Map<string, { total: number; available: number; sold: number }>();
    for (const item of (inventoryRes.data ?? []) as Array<{ project_id: string; status: string }>) {
      const existingStats = inventoryStatsByProjectId.get(item.project_id) ?? {
        total: 0,
        available: 0,
        sold: 0,
      };

      existingStats.total += 1;
      if (item.status === 'available') {
        existingStats.available += 1;
      }
      if (item.status === 'sold') {
        existingStats.sold += 1;
      }

      inventoryStatsByProjectId.set(item.project_id, existingStats);
    }

    const assignmentSummaries = assignmentRows
      .map((assignment): OnboardingAssignmentSummary | null => {
        const client = clientsById.get(assignment.client_profile_id);
        const project = projectsById.get(assignment.project_id);

        if (!client || !project) {
          return null;
        }

        const workflow = workflowsByAssignmentId.get(assignment.id);
        const steps = workflow ? stepsByWorkflowId.get(workflow.id) ?? [] : [];
        const inventoryStats = inventoryStatsByProjectId.get(project.id) ?? {
          total: 0,
          available: 0,
          sold: 0,
        };

        return {
          id: assignment.id,
          client,
          project,
          status: assignment.status,
          assigned_at: assignment.assigned_at,
          workflowId: workflow?.id ?? null,
          stage: workflow?.stage ?? 'invited',
          progressPercent: workflow?.progress_percent ?? 0,
          steps,
          shareLink: shareLinksByAssignmentId.get(assignment.id) ?? null,
          inventoryCount: inventoryStats.total,
          availableCount: inventoryStats.available,
          soldCount: inventoryStats.sold,
        };
      })
      .filter((assignment): assignment is OnboardingAssignmentSummary => assignment !== null);

    return {
      data: {
        orgId,
        orgName: (org?.name as string | undefined) ?? 'Organization',
        clients: clientList,
        projects: projectList,
        assignments: assignmentSummaries,
      },
    };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function createClientProfile(formData: FormData): Promise<ActionResult> {
  const context = await getActionContext('onboarding:create');
  if ('error' in context) {
    return { error: context.error };
  }

  const fullName = (formData.get('full_name') as string | null)?.trim() ?? '';
  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? '';
  const phone = (formData.get('phone') as string | null)?.trim() ?? '';
  const notes = (formData.get('notes') as string | null)?.trim() ?? '';
  const addressLine1 = (formData.get('address_line1') as string | null)?.trim() ?? '';
  const addressLine2 = (formData.get('address_line2') as string | null)?.trim() ?? '';
  const city = (formData.get('city') as string | null)?.trim() ?? '';
  const state = (formData.get('state') as string | null)?.trim() ?? '';
  const zipCode = (formData.get('zip_code') as string | null)?.trim() ?? '';

  if (!fullName) {
    return { error: 'Client name is required.' };
  }
  if (!email) {
    return { error: 'Client email is required.' };
  }

  try {
    const insertPayload: Record<string, unknown> = {
      org_id: context.orgId,
      full_name: fullName,
      email,
      phone: phone || null,
      notes,
      created_by: context.userId,
    };
    // Only include address fields when provided (columns may not exist yet)
    if (addressLine1) insertPayload.address_line1 = addressLine1;
    if (addressLine2) insertPayload.address_line2 = addressLine2;
    if (city) insertPayload.city = city;
    if (state) insertPayload.state = state;
    if (zipCode) insertPayload.zip_code = zipCode;

    const { error } = await supabase.from('client_profiles').insert(insertPayload);

    if (error) {
      console.error('Supabase error:', error);
      if (error.code === '23505') {
        return { error: 'A client with that email already exists in this organization.' };
      }
      return { error: 'Failed to create client.' };
    }

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'onboarding.client_created',
      targetType: 'client_profile',
      metadata: { email, fullName },
    });

    revalidatePath('/onboarding');
    revalidatePath('/clients');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

/**
 * Delete a client profile and all associated data.
 * Cascading FKs will remove: assignments, workflows, steps, contracts,
 * walkthroughs, welcome messages, and share links.
 */
export async function deleteClientProfile(clientId: string): Promise<ActionResult> {
  const context = await getActionContext('onboarding:delete');
  if ('error' in context) {
    return { error: context.error };
  }

  if (!clientId) {
    return { error: 'Client ID is required.' };
  }

  try {
    // Verify client exists and belongs to this org
    const { data: client, error: fetchError } = await supabase
      .from('client_profiles')
      .select('id, full_name, email, org_id')
      .eq('id', clientId)
      .eq('org_id', context.orgId)
      .single();

    if (fetchError || !client) {
      return { error: 'Client not found.' };
    }

    // Delete — cascading FKs handle all child rows
    const { error: deleteError } = await supabase
      .from('client_profiles')
      .delete()
      .eq('id', clientId)
      .eq('org_id', context.orgId);

    if (deleteError) {
      console.error('Supabase error:', deleteError);
      return { error: 'Failed to delete client.' };
    }

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'onboarding.client_deleted',
      targetType: 'client_profile',
      targetId: clientId,
      metadata: { email: client.email, fullName: client.full_name },
    });

    revalidatePath('/clients');
    revalidatePath('/onboarding');
    revalidatePath('/contracts');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function updateClientProfile(clientId: string, formData: FormData): Promise<ActionResult> {
  const context = await getActionContext('onboarding:update');
  if ('error' in context) {
    return { error: context.error };
  }

  if (!clientId) {
    return { error: 'Missing client ID.' };
  }

  const fullName = (formData.get('full_name') as string | null)?.trim() ?? '';
  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? '';
  const phone = (formData.get('phone') as string | null)?.trim() ?? '';
  const notes = (formData.get('notes') as string | null)?.trim() ?? '';
  const addressLine1 = (formData.get('address_line1') as string | null)?.trim() ?? '';
  const addressLine2 = (formData.get('address_line2') as string | null)?.trim() ?? '';
  const city = (formData.get('city') as string | null)?.trim() ?? '';
  const state = (formData.get('state') as string | null)?.trim() ?? '';
  const zipCode = (formData.get('zip_code') as string | null)?.trim() ?? '';

  if (!fullName) {
    return { error: 'Client name is required.' };
  }
  if (!email) {
    return { error: 'Client email is required.' };
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('client_profiles')
      .select('id')
      .eq('id', clientId)
      .eq('org_id', context.orgId)
      .single();

    if (fetchError || !existing) {
      return { error: 'Client not found.' };
    }

    const updatePayload: Record<string, unknown> = {
      full_name: fullName,
      email,
      phone: phone || null,
      notes,
      updated_at: new Date().toISOString(),
    };
    // Only include address fields when provided (columns may not exist yet)
    if (addressLine1) updatePayload.address_line1 = addressLine1;
    if (addressLine2) updatePayload.address_line2 = addressLine2;
    if (city) updatePayload.city = city;
    if (state) updatePayload.state = state;
    if (zipCode) updatePayload.zip_code = zipCode;

    const { error } = await supabase
      .from('client_profiles')
      .update(updatePayload)
      .eq('id', clientId)
      .eq('org_id', context.orgId);

    if (error) {
      console.error('Supabase error:', error);
      if (error.code === '23505') {
        return { error: 'Another client with that email already exists.' };
      }
      return { error: 'Failed to update client.' };
    }

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'onboarding.client_updated',
      targetType: 'client_profile',
      targetId: clientId,
      metadata: { email, fullName },
    });

    revalidatePath('/onboarding');
    revalidatePath('/clients');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function assignClientToProject(formData: FormData): Promise<ActionResult> {
  const context = await getActionContext('onboarding:create');
  if ('error' in context) {
    return { error: context.error };
  }

  const clientProfileId = (formData.get('client_profile_id') as string | null)?.trim() ?? '';
  const projectId = (formData.get('project_id') as string | null)?.trim() ?? '';

  if (!clientProfileId || !projectId) {
    return { error: 'Select both a client and a project.' };
  }

  try {
    const [{ data: client, error: clientError }, { data: project, error: projectError }] = await Promise.all([
      supabase
        .from('client_profiles')
        .select('id, full_name, org_id')
        .eq('id', clientProfileId)
        .eq('org_id', context.orgId)
        .single(),
      supabase
        .from('projects')
        .select('id, name, org_id')
        .eq('id', projectId)
        .eq('org_id', context.orgId)
        .single(),
    ]);

    if (clientError || !client) {
      return { error: 'Client not found for the active organization.' };
    }
    if (projectError || !project) {
      return { error: 'Project not found for the active organization.' };
    }

    // Clean up any archived rows for this org+project so re-linking works
    await supabase
      .from('client_project_assignments')
      .delete()
      .eq('org_id', context.orgId)
      .eq('project_id', projectId)
      .eq('status', 'archived');

    const { data: assignment, error: assignmentError } = await supabase
      .from('client_project_assignments')
      .insert({
        org_id: context.orgId,
        client_profile_id: clientProfileId,
        project_id: projectId,
        assigned_by: context.userId,
      })
      .select('id')
      .single();

    if (assignmentError || !assignment) {
      console.error('Supabase error:', assignmentError);
      if (assignmentError?.code === '23505') {
        return { error: 'This project is already assigned to a client. Each project can only have one client.' };
      }
      return { error: 'Failed to assign client to project.' };
    }

    const { data: workflow, error: workflowError } = await supabase
      .from('onboarding_workflows')
      .insert({
        org_id: context.orgId,
        assignment_id: assignment.id,
      })
      .select('id')
      .single();

    if (workflowError || !workflow) {
      console.error('Supabase error:', workflowError);
      return { error: 'Failed to initialize onboarding workflow.' };
    }

    const stepRows = ONBOARDING_STEP_BLUEPRINTS.map((step, index) => ({
      org_id: context.orgId,
      workflow_id: workflow.id,
      step_key: step.key,
      title: step.title,
      description: step.description,
      sort_order: index,
    }));

    const { error: stepsError } = await supabase.from('onboarding_steps').insert(stepRows);
    if (stepsError) {
      console.error('Supabase error:', stepsError);
      return { error: 'Failed to initialize onboarding steps.' };
    }

    await logProjectTransparencyEvent({
      orgId: context.orgId,
      projectId,
      assignmentId: assignment.id,
      actorId: context.userId,
      eventType: 'client_assigned',
      title: `Client assigned to ${project.name}`,
      body: `${client.full_name} is now linked to the project onboarding workflow.`,
      payload: {
        client_profile_id: clientProfileId,
      },
    });

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'onboarding.project_assigned',
      targetType: 'client_project_assignment',
      targetId: assignment.id,
      metadata: { clientProfileId, projectId },
    });

    revalidatePath('/onboarding');
    revalidatePath('/clients');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

/**
 * Archive (soft-remove) a client-project assignment.
 * Preserves all workflow/contract/history data — the row is set to 'archived'.
 */
export async function removeClientAssignment(assignmentId: string): Promise<ActionResult> {
  const context = await getActionContext('onboarding:create');
  if ('error' in context) {
    return { error: context.error };
  }

  if (!assignmentId) {
    return { error: 'Missing assignment.' };
  }

  try {
    const { data: assignment, error: fetchError } = await supabase
      .from('client_project_assignments')
      .select('id, org_id, project_id, client_profile_id, status')
      .eq('id', assignmentId)
      .eq('org_id', context.orgId)
      .single();

    if (fetchError || !assignment) {
      return { error: 'Assignment not found.' };
    }

    if (assignment.status === 'archived') {
      return { error: 'This assignment is already archived.' };
    }

    const { error: updateError } = await supabase
      .from('client_project_assignments')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', assignmentId)
      .eq('org_id', context.orgId);

    if (updateError) {
      console.error('Supabase error:', updateError);
      return { error: 'Failed to remove assignment.' };
    }

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'onboarding.assignment_archived',
      targetType: 'client_project_assignment',
      targetId: assignmentId,
      metadata: { projectId: assignment.project_id, clientProfileId: assignment.client_profile_id },
    });

    revalidatePath('/onboarding');
    revalidatePath('/clients');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

/**
 * Change (reassign) a client from one project to another.
 * Archives the current assignment, then creates a new active assignment
 * with a fresh onboarding workflow.
 */
export async function changeClientAssignment(
  assignmentId: string,
  newProjectId: string,
): Promise<ActionResult> {
  const context = await getActionContext('onboarding:create');
  if ('error' in context) {
    return { error: context.error };
  }

  if (!assignmentId || !newProjectId) {
    return { error: 'Select an assignment and a new project.' };
  }

  try {
    // Validate existing assignment
    const { data: existingAssignment, error: existingError } = await supabase
      .from('client_project_assignments')
      .select('id, org_id, project_id, client_profile_id, status')
      .eq('id', assignmentId)
      .eq('org_id', context.orgId)
      .single();

    if (existingError || !existingAssignment) {
      return { error: 'Current assignment not found.' };
    }

    if (existingAssignment.status !== 'active') {
      return { error: 'Only active assignments can be changed.' };
    }

    if (existingAssignment.project_id === newProjectId) {
      return { error: 'The client is already assigned to that project.' };
    }

    // Validate new project
    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', newProjectId)
      .eq('org_id', context.orgId)
      .single();

    if (projectError || !newProject) {
      return { error: 'New project not found for the active organization.' };
    }

    // Archive old assignment
    const { error: archiveError } = await supabase
      .from('client_project_assignments')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', assignmentId)
      .eq('org_id', context.orgId);

    if (archiveError) {
      console.error('Supabase error:', archiveError);
      return { error: 'Failed to archive the current assignment.' };
    }

    // Clean up any prior archived rows for the new project so re-linking works
    await supabase
      .from('client_project_assignments')
      .delete()
      .eq('org_id', context.orgId)
      .eq('project_id', newProjectId)
      .eq('status', 'archived');

    // Create new active assignment
    const { data: newAssignment, error: newAssignError } = await supabase
      .from('client_project_assignments')
      .insert({
        org_id: context.orgId,
        client_profile_id: existingAssignment.client_profile_id,
        project_id: newProjectId,
        assigned_by: context.userId,
      })
      .select('id')
      .single();

    if (newAssignError || !newAssignment) {
      console.error('Supabase error:', newAssignError);
      // Attempt to roll back archive
      await supabase
        .from('client_project_assignments')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', assignmentId)
        .eq('org_id', context.orgId);

      if (newAssignError?.code === '23505') {
        return { error: 'That project is already assigned to another client.' };
      }
      return { error: 'Failed to create new assignment.' };
    }

    // Create onboarding workflow + steps for the new assignment
    const { data: workflow, error: workflowError } = await supabase
      .from('onboarding_workflows')
      .insert({ org_id: context.orgId, assignment_id: newAssignment.id })
      .select('id')
      .single();

    if (workflowError || !workflow) {
      console.error('Supabase error:', workflowError);
      return { error: 'Assignment created but failed to initialize workflow.' };
    }

    const stepRows = ONBOARDING_STEP_BLUEPRINTS.map((step, index) => ({
      org_id: context.orgId,
      workflow_id: workflow.id,
      step_key: step.key,
      title: step.title,
      description: step.description,
      sort_order: index,
    }));

    const { error: stepsError } = await supabase.from('onboarding_steps').insert(stepRows);
    if (stepsError) {
      console.error('Supabase error:', stepsError);
    }

    // Fetch client name for transparency event
    const { data: client } = await supabase
      .from('client_profiles')
      .select('full_name')
      .eq('id', existingAssignment.client_profile_id)
      .single();

    await logProjectTransparencyEvent({
      orgId: context.orgId,
      projectId: newProjectId,
      assignmentId: newAssignment.id,
      actorId: context.userId,
      eventType: 'client_assigned',
      title: `Client reassigned to ${newProject.name}`,
      body: `${client?.full_name ?? 'Client'} was reassigned from a previous project.`,
      payload: { client_profile_id: existingAssignment.client_profile_id, previous_assignment_id: assignmentId },
    });

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'onboarding.assignment_changed',
      targetType: 'client_project_assignment',
      targetId: newAssignment.id,
      metadata: {
        clientProfileId: existingAssignment.client_profile_id,
        oldProjectId: existingAssignment.project_id,
        newProjectId,
        archivedAssignmentId: assignmentId,
      },
    });

    revalidatePath('/onboarding');
    revalidatePath('/clients');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function updateOnboardingStepStatus(formData: FormData): Promise<ActionResult> {
  const context = await getActionContext('onboarding:update');
  if ('error' in context) {
    return { error: context.error };
  }

  const stepId = (formData.get('step_id') as string | null)?.trim() ?? '';
  const nextStatus = (formData.get('status') as OnboardingStepStatus | null) ?? 'pending';

  if (!stepId) {
    return { error: 'Missing onboarding step.' };
  }

  if (!['pending', 'in_progress', 'completed', 'blocked'].includes(nextStatus)) {
    return { error: 'Invalid onboarding step status.' };
  }

  try {
    const { data: step, error: stepError } = await supabase
      .from('onboarding_steps')
      .select('id, org_id, workflow_id, step_key, title, status')
      .eq('id', stepId)
      .eq('org_id', context.orgId)
      .single();

    if (stepError || !step) {
      return { error: 'Onboarding step not found.' };
    }

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
      completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
    };

    const { error: updateError } = await supabase
      .from('onboarding_steps')
      .update(updatePayload)
      .eq('id', stepId);

    if (updateError) {
      console.error('Supabase error:', updateError);
      return { error: 'Failed to update onboarding step.' };
    }

    const workflowOverrides: Partial<{
      contractStatus: string;
      walkthroughStatus: string;
      welcomeStatus: string;
      projectShareStatus: string;
    }> = {};

    if (step.step_key === 'contract_sent' || step.step_key === 'contract_signed') {
      workflowOverrides.contractStatus = nextStatus === 'completed' ? 'signed' : 'sent';
    }
    if (step.step_key === 'walkthrough_scheduled') {
      workflowOverrides.walkthroughStatus = nextStatus === 'completed' ? 'scheduled' : 'pending';
    }
    if (step.step_key === 'welcome_sent') {
      workflowOverrides.welcomeStatus = nextStatus === 'completed' ? 'sent' : 'draft';
    }
    if (step.step_key === 'project_shared') {
      workflowOverrides.projectShareStatus = nextStatus === 'completed' ? 'active' : 'pending';
    }

    await refreshWorkflowState(step.workflow_id, workflowOverrides);

    const { data: workflow } = await supabase
      .from('onboarding_workflows')
      .select('assignment_id')
      .eq('id', step.workflow_id)
      .single();

    if (workflow?.assignment_id && nextStatus === 'completed') {
      const { data: assignment } = await supabase
        .from('client_project_assignments')
        .select('project_id')
        .eq('id', workflow.assignment_id)
        .single();

      if (assignment?.project_id) {
        await logProjectTransparencyEvent({
          orgId: context.orgId,
          projectId: assignment.project_id,
          assignmentId: workflow.assignment_id,
          actorId: context.userId,
          eventType: 'milestone_updated',
          title: `${step.title} completed`,
          body: step.title,
          payload: {
            step_key: step.step_key,
            status: nextStatus,
          },
        });
      }
    }

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'onboarding.step_updated',
      targetType: 'onboarding_step',
      targetId: step.id,
      metadata: { stepKey: step.step_key, status: nextStatus },
    });

    revalidatePath('/onboarding');
    revalidatePath('/clients');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function createProjectShareLink(formData: FormData): Promise<ActionResult> {
  const context = await getActionContext('onboarding:share');
  if ('error' in context) {
    return { error: context.error };
  }

  const assignmentId = (formData.get('assignment_id') as string | null)?.trim() ?? '';
  if (!assignmentId) {
    return { error: 'Missing client assignment.' };
  }

  try {
    const { data: assignment, error: assignmentError } = await supabase
      .from('client_project_assignments')
      .select('id, org_id, project_id')
      .eq('id', assignmentId)
      .eq('org_id', context.orgId)
      .single();

    if (assignmentError || !assignment) {
      return { error: 'Client assignment not found.' };
    }

    const now = new Date().toISOString();
    await supabase
      .from('project_share_links')
      .update({ status: 'revoked', updated_at: now })
      .eq('assignment_id', assignmentId)
      .eq('status', 'active');

    const token = randomBytes(24).toString('base64url');
    const tokenHash = hashShareToken(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: shareLink, error: shareError } = await supabase
      .from('project_share_links')
      .insert({
        org_id: context.orgId,
        assignment_id: assignmentId,
        project_id: assignment.project_id,
        token_hash: tokenHash,
        status: 'active',
        expires_at: expiresAt,
        created_by: context.userId,
      })
      .select('id')
      .single();

    if (shareError || !shareLink) {
      console.error('Supabase error:', shareError);
      return { error: 'Failed to create a project share link.' };
    }

    const { data: workflow } = await supabase
      .from('onboarding_workflows')
      .select('id')
      .eq('assignment_id', assignmentId)
      .single();

    if (workflow?.id) {
      await supabase
        .from('onboarding_steps')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('workflow_id', workflow.id)
        .eq('step_key', 'project_shared');

      await refreshWorkflowState(workflow.id, { projectShareStatus: 'active' });
    }

    await logProjectTransparencyEvent({
      orgId: context.orgId,
      projectId: assignment.project_id,
      assignmentId,
      actorId: context.userId,
      eventType: 'share_link_created',
      title: 'Client transparency link created',
      body: 'A new read-only project share link is available for the client.',
      payload: {
        share_link_id: shareLink.id,
        expires_at: expiresAt,
      },
    });

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'onboarding.share_link_created',
      targetType: 'project_share_link',
      targetId: shareLink.id,
      metadata: { assignmentId, expiresAt },
    });

    return {
      success: true,
      data: {
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/client/${token}`,
        expiresAt,
      },
    };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getClientProjectShareView(token: string): Promise<
  | {
      error: string;
    }
  | {
      data: {
        client: { fullName: string; email: string; phone: string | null };
        project: {
          id: string;
          name: string;
          description: string;
          published: boolean;
          coverImageUrl: string | null;
        };
        workflow: {
          stage: string;
          progressPercent: number;
          steps: OnboardingStepSummary[];
        };
        items: Array<{
          id: string;
          name: string;
          description: string;
          category: string;
          condition: string;
          price: number;
          status: string;
          thumbnail_url: string | null;
          medium_image_url: string | null;
          created_at: string;
        }>;
        events: Array<{
          id: string;
          event_type: string;
          title: string;
          body: string | null;
          created_at: string;
        }>;
      };
    }
> {
  try {
    const tokenHash = hashShareToken(token);
    const { data: shareLink, error: shareError } = await supabase
      .from('project_share_links')
      .select('id, assignment_id, project_id, status, expires_at')
      .eq('token_hash', tokenHash)
      .single();

    if (shareError || !shareLink) {
      return { error: 'Share link not found.' };
    }

    if (shareLink.status !== 'active') {
      return { error: 'This share link is no longer active.' };
    }

    if (shareLink.expires_at && new Date(shareLink.expires_at).getTime() < Date.now()) {
      await supabase
        .from('project_share_links')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', shareLink.id);
      return { error: 'This share link has expired.' };
    }

    await supabase
      .from('project_share_links')
      .update({ last_accessed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', shareLink.id);

    const [assignmentRes, projectRes, workflowRes, itemsRes, eventRes] = await Promise.all([
      supabase
        .from('client_project_assignments')
        .select('client_profile_id')
        .eq('id', shareLink.assignment_id)
        .single(),
      supabase
        .from('projects')
        .select('id, name, description, cover_image_url, published')
        .eq('id', shareLink.project_id)
        .single(),
      supabase
        .from('onboarding_workflows')
        .select('id, stage, progress_percent')
        .eq('assignment_id', shareLink.assignment_id)
        .single(),
      supabase
        .from('inventory_items')
        .select('id, name, description, category, condition, price, status, thumbnail_url, medium_image_url, created_at')
        .eq('project_id', shareLink.project_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('project_transparency_events')
        .select('id, event_type, title, body, created_at')
        .eq('project_id', shareLink.project_id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (assignmentRes.error || !assignmentRes.data || projectRes.error || !projectRes.data || workflowRes.error || !workflowRes.data) {
      return { error: 'Failed to load shared onboarding data.' };
    }

    const [stepRes, clientRes] = await Promise.all([
      supabase
        .from('onboarding_steps')
        .select('id, step_key, title, description, status, sort_order, completed_at')
        .eq('workflow_id', workflowRes.data.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('client_profiles')
        .select('full_name, email, phone')
        .eq('id', assignmentRes.data.client_profile_id)
        .single(),
    ]);

    if (stepRes.error || clientRes.error || !clientRes.data) {
      return { error: 'Failed to load shared onboarding data.' };
    }

    const steps = ((stepRes.data ?? []) as Array<Omit<OnboardingStepSummary, 'workflow_id'>>).map((step) => ({
      id: step.id,
      step_key: step.step_key,
      title: step.title,
      description: step.description,
      status: step.status,
      sort_order: step.sort_order,
      completed_at: step.completed_at,
    }));

    return {
      data: {
        client: {
          fullName: clientRes.data.full_name,
          email: clientRes.data.email,
          phone: clientRes.data.phone,
        },
        project: {
          id: projectRes.data.id,
          name: projectRes.data.name,
          description: projectRes.data.description,
          published: projectRes.data.published,
          coverImageUrl: projectRes.data.cover_image_url,
        },
        workflow: {
          stage: workflowRes.data.stage,
          progressPercent: workflowRes.data.progress_percent,
          steps,
        },
        items: (itemsRes.data ?? []) as Array<{
          id: string;
          name: string;
          description: string;
          category: string;
          condition: string;
          price: number;
          status: string;
          thumbnail_url: string | null;
          medium_image_url: string | null;
          created_at: string;
        }>,
        events: (eventRes.data ?? []) as Array<{
          id: string;
          event_type: string;
          title: string;
          body: string | null;
          created_at: string;
        }>,
      },
    };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Contract types ────────────────────────────────────────────

export type ContractAdditionalCharge = {
  label: string;
  amount: number;
};

export type ContractDiscountDay = {
  day: number;
  percent: number;
};

export type UnsoldItemsHandling = 'client_keeps' | 'donate' | 'haul_away' | 'negotiate';

export type ContractTerms = {
  commission_rate: number | null;
  minimum_commission: number | null;
  flat_fee: number | null;
  additional_charges: ContractAdditionalCharge[];
  sale_duration_days: number | null;
  discount_schedule: ContractDiscountDay[];
  unsold_items_handling: UnsoldItemsHandling;
  payment_terms_days: number | null;
  cancellation_fee: number | null;
  special_terms: string;
};

export type ContractDetail = ContractTerms & {
  id: string;
  assignment_id: string;
  provider: string;
  status: string;
  template_name: string | null;
  signer_name: string | null;
  signer_email: string | null;
  external_contract_id: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
};

// ── Contract draft/edit/send flows ────────────────────────────

/** Parse contract term fields from FormData. */
function parseContractTerms(formData: FormData): ContractTerms {
  const commRate = formData.get('commission_rate') as string | null;
  const minComm = formData.get('minimum_commission') as string | null;
  const flatFee = formData.get('flat_fee') as string | null;
  const saleDays = formData.get('sale_duration_days') as string | null;
  const payDays = formData.get('payment_terms_days') as string | null;
  const cancelFee = formData.get('cancellation_fee') as string | null;
  const specialTerms = (formData.get('special_terms') as string | null)?.trim() ?? '';
  const unsold = (formData.get('unsold_items_handling') as string | null)?.trim() ?? 'client_keeps';
  const chargesJson = formData.get('additional_charges') as string | null;
  const scheduleJson = formData.get('discount_schedule') as string | null;

  let additionalCharges: ContractAdditionalCharge[] = [];
  if (chargesJson) {
    try { additionalCharges = JSON.parse(chargesJson); } catch { /* keep empty */ }
  }

  let discountSchedule: ContractDiscountDay[] = [];
  if (scheduleJson) {
    try { discountSchedule = JSON.parse(scheduleJson); } catch { /* keep empty */ }
  }

  return {
    commission_rate: commRate ? parseFloat(commRate) : null,
    minimum_commission: minComm ? parseFloat(minComm) : null,
    flat_fee: flatFee ? parseFloat(flatFee) : null,
    additional_charges: additionalCharges,
    sale_duration_days: saleDays ? parseInt(saleDays, 10) : null,
    discount_schedule: discountSchedule,
    unsold_items_handling: (['client_keeps', 'donate', 'haul_away', 'negotiate'].includes(unsold)
      ? unsold : 'client_keeps') as UnsoldItemsHandling,
    payment_terms_days: payDays ? parseInt(payDays, 10) : null,
    cancellation_fee: cancelFee ? parseFloat(cancelFee) : null,
    special_terms: specialTerms,
  };
}

/**
 * Create a new contract in draft status with financial terms.
 * Does NOT send — the user edits the draft first, then sends.
 */
export async function createContractDraft(formData: FormData): Promise<ActionResult & { data?: { contractId: string } }> {
  const context = await getActionContext('onboarding:update');
  if ('error' in context) {
    return { error: context.error };
  }

  const assignmentId = (formData.get('assignment_id') as string | null)?.trim() ?? '';
  const provider = ((formData.get('provider') as string | null)?.trim() ?? 'manual') as ContractProvider;
  const templateName = (formData.get('template_name') as string | null)?.trim() ?? '';

  if (!assignmentId) {
    return { error: 'Missing client assignment.' };
  }
  if (!['docusign', 'dropbox_sign', 'manual'].includes(provider)) {
    return { error: 'Invalid contract provider.' };
  }

  try {
    const { data: assignment, error: assignmentError } = await supabase
      .from('client_project_assignments')
      .select('id, org_id, client_profile_id')
      .eq('id', assignmentId)
      .eq('org_id', context.orgId)
      .single();

    if (assignmentError || !assignment) {
      return { error: 'Client assignment not found.' };
    }

    const { data: client } = await supabase
      .from('client_profiles')
      .select('full_name, email')
      .eq('id', assignment.client_profile_id)
      .single();

    if (!client) {
      return { error: 'Client profile not found.' };
    }

    const terms = parseContractTerms(formData);

    const insertPayload: Record<string, unknown> = {
      org_id: context.orgId,
      assignment_id: assignmentId,
      provider,
      status: 'draft',
      template_name: templateName || 'Estate Sale Agreement',
      signer_name: client.full_name,
      signer_email: client.email,
      created_by: context.userId,
    };
    // Only include terms columns when the migration has been applied
    if (terms.commission_rate !== null) insertPayload.commission_rate = terms.commission_rate;
    if (terms.minimum_commission !== null) insertPayload.minimum_commission = terms.minimum_commission;
    if (terms.flat_fee !== null) insertPayload.flat_fee = terms.flat_fee;
    if (terms.additional_charges.length > 0) insertPayload.additional_charges = JSON.stringify(terms.additional_charges);
    if (terms.sale_duration_days !== null) insertPayload.sale_duration_days = terms.sale_duration_days;
    if (terms.discount_schedule.length > 0) insertPayload.discount_schedule = JSON.stringify(terms.discount_schedule);
    if (terms.unsold_items_handling !== 'client_keeps') insertPayload.unsold_items_handling = terms.unsold_items_handling;
    if (terms.payment_terms_days !== null && terms.payment_terms_days !== 14) insertPayload.payment_terms_days = terms.payment_terms_days;
    if (terms.cancellation_fee !== null && terms.cancellation_fee > 0) insertPayload.cancellation_fee = terms.cancellation_fee;
    if (terms.special_terms) insertPayload.special_terms = terms.special_terms;

    const { data: contract, error: insertError } = await supabase
      .from('contracts')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError || !contract) {
      console.error('Supabase error:', insertError);
      return { error: 'Failed to create contract draft.' };
    }

    // Record creation event
    await supabase.from('contract_events').insert({
      org_id: context.orgId,
      contract_id: contract.id,
      event_type: 'draft_created',
      payload: { provider, template_name: templateName },
    });

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'onboarding.contract_drafted',
      targetType: 'contract',
      targetId: contract.id,
      metadata: { provider, assignmentId },
    });

    revalidatePath('/onboarding');
    revalidatePath('/clients');
    revalidatePath('/contracts');
    return { success: true, data: { contractId: contract.id } };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

/**
 * Update an existing draft contract's terms. Only drafts can be edited.
 */
export async function updateContractDraft(formData: FormData): Promise<ActionResult> {
  const context = await getActionContext('onboarding:update');
  if ('error' in context) {
    return { error: context.error };
  }

  const contractId = (formData.get('contract_id') as string | null)?.trim() ?? '';
  if (!contractId) {
    return { error: 'Missing contract ID.' };
  }

  try {
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('id, org_id, status')
      .eq('id', contractId)
      .eq('org_id', context.orgId)
      .single();

    if (fetchError || !contract) {
      return { error: 'Contract not found.' };
    }

    if (contract.status !== 'draft') {
      return { error: 'Only draft contracts can be edited.' };
    }

    const terms = parseContractTerms(formData);
    const provider = formData.get('provider') as string | null;
    const templateName = formData.get('template_name') as string | null;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (provider && ['docusign', 'dropbox_sign', 'manual'].includes(provider)) {
      updatePayload.provider = provider;
    }
    if (templateName !== null) {
      updatePayload.template_name = templateName.trim() || null;
    }
    // Always update terms fields via the payload
    updatePayload.commission_rate = terms.commission_rate;
    updatePayload.minimum_commission = terms.minimum_commission;
    updatePayload.flat_fee = terms.flat_fee ?? 0;
    updatePayload.additional_charges = JSON.stringify(terms.additional_charges);
    updatePayload.sale_duration_days = terms.sale_duration_days;
    updatePayload.discount_schedule = JSON.stringify(terms.discount_schedule);
    updatePayload.unsold_items_handling = terms.unsold_items_handling;
    updatePayload.payment_terms_days = terms.payment_terms_days ?? 14;
    updatePayload.cancellation_fee = terms.cancellation_fee ?? 0;
    updatePayload.special_terms = terms.special_terms;

    const { error: updateError } = await supabase
      .from('contracts')
      .update(updatePayload)
      .eq('id', contractId)
      .eq('org_id', context.orgId);

    if (updateError) {
      console.error('Supabase error:', updateError);
      return { error: 'Failed to update contract.' };
    }

    // Record edit event
    await supabase.from('contract_events').insert({
      org_id: context.orgId,
      contract_id: contractId,
      event_type: 'draft_edited',
      payload: {},
    });

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'onboarding.contract_drafted',
      targetType: 'contract',
      targetId: contractId,
      metadata: { action: 'edit' },
    });

    revalidatePath('/onboarding');
    revalidatePath('/clients');
    revalidatePath('/contracts');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

/**
 * Delete a draft contract. Only contracts in 'draft' status can be deleted.
 */
export async function deleteContractDraft(contractId: string): Promise<ActionResult> {
  const context = await getActionContext('onboarding:update');
  if ('error' in context) {
    return { error: context.error };
  }

  if (!contractId) {
    return { error: 'Missing contract ID.' };
  }

  try {
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('id, org_id, status, assignment_id')
      .eq('id', contractId)
      .eq('org_id', context.orgId)
      .single();

    if (fetchError || !contract) {
      return { error: 'Contract not found.' };
    }

    if (contract.status !== 'draft') {
      return { error: 'Only draft contracts can be deleted.' };
    }

    // Delete related events first (FK constraint)
    await supabase
      .from('contract_events')
      .delete()
      .eq('contract_id', contractId);

    const { error: deleteError } = await supabase
      .from('contracts')
      .delete()
      .eq('id', contractId)
      .eq('org_id', context.orgId);

    if (deleteError) {
      console.error('Supabase error:', deleteError);
      return { error: 'Failed to delete contract.' };
    }

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'onboarding.contract_deleted',
      targetType: 'contract',
      targetId: contractId,
      metadata: { assignmentId: contract.assignment_id },
    });

    revalidatePath('/onboarding');
    revalidatePath('/clients');
    revalidatePath('/contracts');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

/**
 * Fetch full details of a single contract (for the editor UI).
 */
export async function getContractDetail(
  contractId: string,
): Promise<{ data?: ContractDetail; error?: string }> {
  const supabaseClient = await createClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const activeOrgId = await resolveActiveOrgId(user.id);
  if (!activeOrgId) return { error: 'No active organization.' };

  const perm = await requirePermission(activeOrgId, user.id, 'onboarding:view');
  if (!perm.granted) return { error: perm.error };

  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .eq('org_id', activeOrgId)
    .single();

  if (error || !data) {
    return { error: 'Contract not found.' };
  }

  const row = data as Record<string, unknown>;

  return {
    data: {
      id: row.id as string,
      assignment_id: row.assignment_id as string,
      provider: row.provider as string,
      status: row.status as string,
      template_name: (row.template_name as string | null) ?? null,
      signer_name: (row.signer_name as string | null) ?? null,
      signer_email: (row.signer_email as string | null) ?? null,
      external_contract_id: (row.external_contract_id as string | null) ?? null,
      signed_at: (row.signed_at as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      commission_rate: row.commission_rate != null ? Number(row.commission_rate) : null,
      minimum_commission: row.minimum_commission != null ? Number(row.minimum_commission) : null,
      flat_fee: row.flat_fee != null ? Number(row.flat_fee) : null,
      additional_charges: Array.isArray(row.additional_charges) ? row.additional_charges as ContractAdditionalCharge[] : [],
      sale_duration_days: row.sale_duration_days != null ? Number(row.sale_duration_days) : null,
      discount_schedule: Array.isArray(row.discount_schedule) ? row.discount_schedule as ContractDiscountDay[] : [],
      unsold_items_handling: (row.unsold_items_handling as UnsoldItemsHandling) ?? 'client_keeps',
      payment_terms_days: row.payment_terms_days != null ? Number(row.payment_terms_days) : null,
      cancellation_fee: row.cancellation_fee != null ? Number(row.cancellation_fee) : null,
      special_terms: (row.special_terms as string) ?? '',
    },
  };
}

/**
 * Send an existing draft contract to the client via the selected provider.
 * The contract must be in 'draft' status.
 */
export async function sendContract(formData: FormData): Promise<ActionResult> {
  const context = await getActionContext('onboarding:update');
  if ('error' in context) {
    return { error: context.error };
  }

  const contractId = (formData.get('contract_id') as string | null)?.trim() ?? '';
  if (!contractId) {
    return { error: 'Missing contract ID.' };
  }

  try {
    // Load the draft contract
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .eq('org_id', context.orgId)
      .single();

    if (contractError || !contract) {
      return { error: 'Contract not found.' };
    }

    const row = contract as Record<string, unknown>;
    if (row.status !== 'draft') {
      return { error: 'Only draft contracts can be sent.' };
    }

    const assignmentId = row.assignment_id as string;
    const provider = row.provider as ContractProvider;
    const templateName = (row.template_name as string) || 'Estate Sale Agreement';

    const { data: assignment, error: assignmentError } = await supabase
      .from('client_project_assignments')
      .select('id, org_id, project_id, client_profile_id')
      .eq('id', assignmentId)
      .eq('org_id', context.orgId)
      .single();

    if (assignmentError || !assignment) {
      return { error: 'Client assignment not found.' };
    }

    const { data: client } = await supabase
      .from('client_profiles')
      .select('full_name, email')
      .eq('id', assignment.client_profile_id)
      .single();

    if (!client) {
      return { error: 'Client profile not found.' };
    }

    // Send via provider adapter
    const adapter = getContractAdapter(provider);
    const sendResult = await adapter.send({
      contractId: contractId,
      signerName: client.full_name,
      signerEmail: client.email,
      documentTitle: templateName,
      metadata: { org_id: context.orgId, assignment_id: assignmentId },
    });

    // Update contract with external ID and status
    await supabase
      .from('contracts')
      .update({
        external_contract_id: sendResult.externalContractId,
        status: sendResult.status === 'sent' ? 'sent' : sendResult.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId);

    // Record contract event
    await supabase.from('contract_events').insert({
      org_id: context.orgId,
      contract_id: contractId,
      event_type: 'sent',
      payload: sendResult.rawResponse ?? {},
    });

    // Update onboarding step + workflow
    const { data: workflow } = await supabase
      .from('onboarding_workflows')
      .select('id')
      .eq('assignment_id', assignmentId)
      .single();

    if (workflow?.id) {
      await supabase
        .from('onboarding_steps')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('workflow_id', workflow.id)
        .eq('step_key', 'contract_sent')
        .eq('status', 'pending');

      await refreshWorkflowState(workflow.id, { contractStatus: sendResult.status });
    }

    // Log transparency event
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', assignment.project_id)
      .single();

    await logProjectTransparencyEvent({
      orgId: context.orgId,
      projectId: assignment.project_id,
      assignmentId,
      actorId: context.userId,
      eventType: 'contract_sent',
      title: `Contract sent to ${client.full_name}`,
      body: `Agreement "${templateName}" sent via ${provider} for ${project?.name ?? 'project'}.`,
      payload: { contract_id: contractId, provider },
    });

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'onboarding.step_updated',
      targetType: 'contract',
      targetId: contractId,
      metadata: { provider, assignmentId, status: sendResult.status },
    });

    revalidatePath('/onboarding');
    revalidatePath('/clients');
    revalidatePath('/contracts');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Contract webhook processing ──────────────────────────────

export type ContractWebhookPayload = {
  provider: ContractProvider;
  rawPayload: Record<string, unknown>;
};

export async function processContractWebhook(payload: ContractWebhookPayload): Promise<void> {
  const adapter = getContractAdapter(payload.provider);
  const event = adapter.normalizeWebhookEvent(payload.rawPayload);
  if (!event) {
    console.warn('[contract-webhook] Could not normalize event:', payload.provider);
    return;
  }

  // Look up contract by provider + external ID
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id, org_id, assignment_id, status')
    .eq('provider', payload.provider)
    .eq('external_contract_id', event.externalContractId)
    .single();

  if (error || !contract) {
    console.warn('[contract-webhook] Contract not found:', event.externalContractId);
    return;
  }

  // Idempotency: skip if already at or past this status
  const statusOrder = ['draft', 'sent', 'viewed', 'signed', 'declined', 'voided', 'expired'] as const;
  const currentIdx = statusOrder.indexOf(contract.status as typeof statusOrder[number]);
  const newIdx = statusOrder.indexOf(event.normalizedStatus);
  if (newIdx <= currentIdx && event.normalizedStatus !== 'declined' && event.normalizedStatus !== 'voided') {
    console.log('[contract-webhook] Skipping duplicate/older event:', event.normalizedStatus, 'current:', contract.status);
    return;
  }

  // Record the event
  await supabase.from('contract_events').insert({
    org_id: contract.org_id,
    contract_id: contract.id,
    event_type: event.eventType,
    payload: event.rawPayload,
  });

  // Update contract status
  const contractUpdate: Record<string, unknown> = {
    status: event.normalizedStatus,
    updated_at: new Date().toISOString(),
  };
  if (event.normalizedStatus === 'signed') {
    contractUpdate.signed_at = event.timestamp;
  }
  await supabase.from('contracts').update(contractUpdate).eq('id', contract.id);

  // Update onboarding workflow
  const { data: workflow } = await supabase
    .from('onboarding_workflows')
    .select('id')
    .eq('assignment_id', contract.assignment_id)
    .single();

  if (workflow?.id) {
    if (event.normalizedStatus === 'sent' || event.normalizedStatus === 'viewed') {
      await supabase
        .from('onboarding_steps')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('workflow_id', workflow.id)
        .eq('step_key', 'contract_sent')
        .in('status', ['pending']);
    }

    if (event.normalizedStatus === 'signed') {
      const now = new Date().toISOString();
      await supabase
        .from('onboarding_steps')
        .update({ status: 'completed', completed_at: now, updated_at: now })
        .eq('workflow_id', workflow.id)
        .eq('step_key', 'contract_sent');

      await supabase
        .from('onboarding_steps')
        .update({ status: 'completed', completed_at: now, updated_at: now })
        .eq('workflow_id', workflow.id)
        .eq('step_key', 'contract_signed');
    }

    await refreshWorkflowState(workflow.id, { contractStatus: event.normalizedStatus });
  }

  // Log transparency event for signed contracts
  if (event.normalizedStatus === 'signed') {
    const { data: assignment } = await supabase
      .from('client_project_assignments')
      .select('project_id')
      .eq('id', contract.assignment_id)
      .single();

    if (assignment?.project_id) {
      await logProjectTransparencyEvent({
        orgId: contract.org_id,
        projectId: assignment.project_id,
        assignmentId: contract.assignment_id,
        eventType: 'contract_signed',
        title: 'Contract signed',
        body: 'The client agreement has been signed and is complete.',
        payload: { contract_id: contract.id },
      });
    }
  }
}

// ── Welcome email delivery ───────────────────────────────────

export async function sendWelcomeEmail(formData: FormData): Promise<ActionResult> {
  const context = await getActionContext('onboarding:update');
  if ('error' in context) {
    return { error: context.error };
  }

  const assignmentId = (formData.get('assignment_id') as string | null)?.trim() ?? '';
  const subject = (formData.get('subject') as string | null)?.trim() ?? '';
  const body = (formData.get('body') as string | null)?.trim() ?? '';

  if (!assignmentId) {
    return { error: 'Missing client assignment.' };
  }
  if (!subject) {
    return { error: 'Email subject is required.' };
  }

  try {
    const { data: assignment, error: assignmentError } = await supabase
      .from('client_project_assignments')
      .select('id, org_id, project_id, client_profile_id')
      .eq('id', assignmentId)
      .eq('org_id', context.orgId)
      .single();

    if (assignmentError || !assignment) {
      return { error: 'Client assignment not found.' };
    }

    const [{ data: client }, { data: org }, { data: project }] = await Promise.all([
      supabase.from('client_profiles').select('full_name, email').eq('id', assignment.client_profile_id).single(),
      supabase.from('organizations').select('name').eq('id', context.orgId).single(),
      supabase.from('projects').select('name').eq('id', assignment.project_id).single(),
    ]);

    if (!client) {
      return { error: 'Client profile not found.' };
    }

    // Get active share link URL if available
    const { data: shareLink } = await supabase
      .from('project_share_links')
      .select('token_hash')
      .eq('assignment_id', assignmentId)
      .eq('status', 'active')
      .limit(1)
      .single();

    // Create welcome message row
    const { data: message, error: messageError } = await supabase
      .from('welcome_messages')
      .insert({
        org_id: context.orgId,
        assignment_id: assignmentId,
        provider: (process.env.EMAIL_PROVIDER as string) ?? 'manual',
        status: 'queued',
        subject,
        body: body || `Welcome to your project with ${org?.name ?? 'us'}!`,
        created_by: context.userId,
      })
      .select('id')
      .single();

    if (messageError || !message) {
      console.error('Supabase error:', messageError);
      if (messageError?.code === '23505') {
        return { error: 'A welcome email is already pending for this assignment.' };
      }
      return { error: 'Failed to create welcome message.' };
    }

    // Queue the email delivery
    const emailPayload: WelcomeEmailQueuePayload = {
      welcomeMessageId: message.id,
      to: client.email,
      recipientName: client.full_name,
      subject,
      textBody: body || `Welcome to your project with ${org?.name ?? 'us'}!`,
      orgName: org?.name ?? '',
      projectName: project?.name ?? '',
      assignmentId,
      orgId: context.orgId,
      shareUrl: shareLink ? undefined : undefined, // Token hash is not the URL; share URL not exposed here for security
    };

    await enqueue(TOPICS.WELCOME_EMAIL, emailPayload, processWelcomeEmailDelivery);

    // Update onboarding step
    const { data: workflow } = await supabase
      .from('onboarding_workflows')
      .select('id')
      .eq('assignment_id', assignmentId)
      .single();

    if (workflow?.id) {
      await supabase
        .from('onboarding_steps')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('workflow_id', workflow.id)
        .eq('step_key', 'welcome_sent')
        .eq('status', 'pending');

      await refreshWorkflowState(workflow.id, { welcomeStatus: 'queued' });
    }

    revalidatePath('/onboarding');
    revalidatePath('/clients');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

export type WelcomeEmailQueuePayload = {
  welcomeMessageId: string;
  to: string;
  recipientName: string;
  subject: string;
  textBody: string;
  orgName: string;
  projectName: string;
  assignmentId: string;
  orgId: string;
  shareUrl?: string;
};

export async function processWelcomeEmailDelivery(payload: WelcomeEmailQueuePayload): Promise<void> {
  const adapter = getEmailAdapter();

  const result = await adapter.send({
    welcomeMessageId: payload.welcomeMessageId,
    to: payload.to,
    recipientName: payload.recipientName,
    subject: payload.subject,
    textBody: payload.textBody,
    orgName: payload.orgName,
    projectName: payload.projectName,
    shareUrl: payload.shareUrl,
  });

  const now = new Date().toISOString();

  if (result.status === 'sent') {
    await supabase
      .from('welcome_messages')
      .update({
        status: 'sent',
        sent_at: now,
        metadata: { external_message_id: result.externalMessageId },
        updated_at: now,
      })
      .eq('id', payload.welcomeMessageId);

    // Complete onboarding step
    const { data: message } = await supabase
      .from('welcome_messages')
      .select('assignment_id, org_id')
      .eq('id', payload.welcomeMessageId)
      .single();

    if (message) {
      const { data: workflow } = await supabase
        .from('onboarding_workflows')
        .select('id')
        .eq('assignment_id', message.assignment_id)
        .single();

      if (workflow?.id) {
        await supabase
          .from('onboarding_steps')
          .update({ status: 'completed', completed_at: now, updated_at: now })
          .eq('workflow_id', workflow.id)
          .eq('step_key', 'welcome_sent');

        await refreshWorkflowState(workflow.id, { welcomeStatus: 'sent' });
      }

      // Log transparency event
      const { data: assignment } = await supabase
        .from('client_project_assignments')
        .select('project_id')
        .eq('id', message.assignment_id)
        .single();

      if (assignment?.project_id) {
        await logProjectTransparencyEvent({
          orgId: message.org_id,
          projectId: assignment.project_id,
          assignmentId: message.assignment_id,
          eventType: 'welcome_email_sent',
          title: 'Welcome email delivered',
          body: `Welcome email "${payload.subject}" was sent to ${payload.recipientName}.`,
          payload: { welcome_message_id: payload.welcomeMessageId },
        });
      }
    }
  } else {
    await supabase
      .from('welcome_messages')
      .update({
        status: 'failed',
        metadata: { error: result.error },
        updated_at: now,
      })
      .eq('id', payload.welcomeMessageId);

    throw new Error(`Welcome email delivery failed: ${result.error}`);
  }
}

// ── Walkthrough scheduling ───────────────────────────────────

export async function scheduleWalkthrough(formData: FormData): Promise<ActionResult> {
  const context = await getActionContext('onboarding:update');
  if ('error' in context) {
    return { error: context.error };
  }

  const assignmentId = (formData.get('assignment_id') as string | null)?.trim() ?? '';
  const provider = ((formData.get('provider') as string | null)?.trim() ?? 'calendly') as SchedulingProvider;
  const notes = (formData.get('notes') as string | null)?.trim() ?? '';
  const eventTypeUri = (formData.get('event_type_uri') as string | null)?.trim() ?? undefined;

  if (!assignmentId) {
    return { error: 'Missing client assignment.' };
  }
  if (!['calendly', 'google_meet', 'manual'].includes(provider)) {
    return { error: 'Invalid scheduling provider.' };
  }

  try {
    const { data: assignment, error: assignmentError } = await supabase
      .from('client_project_assignments')
      .select('id, org_id, project_id, client_profile_id')
      .eq('id', assignmentId)
      .eq('org_id', context.orgId)
      .single();

    if (assignmentError || !assignment) {
      return { error: 'Client assignment not found.' };
    }

    const { data: client } = await supabase
      .from('client_profiles')
      .select('full_name, email')
      .eq('id', assignment.client_profile_id)
      .single();

    if (!client) {
      return { error: 'Client profile not found.' };
    }

    // Create walkthrough session row
    const { data: session, error: sessionError } = await supabase
      .from('walkthrough_sessions')
      .insert({
        org_id: context.orgId,
        assignment_id: assignmentId,
        provider,
        status: 'pending',
        notes: notes || null,
        created_by: context.userId,
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      console.error('Supabase error:', sessionError);
      return { error: 'Failed to create walkthrough session.' };
    }

    // Create invite via provider adapter
    const adapter = getSchedulingAdapter(provider);
    const inviteResult = await adapter.createInvite({
      walkthroughId: session.id,
      eventTypeUri,
      inviteeName: client.full_name,
      inviteeEmail: client.email,
      metadata: { org_id: context.orgId, assignment_id: assignmentId },
    });

    // Update session with provider details
    await supabase
      .from('walkthrough_sessions')
      .update({
        external_event_id: inviteResult.externalEventId,
        meeting_url: inviteResult.meetingUrl ?? null,
        scheduled_start_at: inviteResult.scheduledStartAt ?? null,
        scheduled_end_at: inviteResult.scheduledEndAt ?? null,
        status: inviteResult.scheduledStartAt ? 'scheduled' : 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    // Record walkthrough event
    await supabase.from('walkthrough_events').insert({
      org_id: context.orgId,
      walkthrough_id: session.id,
      event_type: 'invite_created',
      payload: inviteResult.rawResponse ?? {},
    });

    // Update onboarding step
    const { data: workflow } = await supabase
      .from('onboarding_workflows')
      .select('id')
      .eq('assignment_id', assignmentId)
      .single();

    if (workflow?.id) {
      await supabase
        .from('onboarding_steps')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('workflow_id', workflow.id)
        .eq('step_key', 'walkthrough_scheduled')
        .eq('status', 'pending');

      await refreshWorkflowState(workflow.id, {
        walkthroughStatus: inviteResult.scheduledStartAt ? 'scheduled' : 'pending',
      });
    }

    // Log transparency event
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', assignment.project_id)
      .single();

    await logProjectTransparencyEvent({
      orgId: context.orgId,
      projectId: assignment.project_id,
      assignmentId,
      actorId: context.userId,
      eventType: 'walkthrough_scheduled',
      title: `Walkthrough invite sent to ${client.full_name}`,
      body: `Walkthrough scheduling via ${provider} for ${project?.name ?? 'project'}.`,
      payload: { walkthrough_id: session.id, provider },
    });

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'onboarding.step_updated',
      targetType: 'walkthrough_session',
      targetId: session.id,
      metadata: { provider, assignmentId },
    });

    revalidatePath('/onboarding');
    revalidatePath('/clients');
    return {
      success: true,
      data: inviteResult.schedulingUrl
        ? { shareUrl: inviteResult.schedulingUrl }
        : undefined,
    };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Walkthrough webhook processing ───────────────────────────

export type WalkthroughWebhookPayload = {
  provider: SchedulingProvider;
  rawPayload: Record<string, unknown>;
};

export async function processWalkthroughWebhook(payload: WalkthroughWebhookPayload): Promise<void> {
  const adapter = getSchedulingAdapter(payload.provider);
  const event = adapter.normalizeWebhookEvent(payload.rawPayload);
  if (!event) {
    console.warn('[walkthrough-webhook] Could not normalize event:', payload.provider);
    return;
  }

  // Look up session by provider + external ID
  const { data: session, error } = await supabase
    .from('walkthrough_sessions')
    .select('id, org_id, assignment_id, status')
    .eq('provider', payload.provider)
    .eq('external_event_id', event.externalEventId)
    .single();

  if (error || !session) {
    console.warn('[walkthrough-webhook] Session not found:', event.externalEventId);
    return;
  }

  // Record the event
  await supabase.from('walkthrough_events').insert({
    org_id: session.org_id,
    walkthrough_id: session.id,
    event_type: event.eventType,
    payload: event.rawPayload,
  });

  // Update session
  const sessionUpdate: Record<string, unknown> = {
    status: event.normalizedStatus,
    updated_at: new Date().toISOString(),
  };
  if (event.scheduledStartAt) sessionUpdate.scheduled_start_at = event.scheduledStartAt;
  if (event.scheduledEndAt) sessionUpdate.scheduled_end_at = event.scheduledEndAt;
  if (event.meetingUrl) sessionUpdate.meeting_url = event.meetingUrl;

  await supabase.from('walkthrough_sessions').update(sessionUpdate).eq('id', session.id);

  // Update onboarding workflow
  const { data: workflow } = await supabase
    .from('onboarding_workflows')
    .select('id')
    .eq('assignment_id', session.assignment_id)
    .single();

  if (workflow?.id) {
    if (event.normalizedStatus === 'scheduled') {
      const now = new Date().toISOString();
      await supabase
        .from('onboarding_steps')
        .update({ status: 'completed', completed_at: now, updated_at: now })
        .eq('workflow_id', workflow.id)
        .eq('step_key', 'walkthrough_scheduled');
    } else if (event.normalizedStatus === 'canceled') {
      await supabase
        .from('onboarding_steps')
        .update({ status: 'pending', completed_at: null, updated_at: new Date().toISOString() })
        .eq('workflow_id', workflow.id)
        .eq('step_key', 'walkthrough_scheduled');
    }

    await refreshWorkflowState(workflow.id, { walkthroughStatus: event.normalizedStatus });
  }

  // Log transparency event for scheduled walkthroughs
  if (event.normalizedStatus === 'scheduled') {
    const { data: assignment } = await supabase
      .from('client_project_assignments')
      .select('project_id')
      .eq('id', session.assignment_id)
      .single();

    if (assignment?.project_id) {
      await logProjectTransparencyEvent({
        orgId: session.org_id,
        projectId: assignment.project_id,
        assignmentId: session.assignment_id,
        eventType: 'walkthrough_scheduled',
        title: 'Walkthrough confirmed',
        body: event.scheduledStartAt
          ? `Walkthrough booked for ${new Date(event.scheduledStartAt).toLocaleDateString()}.`
          : 'Walkthrough appointment confirmed.',
        payload: { walkthrough_id: session.id },
      });
    }
  }
}

// ── Legacy project backfill ──────────────────────────────────

const SENTINEL_EMAIL_PREFIX = '__internal:';

export async function backfillLegacyProjects(): Promise<ActionResult> {
  const context = await getActionContext('onboarding:create');
  if ('error' in context) {
    return { error: context.error };
  }

  try {
    const orgId = context.orgId;

    // Find or create sentinel client profile for this org
    const sentinelEmail = `${SENTINEL_EMAIL_PREFIX}${orgId}`;
    let sentinelId: string;

    const { data: existingSentinel } = await supabase
      .from('client_profiles')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', sentinelEmail)
      .single();

    if (existingSentinel) {
      sentinelId = existingSentinel.id;
    } else {
      const { data: newSentinel, error: sentinelError } = await supabase
        .from('client_profiles')
        .insert({
          org_id: orgId,
          full_name: 'Legacy Projects',
          email: sentinelEmail,
          notes: 'Auto-created sentinel profile for legacy project backfill.',
          created_by: context.userId,
        })
        .select('id')
        .single();

      if (sentinelError || !newSentinel) {
        console.error('Supabase error:', sentinelError);
        return { error: 'Failed to create sentinel client profile.' };
      }
      sentinelId = newSentinel.id;
    }

    // Find all projects in this org that don't have any onboarding assignment
    const { data: allProjects } = await supabase
      .from('projects')
      .select('id, name')
      .eq('org_id', orgId);

    const { data: existingAssignments } = await supabase
      .from('client_project_assignments')
      .select('project_id')
      .eq('org_id', orgId);

    const assignedProjectIds = new Set(
      (existingAssignments ?? []).map((a: { project_id: string }) => a.project_id),
    );

    const unassignedProjects = (allProjects ?? []).filter(
      (p: { id: string }) => !assignedProjectIds.has(p.id),
    );

    if (unassignedProjects.length === 0) {
      return { success: true };
    }

    let backfilledCount = 0;

    for (const project of unassignedProjects as Array<{ id: string; name: string }>) {
      // Create assignment
      const { data: assignment, error: assignError } = await supabase
        .from('client_project_assignments')
        .insert({
          org_id: orgId,
          client_profile_id: sentinelId,
          project_id: project.id,
          assigned_by: context.userId,
        })
        .select('id')
        .single();

      if (assignError || !assignment) {
        // Skip duplicates (idempotent)
        if (assignError?.code === '23505') continue;
        console.error('Backfill assignment error:', assignError);
        continue;
      }

      // Create workflow
      const { data: workflow, error: workflowError } = await supabase
        .from('onboarding_workflows')
        .insert({
          org_id: orgId,
          assignment_id: assignment.id,
        })
        .select('id')
        .single();

      if (workflowError || !workflow) {
        console.error('Backfill workflow error:', workflowError);
        continue;
      }

      // Create default steps
      const stepRows = ONBOARDING_STEP_BLUEPRINTS.map((step, index) => ({
        org_id: orgId,
        workflow_id: workflow.id,
        step_key: step.key,
        title: step.title,
        description: step.description,
        sort_order: index,
      }));

      const { error: stepsError } = await supabase.from('onboarding_steps').insert(stepRows);
      if (stepsError) {
        console.error('Backfill steps error:', stepsError);
        continue;
      }

      backfilledCount++;
    }

    await auditLog({
      orgId,
      actorId: context.userId,
      action: 'onboarding.step_updated',
      targetType: 'backfill',
      metadata: { backfilledCount, totalUnassigned: unassignedProjects.length },
    });

    revalidatePath('/onboarding');
    revalidatePath('/clients');
    return { success: true };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Client detail (per-client page) ──────────────────────────

export type ClientContractSummary = {
  id: string;
  provider: string;
  status: string;
  template_name: string | null;
  signer_email: string | null;
  external_contract_id: string | null;
  signed_at: string | null;
  created_at: string;
  commission_rate: number | null;
  flat_fee: number | null;
};

export type ClientWalkthroughSummary = {
  id: string;
  provider: string;
  status: string;
  meeting_url: string | null;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  created_at: string;
};

export type ClientWelcomeMessageSummary = {
  id: string;
  status: string;
  subject: string;
  sent_at: string | null;
  created_at: string;
};

export type ClientAssignmentDetail = {
  id: string;
  project: OnboardingProjectOption;
  status: string;
  assigned_at: string;
  workflowId: string | null;
  stage: string;
  progressPercent: number;
  steps: OnboardingStepSummary[];
  shareLink: OnboardingShareLinkSummary | null;
  contracts: ClientContractSummary[];
  walkthroughs: ClientWalkthroughSummary[];
  welcomeMessages: ClientWelcomeMessageSummary[];
  inventoryCount: number;
  availableCount: number;
  soldCount: number;
};

export type ClientDetailData = {
  orgId: string;
  client: OnboardingClientProfile;
  projects: OnboardingProjectOption[];
  assignments: ClientAssignmentDetail[];
};

export async function getClientDetail(
  clientId: string,
  userId: string,
  orgId: string,
): Promise<{ data?: ClientDetailData; error?: string }> {
  try {
    const permissionCheck = await requirePermission(orgId, userId, 'onboarding:view');
    if (!permissionCheck.granted) {
      return { error: permissionCheck.error };
    }

    const { data: client, error: clientError } = await supabase
      .from('client_profiles')
      .select('*')
      .eq('id', clientId)
      .eq('org_id', orgId)
      .single();

    if (clientError || !client) {
      return { error: 'Client not found.' };
    }

    const [{ data: projects }, { data: assignments, error: assignmentError }] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, published')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false }),
      supabase
        .from('client_project_assignments')
        .select('id, project_id, status, assigned_at')
        .eq('org_id', orgId)
        .eq('client_profile_id', clientId)
        .order('assigned_at', { ascending: false }),
    ]);

    if (assignmentError) {
      console.error('Supabase error:', assignmentError);
      return { error: 'Failed to load client assignments.' };
    }

    const assignmentRows = (assignments ?? []) as Array<{
      id: string;
      project_id: string;
      status: string;
      assigned_at: string;
    }>;

    const projectList = (projects ?? []) as OnboardingProjectOption[];
    const projectsById = new Map(projectList.map((p) => [p.id, p]));

    if (assignmentRows.length === 0) {
      return {
        data: {
          orgId,
          client: client as OnboardingClientProfile,
          projects: projectList,
          assignments: [],
        },
      };
    }

    const assignmentIds = assignmentRows.map((a) => a.id);
    const projectIds = [...new Set(assignmentRows.map((a) => a.project_id))];

    const [workflowRes, stepRes, shareRes, contractRes, walkthroughRes, welcomeRes, inventoryRes] =
      await Promise.all([
        supabase
          .from('onboarding_workflows')
          .select('id, assignment_id, stage, progress_percent, project_share_status')
          .in('assignment_id', assignmentIds),
        supabase
          .from('onboarding_steps')
          .select('id, workflow_id, step_key, title, description, status, sort_order, completed_at')
          .eq('org_id', orgId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('project_share_links')
          .select('id, assignment_id, status, expires_at, created_at')
          .in('assignment_id', assignmentIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('contracts')
          .select('*')
          .in('assignment_id', assignmentIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('walkthrough_sessions')
          .select('id, assignment_id, provider, status, meeting_url, scheduled_start_at, scheduled_end_at, created_at')
          .in('assignment_id', assignmentIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('welcome_messages')
          .select('id, assignment_id, status, subject, sent_at, created_at')
          .in('assignment_id', assignmentIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('inventory_items')
          .select('project_id, status')
          .in('project_id', projectIds),
      ]);

    const workflowsByAssignment = new Map(
      ((workflowRes.data ?? []) as Array<WorkflowRow & { assignment_id: string }>).map(
        (w) => [w.assignment_id, w],
      ),
    );

    const stepsByWorkflow = new Map<string, OnboardingStepSummary[]>();
    for (const step of (stepRes.data ?? []) as Array<StepRow>) {
      const arr = stepsByWorkflow.get(step.workflow_id) ?? [];
      arr.push({
        id: step.id,
        step_key: step.step_key,
        title: step.title,
        description: step.description,
        status: step.status,
        sort_order: step.sort_order,
        completed_at: step.completed_at,
      });
      stepsByWorkflow.set(step.workflow_id, arr);
    }

    const shareLinksByAssignment = new Map<string, OnboardingShareLinkSummary>();
    for (const link of (shareRes.data ?? []) as Array<OnboardingShareLinkSummary & { assignment_id: string }>) {
      if (!shareLinksByAssignment.has(link.assignment_id)) {
        shareLinksByAssignment.set(link.assignment_id, {
          id: link.id,
          status: link.status,
          expires_at: link.expires_at,
          created_at: link.created_at,
        });
      }
    }

    const contractsByAssignment = new Map<string, ClientContractSummary[]>();
    for (const c of (contractRes.data ?? []) as Array<Record<string, unknown> & { assignment_id: string }>) {
      const arr = contractsByAssignment.get(c.assignment_id) ?? [];
      arr.push({
        id: c.id as string,
        provider: c.provider as string,
        status: c.status as string,
        template_name: (c.template_name as string | null) ?? null,
        signer_email: (c.signer_email as string | null) ?? null,
        external_contract_id: (c.external_contract_id as string | null) ?? null,
        signed_at: (c.signed_at as string | null) ?? null,
        created_at: c.created_at as string,
        commission_rate: c.commission_rate != null ? Number(c.commission_rate) : null,
        flat_fee: c.flat_fee != null ? Number(c.flat_fee) : null,
      });
      contractsByAssignment.set(c.assignment_id, arr);
    }

    const walkthroughsByAssignment = new Map<string, ClientWalkthroughSummary[]>();
    for (const w of (walkthroughRes.data ?? []) as Array<ClientWalkthroughSummary & { assignment_id: string }>) {
      const arr = walkthroughsByAssignment.get(w.assignment_id) ?? [];
      arr.push({
        id: w.id,
        provider: w.provider,
        status: w.status,
        meeting_url: w.meeting_url,
        scheduled_start_at: w.scheduled_start_at,
        scheduled_end_at: w.scheduled_end_at,
        created_at: w.created_at,
      });
      walkthroughsByAssignment.set(w.assignment_id, arr);
    }

    const welcomeByAssignment = new Map<string, ClientWelcomeMessageSummary[]>();
    for (const m of (welcomeRes.data ?? []) as Array<ClientWelcomeMessageSummary & { assignment_id: string }>) {
      const arr = welcomeByAssignment.get(m.assignment_id) ?? [];
      arr.push({
        id: m.id,
        status: m.status,
        subject: m.subject,
        sent_at: m.sent_at,
        created_at: m.created_at,
      });
      welcomeByAssignment.set(m.assignment_id, arr);
    }

    const inventoryByProject = new Map<string, { total: number; available: number; sold: number }>();
    for (const item of (inventoryRes.data ?? []) as Array<{ project_id: string; status: string }>) {
      const stats = inventoryByProject.get(item.project_id) ?? { total: 0, available: 0, sold: 0 };
      stats.total += 1;
      if (item.status === 'available') stats.available += 1;
      if (item.status === 'sold') stats.sold += 1;
      inventoryByProject.set(item.project_id, stats);
    }

    const detailAssignments = assignmentRows
      .map((a): ClientAssignmentDetail | null => {
        const project = projectsById.get(a.project_id);
        if (!project) return null;
        const workflow = workflowsByAssignment.get(a.id);
        const steps = workflow ? stepsByWorkflow.get(workflow.id) ?? [] : [];
        const inv = inventoryByProject.get(project.id) ?? { total: 0, available: 0, sold: 0 };

        return {
          id: a.id,
          project,
          status: a.status,
          assigned_at: a.assigned_at,
          workflowId: workflow?.id ?? null,
          stage: workflow?.stage ?? 'invited',
          progressPercent: workflow?.progress_percent ?? 0,
          steps,
          shareLink: shareLinksByAssignment.get(a.id) ?? null,
          contracts: contractsByAssignment.get(a.id) ?? [],
          walkthroughs: walkthroughsByAssignment.get(a.id) ?? [],
          welcomeMessages: welcomeByAssignment.get(a.id) ?? [],
          inventoryCount: inv.total,
          availableCount: inv.available,
          soldCount: inv.sold,
        };
      })
      .filter((a): a is ClientAssignmentDetail => a !== null);

    return {
      data: {
        orgId,
        client: client as OnboardingClientProfile,
        projects: projectList,
        assignments: detailAssignments,
      },
    };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Org-wide contracts list ──────────────────────────────────

export type OrgContractRow = {
  id: string;
  provider: string;
  status: string;
  template_name: string | null;
  signer_name: string | null;
  signer_email: string | null;
  signed_at: string | null;
  created_at: string;
  commission_rate: number | null;
  clientName: string;
  clientId: string;
  projectName: string;
};

export type OrgContractsData = {
  orgId: string;
  contracts: OrgContractRow[];
};

export async function getOrgContracts(
  userId: string,
  orgId: string | null,
): Promise<{ data?: OrgContractsData; error?: string }> {
  try {
    if (!orgId) {
      return { error: 'No active organization selected.' };
    }

    const permissionCheck = await requirePermission(orgId, userId, 'onboarding:view');
    if (!permissionCheck.granted) {
      return { error: permissionCheck.error };
    }

    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load contracts.' };
    }

    const contractRows = (contracts ?? []) as Array<Record<string, unknown>>;

    if (contractRows.length === 0) {
      return { data: { orgId, contracts: [] } };
    }

    const assignmentIds = [...new Set(contractRows.map((c) => c.assignment_id as string))];

    const { data: assignments, error: assignError } = await supabase
      .from('client_project_assignments')
      .select('id, client_profile_id, project_id')
      .in('id', assignmentIds);

    if (assignError) {
      console.error('Supabase error (assignments):', assignError);
      return { error: 'Failed to load contracts.' };
    }

    const clientIds = [...new Set((assignments ?? []).map((a: { client_profile_id: string }) => a.client_profile_id))];
    const projectIds = [...new Set((assignments ?? []).map((a: { project_id: string }) => a.project_id))];

    let clients: { id: string; full_name: string }[] = [];
    let projects: { id: string; name: string }[] = [];

    if (clientIds.length > 0 || projectIds.length > 0) {
      const [clientRes, projectRes] = await Promise.all([
        clientIds.length > 0
          ? supabase.from('client_profiles').select('id, full_name').in('id', clientIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string }[], error: null }),
        projectIds.length > 0
          ? supabase.from('projects').select('id, name').in('id', projectIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
      ]);

      if (clientRes.error || projectRes.error) {
        console.error('Supabase error (clients/projects):', clientRes.error, projectRes.error);
        return { error: 'Failed to load contracts.' };
      }

      clients = (clientRes.data ?? []) as { id: string; full_name: string }[];
      projects = (projectRes.data ?? []) as { id: string; name: string }[];
    }

    const assignmentMap = new Map(
      (assignments ?? []).map((a: { id: string; client_profile_id: string; project_id: string }) => [a.id, a]),
    );
    const clientMap = new Map(
      clients.map((c: { id: string; full_name: string }) => [c.id, c.full_name]),
    );
    const projectMap = new Map(
      projects.map((p: { id: string; name: string }) => [p.id, p.name]),
    );

    const rows: OrgContractRow[] = contractRows.map((c) => {
      const assignment = assignmentMap.get(c.assignment_id as string) as { client_profile_id: string; project_id: string } | undefined;
      return {
        id: c.id as string,
        provider: c.provider as string,
        status: c.status as string,
        template_name: (c.template_name as string | null) ?? null,
        signer_name: (c.signer_name as string | null) ?? null,
        signer_email: (c.signer_email as string | null) ?? null,
        signed_at: (c.signed_at as string | null) ?? null,
        created_at: c.created_at as string,
        commission_rate: c.commission_rate != null ? Number(c.commission_rate) : null,
        clientName: clientMap.get(assignment?.client_profile_id ?? '') ?? 'Unknown',
        clientId: assignment?.client_profile_id ?? '',
        projectName: projectMap.get(assignment?.project_id ?? '') ?? 'Unknown',
      };
    });

    return { data: { orgId, contracts: rows } };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error: 'An unexpected error occurred.' };
  }
}