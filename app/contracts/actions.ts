'use server';

import { revalidatePath } from 'next/cache';

import { auditLog, requirePermission, resolveActiveOrgId } from '@/lib/rbac';
import type { Permission } from '@/lib/rbac-types';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { createClient } from '@/utils/supabase/server';

// ── Types ────────────────────────────────────────────────────

export type ContractTemplateRow = {
  id: string;
  org_id: string;
  name: string;
  agreement_type: string;
  docuseal_template_id: number | null;
  docuseal_slug: string | null;
  preview_url: string | null;
  document_urls: { url: string; filename?: string }[];
  status: 'active' | 'archived';
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ActionResult = { success?: boolean; error?: string };

// ── Helpers ──────────────────────────────────────────────────

async function getActionContext(permission: Permission): Promise<
  | { error: string }
  | { userId: string; orgId: string }
> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return { error: 'You must be signed in.' };
  }

  const orgId = await resolveActiveOrgId(user.id);
  if (!orgId) {
    return { error: 'Select an organization first.' };
  }

  const check = await requirePermission(orgId, user.id, permission);
  if (!check.granted) {
    return { error: check.error };
  }

  return { userId: user.id, orgId };
}

// ── List templates ───────────────────────────────────────────

export async function getContractTemplates(
  includeArchived = false,
): Promise<{ data?: ContractTemplateRow[]; error?: string }> {
  const context = await getActionContext('onboarding:view');
  if ('error' in context) return { error: context.error };

  try {
    let query = supabase
      .from('contract_templates')
      .select('*')
      .eq('org_id', context.orgId)
      .order('created_at', { ascending: false });

    if (!includeArchived) {
      query = query.eq('status', 'active');
    }

    const { data, error } = await query;
    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load contract templates.' };
    }

    return { data: (data ?? []) as ContractTemplateRow[] };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Get single template ──────────────────────────────────────

export async function getContractTemplate(
  templateId: string,
): Promise<{ data?: ContractTemplateRow; error?: string }> {
  const context = await getActionContext('onboarding:view');
  if ('error' in context) return { error: context.error };

  try {
    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('id', templateId)
      .eq('org_id', context.orgId)
      .single();

    if (error || !data) {
      return { error: 'Template not found.' };
    }

    return { data: data as ContractTemplateRow };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Create / upsert template ─────────────────────────────────

export async function upsertContractTemplate(formData: FormData): Promise<ActionResult & { data?: { templateId: string } }> {
  const context = await getActionContext('onboarding:update');
  if ('error' in context) return { error: context.error };

  const templateId = (formData.get('template_id') as string | null)?.trim() ?? '';
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const agreementType = (formData.get('agreement_type') as string | null)?.trim() || 'estate_sale';
  const docusealTemplateId = formData.get('docuseal_template_id') as string | null;
  const docusealSlug = (formData.get('docuseal_slug') as string | null)?.trim() ?? null;
  const previewUrl = (formData.get('preview_url') as string | null)?.trim() ?? null;
  const documentUrlsRaw = (formData.get('document_urls') as string | null)?.trim() ?? '[]';

  if (!name) {
    return { error: 'Template name is required.' };
  }

  let documentUrls: unknown[];
  try {
    documentUrls = JSON.parse(documentUrlsRaw) as unknown[];
  } catch {
    documentUrls = [];
  }

  try {
    if (templateId) {
      // Update existing
      const { data: existing } = await supabase
        .from('contract_templates')
        .select('id')
        .eq('id', templateId)
        .eq('org_id', context.orgId)
        .single();

      if (!existing) {
        return { error: 'Template not found.' };
      }

      const { error: updateError } = await supabase
        .from('contract_templates')
        .update({
          name,
          agreement_type: agreementType,
          docuseal_template_id: docusealTemplateId ? Number(docusealTemplateId) : null,
          docuseal_slug: docusealSlug,
          preview_url: previewUrl,
          document_urls: JSON.stringify(documentUrls),
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId)
        .eq('org_id', context.orgId);

      if (updateError) {
        console.error('Supabase error:', updateError);
        return { error: 'Failed to update template.' };
      }

      await auditLog({
        orgId: context.orgId,
        actorId: context.userId,
        action: 'contracts.template_updated',
        targetType: 'contract_template',
        targetId: templateId,
        metadata: { name },
      });

      revalidatePath('/contracts');
      return { success: true, data: { templateId } };
    }

    // Create new
    const { data: row, error: insertError } = await supabase
      .from('contract_templates')
      .insert({
        org_id: context.orgId,
        name,
        agreement_type: agreementType,
        docuseal_template_id: docusealTemplateId ? Number(docusealTemplateId) : null,
        docuseal_slug: docusealSlug,
        preview_url: previewUrl,
        document_urls: JSON.stringify(documentUrls),
        created_by: context.userId,
      })
      .select('id')
      .single();

    if (insertError || !row) {
      console.error('Supabase error:', insertError);
      return { error: 'Failed to create template.' };
    }

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'contracts.template_created',
      targetType: 'contract_template',
      targetId: row.id as string,
      metadata: { name },
    });

    revalidatePath('/contracts');
    return { success: true, data: { templateId: row.id as string } };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Archive template ─────────────────────────────────────────

export async function archiveContractTemplate(
  templateId: string,
): Promise<ActionResult> {
  const context = await getActionContext('onboarding:update');
  if ('error' in context) return { error: context.error };

  if (!templateId) return { error: 'Missing template ID.' };

  try {
    const { data: existing } = await supabase
      .from('contract_templates')
      .select('id, status')
      .eq('id', templateId)
      .eq('org_id', context.orgId)
      .single();

    if (!existing) {
      return { error: 'Template not found.' };
    }

    const { error } = await supabase
      .from('contract_templates')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('org_id', context.orgId);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to archive template.' };
    }

    await auditLog({
      orgId: context.orgId,
      actorId: context.userId,
      action: 'contracts.template_archived',
      targetType: 'contract_template',
      targetId: templateId,
    });

    revalidatePath('/contracts');
    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Generate builder token (used by embedded builder page) ───

export async function getBuilderToken(opts: {
  docusealTemplateId?: number;
  documentUrls?: string[];
  name?: string;
}): Promise<{ token?: string; error?: string }> {
  const context = await getActionContext('onboarding:update');
  if ('error' in context) return { error: context.error };

  try {
    const { generateBuilderToken } = await import('@/lib/docuseal');
    const token = await generateBuilderToken({
      templateId: opts.docusealTemplateId,
      documentUrls: opts.documentUrls,
      name: opts.name,
    });
    return { token };
  } catch (err) {
    console.error('Failed to generate builder token:', err);
    return { error: 'Failed to initialize template editor.' };
  }
}
