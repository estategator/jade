import 'server-only';

import {
  getWorkflowProgressPercent,
  getWorkflowStage,
  type OnboardingStepRecord,
} from '@/lib/onboarding';
import {
  getContractAdapter,
  type ContractProvider,
} from '@/lib/onboarding-providers/contracts';
import {
  getSchedulingAdapter,
  type SchedulingProvider,
} from '@/lib/onboarding-providers/scheduling';
import { logProjectTransparencyEvent } from '@/lib/project-transparency';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

export type ContractWebhookPayload = {
  provider: ContractProvider;
  rawPayload: Record<string, unknown>;
};

export type WalkthroughWebhookPayload = {
  provider: SchedulingProvider;
  rawPayload: Record<string, unknown>;
};

async function refreshWorkflowState(
  workflowId: string,
  overrides?: Partial<{
    contractStatus: string;
    walkthroughStatus: string;
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

  const { error: workflowError } = await supabase
    .from('onboarding_workflows')
    .update(updatePayload)
    .eq('id', workflowId);

  if (workflowError) {
    console.error('Failed to update onboarding workflow:', workflowError);
  }
}

export async function processContractWebhook(payload: ContractWebhookPayload): Promise<void> {
  const adapter = getContractAdapter(payload.provider);
  const event = adapter.normalizeWebhookEvent(payload.rawPayload);
  if (!event) {
    console.warn('[contract-webhook] Could not normalize event:', payload.provider);
    return;
  }

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

  const statusOrder = ['draft', 'sent', 'viewed', 'signed', 'declined', 'voided', 'expired'] as const;
  const currentIdx = statusOrder.indexOf(contract.status as typeof statusOrder[number]);
  const newIdx = statusOrder.indexOf(event.normalizedStatus);
  if (newIdx <= currentIdx && event.normalizedStatus !== 'declined' && event.normalizedStatus !== 'voided') {
    console.log('[contract-webhook] Skipping duplicate/older event:', event.normalizedStatus, 'current:', contract.status);
    return;
  }

  await supabase.from('contract_events').insert({
    org_id: contract.org_id,
    contract_id: contract.id,
    event_type: event.eventType,
    payload: event.rawPayload,
  });

  const contractUpdate: Record<string, unknown> = {
    status: event.normalizedStatus,
    updated_at: new Date().toISOString(),
  };
  if (event.normalizedStatus === 'signed') {
    contractUpdate.signed_at = event.timestamp;
  }
  await supabase.from('contracts').update(contractUpdate).eq('id', contract.id);

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

export async function processWalkthroughWebhook(payload: WalkthroughWebhookPayload): Promise<void> {
  const adapter = getSchedulingAdapter(payload.provider);
  const event = adapter.normalizeWebhookEvent(payload.rawPayload);
  if (!event) {
    console.warn('[walkthrough-webhook] Could not normalize event:', payload.provider);
    return;
  }

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

  await supabase.from('walkthrough_events').insert({
    org_id: session.org_id,
    walkthrough_id: session.id,
    event_type: event.eventType,
    payload: event.rawPayload,
  });

  const sessionUpdate: Record<string, unknown> = {
    status: event.normalizedStatus,
    updated_at: new Date().toISOString(),
  };
  if (event.scheduledStartAt) sessionUpdate.scheduled_start_at = event.scheduledStartAt;
  if (event.scheduledEndAt) sessionUpdate.scheduled_end_at = event.scheduledEndAt;
  if (event.meetingUrl) sessionUpdate.meeting_url = event.meetingUrl;

  await supabase.from('walkthrough_sessions').update(sessionUpdate).eq('id', session.id);

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
        title: 'Walkthrough scheduled',
        body: 'A walkthrough has been scheduled with the client.',
        payload: { walkthrough_id: session.id },
      });
    }
  }
}