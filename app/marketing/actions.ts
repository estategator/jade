'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { requirePermission, requireOrgMembership, auditLog } from '@/lib/rbac';
import { generateText, generateImage } from 'ai';
import { openai } from '@/lib/openai';

// ── Types ────────────────────────────────────────────────────

export type MarketingAsset = {
  id: string;
  org_id: string;
  project_id: string | null;
  created_by: string;
  template_id: string;
  title: string;
  headline: string;
  body: string;
  cta: string;
  source_image_url: string | null;
  generated_image_url: string | null;
  status: 'draft' | 'generating' | 'ready' | 'failed';
  created_at: string;
  updated_at: string;
  project?: { id: string; name: string } | null;
};

export type SourceImage = {
  url: string;
  label: string;
  type: 'organization' | 'project' | 'inventory';
  entityId: string;
};

// ── Source image helpers ──────────────────────────────────────

export async function getMarketingSourceImages(
  userId: string,
  orgId: string
): Promise<{ data?: SourceImage[]; error?: string }> {
  const membership = await requireOrgMembership(orgId, userId);
  if ('error' in membership) return { error: membership.error };

  const images: SourceImage[] = [];

  // 1. Organization cover image
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, cover_image_url')
    .eq('id', orgId)
    .single();

  if (org?.cover_image_url) {
    images.push({
      url: org.cover_image_url,
      label: `${org.name} (Org Cover)`,
      type: 'organization',
      entityId: org.id,
    });
  }

  // 2. Project cover images for this org
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, cover_image_url')
    .eq('org_id', orgId)
    .not('cover_image_url', 'is', null);

  for (const proj of projects ?? []) {
    if (proj.cover_image_url) {
      images.push({
        url: proj.cover_image_url,
        label: `${proj.name} (Project)`,
        type: 'project',
        entityId: proj.id,
      });
    }
  }

  // 3. Inventory item images (medium resolution) from this org
  const { data: items } = await supabase
    .from('inventory_items')
    .select('id, name, medium_image_url')
    .eq('org_id', orgId)
    .not('medium_image_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  for (const item of items ?? []) {
    if (item.medium_image_url) {
      images.push({
        url: item.medium_image_url,
        label: item.name,
        type: 'inventory',
        entityId: item.id,
      });
    }
  }

  return { data: images };
}

// ── CRUD actions ─────────────────────────────────────────────

export async function getMarketingAssets(
  userId: string,
  orgId: string,
  projectId?: string | null
): Promise<{ data?: MarketingAsset[]; error?: string }> {
  const check = await requirePermission(orgId, userId, 'marketing:view');
  if (!check.granted) return { error: check.error };

  let query = supabase
    .from('marketing_assets')
    .select('*, project:projects(id, name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (projectId) {
    // Validate project belongs to this org
    const { data: proj } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('org_id', orgId)
      .single();
    if (!proj) return { error: 'Project not found in this organization.' };
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('getMarketingAssets error:', error);
    return { error: 'Failed to load marketing assets.' };
  }

  // Resolve private storage paths to signed URLs
  const assets = await Promise.all(
    (data ?? []).map((a) => resolveAssetImageUrl(a as MarketingAsset))
  );

  return { data: assets };
}

export async function createMarketingAsset(
  formData: FormData
): Promise<{ data?: MarketingAsset; error?: string }> {
  const orgId = formData.get('org_id') as string;
  const userId = formData.get('user_id') as string;
  const projectId = (formData.get('project_id') as string) || null;
  const templateId = formData.get('template_id') as string;
  const title = formData.get('title') as string;
  const headline = formData.get('headline') as string;
  const body = formData.get('body') as string;
  const cta = formData.get('cta') as string;
  const sourceImageUrl = (formData.get('source_image_url') as string) || null;

  if (!orgId) return { error: 'Organization is required.' };
  if (!userId) return { error: 'User not authenticated.' };
  if (!templateId) return { error: 'Template is required.' };
  if (!title?.trim()) return { error: 'Title is required.' };

  // Permission check
  const check = await requirePermission(orgId, userId, 'marketing:create');
  if (!check.granted) return { error: check.error };

  // Validate project belongs to this org if specified
  if (projectId) {
    const { data: proj } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('org_id', orgId)
      .single();
    if (!proj) return { error: 'Project not found in this organization.' };
  }

  // Validate source image belongs to this org (if it's an org/project image URL)
  if (sourceImageUrl) {
    const isOrgImage = await validateSourceImageBelongsToOrg(sourceImageUrl, orgId);
    if (!isOrgImage) return { error: 'Selected image does not belong to this organization.' };
  }

  const { data, error } = await supabase
    .from('marketing_assets')
    .insert({
      org_id: orgId,
      project_id: projectId,
      created_by: userId,
      template_id: templateId,
      title: title.trim(),
      headline: headline?.trim() ?? '',
      body: body?.trim() ?? '',
      cta: cta?.trim() ?? '',
      source_image_url: sourceImageUrl,
      status: 'draft',
    })
    .select('*, project:projects(id, name)')
    .single();

  if (error) {
    console.error('createMarketingAsset error:', error);
    return { error: 'Failed to create marketing asset.' };
  }

  await auditLog({
    orgId,
    actorId: userId,
    action: 'marketing.created',
    targetType: 'marketing_asset',
    targetId: data.id,
  });

  revalidatePath('/marketing');
  return { data: data as MarketingAsset };
}

export async function updateMarketingAsset(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const orgId = formData.get('org_id') as string;
  const userId = formData.get('user_id') as string;
  const title = formData.get('title') as string;
  const headline = formData.get('headline') as string;
  const body = formData.get('body') as string;
  const cta = formData.get('cta') as string;
  const sourceImageUrl = (formData.get('source_image_url') as string) || null;

  if (!orgId || !userId) return { error: 'Missing required context.' };

  const check = await requirePermission(orgId, userId, 'marketing:update');
  if (!check.granted) return { error: check.error };

  // Verify asset belongs to this org
  const { data: existing } = await supabase
    .from('marketing_assets')
    .select('id, org_id')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (!existing) return { error: 'Marketing asset not found.' };

  if (sourceImageUrl) {
    const isOrgImage = await validateSourceImageBelongsToOrg(sourceImageUrl, orgId);
    if (!isOrgImage) return { error: 'Selected image does not belong to this organization.' };
  }

  const { error } = await supabase
    .from('marketing_assets')
    .update({
      title: title?.trim() ?? '',
      headline: headline?.trim() ?? '',
      body: body?.trim() ?? '',
      cta: cta?.trim() ?? '',
      source_image_url: sourceImageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('updateMarketingAsset error:', error);
    return { error: 'Failed to update marketing asset.' };
  }

  await auditLog({
    orgId,
    actorId: userId,
    action: 'marketing.updated',
    targetType: 'marketing_asset',
    targetId: id,
  });

  revalidatePath('/marketing');
  return {};
}

export async function deleteMarketingAsset(
  id: string,
  orgId: string,
  userId: string
): Promise<{ error?: string }> {
  const check = await requirePermission(orgId, userId, 'marketing:delete');
  if (!check.granted) return { error: check.error };

  // Verify asset belongs to this org
  const { data: existing } = await supabase
    .from('marketing_assets')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (!existing) return { error: 'Marketing asset not found.' };

  const { error } = await supabase
    .from('marketing_assets')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('deleteMarketingAsset error:', error);
    return { error: 'Failed to delete marketing asset.' };
  }

  await auditLog({
    orgId,
    actorId: userId,
    action: 'marketing.deleted',
    targetType: 'marketing_asset',
    targetId: id,
  });

  revalidatePath('/marketing');
  return {};
}

// ── Single asset fetch ───────────────────────────────────────

export async function getMarketingAsset(
  id: string,
  userId: string,
  orgId: string
): Promise<{ data?: MarketingAsset; error?: string }> {
  const check = await requirePermission(orgId, userId, 'marketing:view');
  if (!check.granted) return { error: check.error };

  const { data, error } = await supabase
    .from('marketing_assets')
    .select('*, project:projects(id, name)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (error || !data) return { error: 'Marketing asset not found.' };

  const resolved = await resolveAssetImageUrl(data as MarketingAsset);
  return { data: resolved };
}

// ── AI generation ────────────────────────────────────────────

export type GeneratedContent = {
  headline: string;
  body: string;
  cta: string;
};

export async function generateMarketingContent(
  assetId: string,
  orgId: string,
  userId: string,
  prompt: string
): Promise<{ data?: GeneratedContent; error?: string }> {
  const check = await requirePermission(orgId, userId, 'marketing:update');
  if (!check.granted) return { error: check.error };

  // Fetch the asset
  const { data: asset } = await supabase
    .from('marketing_assets')
    .select('*')
    .eq('id', assetId)
    .eq('org_id', orgId)
    .single();

  if (!asset) return { error: 'Marketing asset not found.' };

  // Update status to generating
  await supabase
    .from('marketing_assets')
    .update({ status: 'generating', updated_at: new Date().toISOString() })
    .eq('id', assetId);

  try {
    if (process.env.AI_NOT_AVAILABLE_FOR_TESTING === 'true') {
      // Mock AI response for testing
      await new Promise((r) => setTimeout(r, 800));
      const generated: GeneratedContent = {
        headline: `${asset.title} — Don't Miss Out!`,
        body: `Discover amazing deals at our estate sale. ${prompt ? `Focus: ${prompt}` : 'Quality items at unbeatable prices.'}`,
        cta: 'Shop Now',
      };

      await supabase
        .from('marketing_assets')
        .update({
          headline: generated.headline,
          body: generated.body,
          cta: generated.cta,
          status: 'ready',
          updated_at: new Date().toISOString(),
        })
        .eq('id', assetId);

      revalidatePath('/marketing');
      revalidatePath(`/marketing/${assetId}/edit`);
      return { data: generated };
    }

    const templateInfo = asset.template_id ? ` Template type: ${asset.template_id}.` : '';
    const existingContext = [
      asset.headline && `Current headline: "${asset.headline}"`,
      asset.body && `Current body: "${asset.body}"`,
      asset.cta && `Current CTA: "${asset.cta}"`,
    ]
      .filter(Boolean)
      .join('. ');

    const systemPrompt = `You are an expert marketing copywriter for estate sales and antique shops. Generate compelling marketing copy.${templateInfo}

Return ONLY a JSON object with these fields:
- "headline": A catchy, concise headline (max 80 chars)
- "body": Engaging body copy (2-3 sentences, max 280 chars)
- "cta": A short call-to-action button text (max 20 chars)

No markdown, no code fences. Just the JSON object.`;

    const userPrompt = prompt
      ? `Generate marketing copy based on this direction: ${prompt}\n\n${existingContext ? `Context: ${existingContext}` : ''}`
      : `Generate fresh marketing copy for an estate sale material titled "${asset.title}".${existingContext ? ` ${existingContext}` : ''}`;

    const response = await generateText({
      model: openai('gpt-5.4-2026-03-05'),

      system: systemPrompt,
      prompt: userPrompt,
    });

    const content = response.text ?? '';
    const cleaned = content.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const generated = JSON.parse(cleaned) as GeneratedContent;

    await supabase
      .from('marketing_assets')
      .update({
        headline: generated.headline,
        body: generated.body,
        cta: generated.cta,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId);

    revalidatePath('/marketing');
    revalidatePath(`/marketing/${assetId}/edit`);
    return { data: generated };
  } catch (err) {
    console.error('AI generation error:', err);
    await supabase
      .from('marketing_assets')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', assetId);
    return { error: 'AI generation failed. Please try again.' };
  }
}

export async function generateMarketingImage(
  assetId: string,
  orgId: string,
  userId: string,
  imagePrompt: string
): Promise<{ imageUrl?: string; error?: string }> {
  const check = await requirePermission(orgId, userId, 'marketing:update');
  if (!check.granted) return { error: check.error };

  const { data: asset } = await supabase
    .from('marketing_assets')
    .select('*')
    .eq('id', assetId)
    .eq('org_id', orgId)
    .single();

  if (!asset) return { error: 'Marketing asset not found.' };

  await supabase
    .from('marketing_assets')
    .update({ status: 'generating', updated_at: new Date().toISOString() })
    .eq('id', assetId);

  try {
    if (process.env.AI_NOT_AVAILABLE_FOR_TESTING === 'true') {
      await new Promise((r) => setTimeout(r, 1000));
      // In mock mode, use the source image if available, otherwise generate
      // a data URI placeholder that doesn't require remote image config
      const mockUrl = asset.source_image_url ?? null;
      await supabase
        .from('marketing_assets')
        .update({
          generated_image_url: mockUrl,
          status: 'ready',
          updated_at: new Date().toISOString(),
        })
        .eq('id', assetId);

      revalidatePath('/marketing');
      revalidatePath(`/marketing/${assetId}/edit`);
      return { imageUrl: mockUrl };
    }

    const templateInfo = asset.template_id ? `Template: ${asset.template_id}. ` : '';
    const fullPrompt = `${templateInfo}Create a professional marketing image for an estate sale. ${imagePrompt}. Style: clean, modern, professional marketing material. Do not include any text in the image.`;

    const response = await generateImage({
      model: openai.image('dall-e-3'),
      prompt: fullPrompt,
      size: '1024x1024',
      providerOptions: { openai: { quality: 'standard' } },
    });

    const imageBuffer = Buffer.from(response.image.uint8Array);

    const storagePath = `${orgId}/${assetId}/generated.webp`;

    // Normalize to webp using sharp
    const { normalizeSourceImage } = await import('@/lib/image-processing');
    const normalized = await normalizeSourceImage(imageBuffer);

    const { error: uploadError } = await supabase.storage
      .from('marketing-images')
      .upload(storagePath, normalized, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadError) {
      console.error('Marketing image upload error:', uploadError);
      throw new Error('Failed to upload generated image');
    }

    // Store the storage path (not a public URL) — bucket is private/org-restricted
    const signedUrl = await getSignedImageUrl(storagePath);

    await supabase
      .from('marketing_assets')
      .update({
        generated_image_url: storagePath,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId);

    revalidatePath('/marketing');
    revalidatePath(`/marketing/${assetId}/edit`);
    return { imageUrl: signedUrl ?? undefined };
  } catch (err) {
    console.error('AI image generation error:', err);
    await supabase
      .from('marketing_assets')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', assetId);
    return { error: 'Image generation failed. Please try again.' };
  }
}

// ── Helpers ──────────────────────────────────────────────────

const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour

/**
 * Generate a signed URL for a private marketing-images storage path.
 * Returns null if the path is empty or signing fails.
 */
async function getSignedImageUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;

  // If it's already a full URL (legacy data or source images), return as-is
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return storagePath;
  }

  const { data, error } = await supabase.storage
    .from('marketing-images')
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    console.error('Failed to create signed URL:', error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Resolve generated_image_url storage paths to signed URLs on a marketing asset.
 */
async function resolveAssetImageUrl(asset: MarketingAsset): Promise<MarketingAsset> {
  if (!asset.generated_image_url) return asset;
  const signedUrl = await getSignedImageUrl(asset.generated_image_url);
  return { ...asset, generated_image_url: signedUrl };
}

async function validateSourceImageBelongsToOrg(
  imageUrl: string,
  orgId: string
): Promise<boolean> {
  // Check org cover image
  const { data: org } = await supabase
    .from('organizations')
    .select('cover_image_url')
    .eq('id', orgId)
    .single();
  if (org?.cover_image_url === imageUrl) return true;

  // Check project cover images
  const { data: projects } = await supabase
    .from('projects')
    .select('cover_image_url')
    .eq('org_id', orgId)
    .not('cover_image_url', 'is', null);
  if (projects?.some((p) => p.cover_image_url === imageUrl)) return true;

  // Check inventory item images
  const { data: items } = await supabase
    .from('inventory_items')
    .select('medium_image_url')
    .eq('org_id', orgId)
    .not('medium_image_url', 'is', null);
  if (items?.some((i) => i.medium_image_url === imageUrl)) return true;

  return false;
}
