'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { processItemImage, analyzeUploadedSimpleImage, normalizeSourceImage } from '@/lib/image-processing';
import { requireOrgMembership, requirePermission, auditLog } from '@/lib/rbac';
import { enqueue, TOPICS } from '@/lib/queue';

export type AIAnalysisResult = {
  name: string;
  description: string;
  category: string;
  condition: string;
  price: number;
  pricePerCondition?: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
};

export type InventoryItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  condition: string;
  status: 'available' | 'sold' | 'reserved';
  quantity: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  project_id: string;
  original_image_url: string | null;
  thumbnail_url: string | null;
  medium_image_url: string | null;
  processing_status: 'none' | 'queued' | 'processing' | 'complete' | 'failed';
  ai_insights: AIAnalysisResult | null;
  project?: { id: string; name: string; org_id: string; organizations?: { name: string; stripe_onboarding_complete?: boolean } };
};

// Helper: verify user has access to an item via org membership
async function verifyItemOwnership(userId: string, itemId: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const { data: item, error: itemErr } = await supabase
      .from('inventory_items')
      .select('project_id')
      .eq('id', itemId)
      .single();

    if (itemErr || !item) {
      return { valid: false, error: 'Item not found.' };
    }

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('org_id')
      .eq('id', item.project_id)
      .single();

    if (projErr || !project) {
      return { valid: false, error: 'Project not found.' };
    }

    const { data: membership, error: memErr } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .eq('org_id', project.org_id)
      .single();

    if (memErr && memErr.code !== 'PGRST116') {
      return { valid: false, error: 'Permission check failed.' };
    }

    const isValid = !!membership;
    return { valid: isValid, ...(isValid ? {} : { error: 'You do not have access to this item.' }) };
  } catch (err) {
    console.error('Unexpected error in ownership check:', err);
    return { valid: false, error: 'Permission check failed.' };
  }
}

export type UserProject = {
  id: string;
  name: string;
  org_id: string;
  org_name: string;
};

const INVENTORY_REVALIDATE_PATHS = ['/inventory', '/inventory/add', '/inventory/bulk'] as const;

async function getAccessibleOrgIds(
  userId: string
): Promise<{ data: string[]; error?: undefined } | { data?: undefined; error: string }> {
  const { data: memberships, error: memErr } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId);

  if (memErr) {
    console.error('Supabase error:', memErr);
    return { error: 'Failed to load inventory.' };
  }

  return { data: (memberships ?? []).map((m) => m.org_id) };
}

function revalidateInventoryRoutes() {
  // Revalidate the inventory layout segment so list/add/bulk/edit pages are refreshed.
  revalidatePath('/inventory', 'layout');
  for (const path of INVENTORY_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

export async function getUserProjects(userId: string, orgId?: string | null) {
  try {
    const orgIdsResult = await getAccessibleOrgIds(userId);
    if (orgIdsResult.error) {
      return { error: 'Failed to load projects.' };
    }

    const orgIds = orgIdsResult.data ?? [];
    if (!orgIds.length) return { data: [] as UserProject[] };

    // Filter by specific org if provided
    const filteredOrgIds = orgId ? orgIds.filter((id) => id === orgId) : orgIds;
    if (orgId && !filteredOrgIds.length) return { data: [] as UserProject[] };

    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id, name, org_id, organizations(name)')
      .in('org_id', filteredOrgIds)
      .order('name', { ascending: true });

    if (projErr) {
      console.error('Supabase error:', projErr);
      return { error: 'Failed to load projects.' };
    }

    const result: UserProject[] = (projects ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      name: p.name as string,
      org_id: p.org_id as string,
      org_name: ((p.organizations as Record<string, unknown>)?.name as string) ?? '',
    }));

    return { data: result };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getInventoryItems(userId: string, orgId?: string | null) {
  try {
    const orgIdsResult = await getAccessibleOrgIds(userId);
    if (orgIdsResult.error) {
      return { error: 'Failed to load inventory.' };
    }

    const orgIds = orgIdsResult.data ?? [];
    if (!orgIds.length) return { data: [] as InventoryItem[] };

    // Filter by specific org if provided
    const filteredOrgIds = orgId ? orgIds.filter((id) => id === orgId) : orgIds;
    if (orgId && !filteredOrgIds.length) return { data: [] as InventoryItem[] };

    // Resolve project IDs up front to avoid relying on embedded relation filtering semantics.
    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id')
      .in('org_id', filteredOrgIds);

    if (projErr) {
      console.error('Supabase error:', projErr);
      return { error: 'Failed to load inventory.' };
    }

    const projectIds = (projects ?? []).map((p) => p.id);
    if (!projectIds.length) return { data: [] as InventoryItem[] };

    // Get inventory items for user's orgs
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*, project:projects(id, name, org_id, organizations(name, stripe_onboarding_complete))')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load inventory.' };
    }

    return { data: data as InventoryItem[] };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getInventoryItem(id: string, userId: string) {
  try {
    // Verify ownership first
    const ownershipCheck = await verifyItemOwnership(userId, id);
    if (!ownershipCheck.valid) {
      return { error: ownershipCheck.error || 'Item not found.' };
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*, project:projects(id, name, org_id, organizations(name, stripe_onboarding_complete))')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Item not found.' };
    }

    return { data: data as InventoryItem };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/** Public-safe item fetch — no auth required. Returns only buyer-visible fields. */
export async function getPublicInventoryItem(id: string) {
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id, name, description, category, price, condition, status, quantity, medium_image_url, thumbnail_url, original_image_url, ai_insights, created_at, project:projects(name, organizations(name))')
      .eq('id', id)
      .single();

    if (error || !data) {
      return { error: 'Item not found.' };
    }

    return { data };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function createInventoryItem(formData: FormData) {
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const category = formData.get('category') as string;
  const price = parseFloat(formData.get('price') as string);
  const condition = formData.get('condition') as string;
  const userId = formData.get('user_id') as string;
  const projectId = formData.get('project_id') as string;
  const imageFile = formData.get('image') as File | null;
  const quantity = parseInt(formData.get('quantity') as string, 10);

  if (!name) return { error: 'Name is required.' };
  if (isNaN(price) || price < 0) return { error: 'Valid price is required.' };
  if (!projectId) return { error: 'Project is required.' };

  // Resolve project's org and enforce membership + permission
  const { data: project, error: projLookupErr } = await supabase
    .from('projects')
    .select('org_id')
    .eq('id', projectId)
    .single();

  if (projLookupErr || !project) return { error: 'Project not found.' };

  const permCheck = await requirePermission(project.org_id, userId, 'inventory:create');
  if (!permCheck.granted) return { error: permCheck.error };

  const hasImage = imageFile && imageFile.size > 0;

  try {
    const { data: item, error } = await supabase
      .from('inventory_items')
      .insert({
        name,
        description: description || '',
        category: category || 'Uncategorized',
        price,
        condition: condition || 'Good',
        status: 'available',
        quantity: isNaN(quantity) || quantity < 1 ? 1 : quantity,
        user_id: userId,
        org_id: project.org_id,
        project_id: projectId,
        processing_status: hasImage ? 'queued' : 'none',
      })
      .select('id')
      .single();

    if (error || !item) {
      console.error('Supabase error:', error);
      return { error: 'Failed to add item. Please try again.' };
    }

    if (hasImage) {
      const storagePath = `${item.id}/source.webp`;
      const rawBuffer = Buffer.from(await imageFile.arrayBuffer());
      const sourceBuffer = await normalizeSourceImage(rawBuffer);

      const { error: uploadError } = await supabase.storage
        .from('inventory-images')
        .upload(storagePath, sourceBuffer, { contentType: 'image/webp' });

      if (uploadError) {
        console.error('Image upload error:', uploadError);
        await supabase
          .from('inventory_items')
          .update({ processing_status: 'failed' })
          .eq('id', item.id);
        return { success: true };
      }

      const { data: { publicUrl } } = supabase.storage
        .from('inventory-images')
        .getPublicUrl(storagePath);

      await supabase
        .from('inventory_items')
        .update({ original_image_url: publicUrl })
        .eq('id', item.id);

      await enqueue(
        TOPICS.PROCESS_IMAGE,
        { itemId: item.id, storagePath },
        async (data) => processItemImage(data.itemId, data.storagePath),
      );
    }

    revalidateInventoryRoutes();

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function updateInventoryItem(id: string, userId: string, formData: FormData) {
  // Verify ownership first
  const ownershipCheck = await verifyItemOwnership(userId, id);
  if (!ownershipCheck.valid) {
    return { error: ownershipCheck.error || 'Failed to update item.' };
  }

  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const category = formData.get('category') as string;
  const price = parseFloat(formData.get('price') as string);
  const condition = formData.get('condition') as string;
  const status = formData.get('status') as string;
  const projectId = formData.get('project_id') as string;
  const quantity = parseInt(formData.get('quantity') as string, 10);

  if (!name) return { error: 'Name is required.' };
  if (isNaN(price) || price < 0) return { error: 'Valid price is required.' };
  if (!projectId) return { error: 'Project is required.' };

  try {
    const { error } = await supabase
      .from('inventory_items')
      .update({
        name,
        description: description || '',
        category: category || 'Uncategorized',
        price,
        condition: condition || 'Good',
        status: status || 'available',
        quantity: isNaN(quantity) || quantity < 1 ? 1 : quantity,
        project_id: projectId,
        ...(status === 'sold' ? { sold_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to update item. Please try again.' };
    }

    revalidateInventoryRoutes();

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function deleteInventoryItem(id: string, userId: string) {
  // Verify ownership first
  const ownershipCheck = await verifyItemOwnership(userId, id);
  if (!ownershipCheck.valid) {
    return { error: ownershipCheck.error || 'Failed to delete item.' };
  }

  try {
    // Remove all storage objects for this item before deleting the DB row
    const { data: files } = await supabase.storage
      .from('inventory-images')
      .list(id);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${id}/${f.name}`);
      await supabase.storage.from('inventory-images').remove(paths);
    }

    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to delete item.' };
    }

    revalidateInventoryRoutes();

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function bulkDeleteInventoryItems(ids: string[], userId: string) {
  if (!ids.length) return { error: 'No items selected.' };

  try {
    // Verify ownership for each item
    for (const id of ids) {
      const check = await verifyItemOwnership(userId, id);
      if (!check.valid) return { error: check.error || 'Permission denied for one or more items.' };
    }

    // Remove storage objects for each item
    for (const id of ids) {
      const { data: files } = await supabase.storage
        .from('inventory-images')
        .list(id);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${id}/${f.name}`);
        await supabase.storage.from('inventory-images').remove(paths);
      }
    }

    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to delete items.' };
    }

    revalidateInventoryRoutes();
    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function bulkUpdateInventoryStatus(
  ids: string[],
  userId: string,
  status: 'available' | 'sold' | 'reserved',
) {
  if (!ids.length) return { error: 'No items selected.' };

  try {
    for (const id of ids) {
      const check = await verifyItemOwnership(userId, id);
      if (!check.valid) return { error: check.error || 'Permission denied for one or more items.' };
    }

    const { error } = await supabase
      .from('inventory_items')
      .update({
        status,
        ...(status === 'sold' ? { sold_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      })
      .in('id', ids);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to update items.' };
    }

    revalidateInventoryRoutes();
    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export type BulkItemInput = {
  name: string;
  description: string;
  category: string;
  price: number;
  condition: string;
  user_id: string;
  project_id?: string | null;
};

export async function createBulkInventoryItemsWithImages(formData: FormData) {
  const itemsJson = formData.get('items') as string;
  if (!itemsJson) return { error: 'No items provided.' };

  let items: BulkItemInput[];
  try {
    items = JSON.parse(itemsJson) as BulkItemInput[];
  } catch {
    return { error: 'Invalid items data.' };
  }

  if (!items.length) return { error: 'No items to add.' };
  // Project ID is optional now

  // Resolve org_id for each distinct project_id to prevent null org_id
  const projectIds = [...new Set(items.map((i) => i.project_id).filter(Boolean))] as string[];
  const projOrgMap: Record<string, string> = {};
  if (projectIds.length) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, org_id')
      .in('id', projectIds);
    for (const p of projects ?? []) {
      if (p.org_id) projOrgMap[p.id] = p.org_id;
    }
  }

  const rows = items.map((item) => ({
    name: item.name,
    description: item.description || '',
    category: item.category || 'Other',
    price: item.price,
    condition: item.condition || 'Good',
    status: 'available' as const,
    user_id: item.user_id,
    project_id: item.project_id || null,
    org_id: item.project_id ? (projOrgMap[item.project_id] ?? null) : null,
    processing_status: 'none' as const,
  }));

  try {
    const { data: insertedItems, error } = await supabase
      .from('inventory_items')
      .insert(rows as any) // Cast to any to avoid type complexity with optional fields
      .select('id');

    if (error || !insertedItems) {
      console.error('Supabase bulk insert error:', error);
      return { error: `Failed to add items: ${(error as any)?.message || 'Unknown error'}` };
    }

    const toProcess: { itemId: string; storagePath: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const imageFile = formData.get(`image-${i}`) as File | null;
      if (imageFile && imageFile.size > 0) {
        const itemId = insertedItems[i].id;
        const storagePath = `${itemId}/source.webp`;
        const rawBuffer = Buffer.from(await imageFile.arrayBuffer());
        const sourceBuffer = await normalizeSourceImage(rawBuffer);

        const { error: uploadErr } = await supabase.storage
          .from('inventory-images')
          .upload(storagePath, sourceBuffer, { contentType: 'image/webp' });

        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('inventory-images')
            .getPublicUrl(storagePath);

          await supabase
            .from('inventory_items')
            .update({
              original_image_url: publicUrl,
              processing_status: 'queued',
            })
            .eq('id', itemId);

          toProcess.push({ itemId, storagePath });
        }
      }
    }

    // Enqueue each image for parallel processing via Vercel Queues
    await Promise.all(
      toProcess.map(({ itemId, storagePath }) =>
        enqueue(
          TOPICS.PROCESS_IMAGE,
          { itemId, storagePath },
          async (data) => processItemImage(data.itemId, data.storagePath),
        )
      ),
    );

    revalidateInventoryRoutes();

    return { success: true, count: items.length };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function createBulkInventoryItems(items: BulkItemInput[]) {
  if (!items.length) return { error: 'No items to add.' };
  if (items.some((it) => !it.project_id)) return { error: 'Project is required for all items.' };

  // Resolve org_id for each distinct project_id
  const projectIds = [...new Set(items.map((i) => i.project_id).filter(Boolean))] as string[];
  const projOrgMap: Record<string, string> = {};
  if (projectIds.length) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, org_id')
      .in('id', projectIds);
    for (const p of projects ?? []) {
      if (p.org_id) projOrgMap[p.id] = p.org_id;
    }
  }

  const rows = items.map((item) => ({
    name: item.name,
    description: item.description || '',
    category: item.category || 'Other',
    price: item.price,
    condition: item.condition || 'Good',
    status: 'available' as const,
    user_id: item.user_id,
    project_id: item.project_id,
    org_id: item.project_id ? (projOrgMap[item.project_id] ?? null) : null,
  }));

  try {
    const { error } = await supabase.from('inventory_items').insert(rows);

    if (error) {
      console.error('Supabase bulk insert error:', error);
      return { error: 'Failed to add items. Please try again.' };
    }

    revalidateInventoryRoutes();

    return { success: true, count: rows.length };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function retryImageProcessing(itemId: string) {
  try {
    const { data: item, error } = await supabase
      .from('inventory_items')
      .select('original_image_url, processing_status')
      .eq('id', itemId)
      .single();

    if (error || !item) {
      return { error: 'Item not found.' };
    }
    if (!item.original_image_url) {
      if (item.processing_status === 'complete') {
        return { error: 'Source image has been removed after the retention period. Please upload a new image to reprocess.' };
      }
      return { error: 'This item has no image.' };
    }

    const url = new URL(item.original_image_url);
    const pathMatch = url.pathname.match(/\/inventory-images\/(.+)$/);
    if (!pathMatch) return { error: 'Could not resolve image path.' };

    const storagePath = decodeURIComponent(pathMatch[1]);

    await supabase
      .from('inventory_items')
      .update({ processing_status: 'queued' })
      .eq('id', itemId);

    await enqueue(
      TOPICS.PROCESS_IMAGE,
      { itemId, storagePath },
      async (data) => processItemImage(data.itemId, data.storagePath),
    );

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function analyzeItemAction(formData: FormData) {
  try {
    const imageFile = formData.get('image') as File | null;
    if (!imageFile || imageFile.size === 0) {
      console.warn('[analyzeItemAction] No image in FormData');
      return { error: 'No image provided.' };
    }

    console.log('[analyzeItemAction] image received:', imageFile.name, imageFile.size, 'bytes');
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const result = await analyzeUploadedSimpleImage(buffer);

    if (!result) {
      console.warn('[analyzeItemAction] analyzeUploadedSimpleImage returned null');
      return { error: 'Could not analyze image.' };
    }

    console.log('[analyzeItemAction] returning:', JSON.stringify(result).slice(0, 300));
    return { success: true, data: result };
  } catch (err) {
    console.error('[analyzeItemAction] error:', err);
    return { error: 'An unexpected error occurred during analysis.' };
  }
}

