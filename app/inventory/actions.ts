'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { processItemImage, normalizeSourceImage } from '@/lib/image-processing';
import type { AIAnalysisResult, InventoryProcessingStatus } from '@/lib/inventory';
import { logProjectTransparencyEvent } from '@/lib/project-transparency';
import { requirePermission, resolveActiveOrgId } from '@/lib/rbac';
import { enqueue, TOPICS } from '@/lib/queue';

export type { AIAnalysisResult } from '@/lib/inventory';

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
  processing_status: InventoryProcessingStatus;
  ai_insights: AIAnalysisResult | null;
  project?: { id: string; name: string; org_id: string; organizations?: { name: string; stripe_onboarding_complete?: boolean } };
};

type InventoryAccessItem = Pick<
  InventoryItem,
  'id' | 'project_id' | 'original_image_url' | 'thumbnail_url' | 'medium_image_url'
>;

const INVENTORY_STORAGE_DELETE_CHUNK_SIZE = 100;
const INVENTORY_IMAGE_UPLOAD_CHUNK_SIZE = 8;

// Helper: verify user has access to an item via org membership
async function verifyItemOwnership(userId: string, itemId: string): Promise<{ valid: boolean; error?: string }> {
  const result = await getAccessibleInventoryItems(userId, [itemId]);
  if (result.error) {
    return { valid: false, error: result.error };
  }

  return { valid: true };
}

function parseInventoryStoragePath(url: string | null): string | null {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const pathMatch = parsedUrl.pathname.match(/\/inventory-images\/(.+)$/);
    return pathMatch ? decodeURIComponent(pathMatch[1]) : null;
  } catch {
    return null;
  }
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (items.length <= chunkSize) return [items];

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function getAccessibleInventoryItems(
  userId: string,
  itemIds: string[],
): Promise<{ data?: InventoryAccessItem[]; error?: string }> {
  const uniqueIds = [...new Set(itemIds)];
  if (!uniqueIds.length) {
    return { data: [] };
  }

  try {
    const { data: memberships, error: membershipError } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId);

    if (membershipError) {
      console.error('Supabase error:', membershipError);
      return { error: 'Permission check failed.' };
    }

    const accessibleOrgIds = new Set((memberships ?? []).map((membership) => membership.org_id));

    const { data: items, error: itemError } = await supabase
      .from('inventory_items')
      .select('id, project_id, original_image_url, thumbnail_url, medium_image_url')
      .in('id', uniqueIds);

    if (itemError) {
      console.error('Supabase error:', itemError);
      return { error: uniqueIds.length === 1 ? 'Item not found.' : 'Failed to load selected items.' };
    }

    const resolvedItems = (items ?? []) as InventoryAccessItem[];
    if (resolvedItems.length !== uniqueIds.length) {
      return { error: uniqueIds.length === 1 ? 'Item not found.' : 'One or more items were not found.' };
    }

    const projectIds = [...new Set(resolvedItems.map((item) => item.project_id))];
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, org_id')
      .in('id', projectIds);

    if (projectError) {
      console.error('Supabase error:', projectError);
      return { error: uniqueIds.length === 1 ? 'Project not found.' : 'Failed to load selected item projects.' };
    }

    const projectOrgIds = new Map((projects ?? []).map((project) => [project.id, project.org_id]));

    for (const item of resolvedItems) {
      const orgId = projectOrgIds.get(item.project_id);
      if (!orgId) {
        return { error: uniqueIds.length === 1 ? 'Project not found.' : 'One or more items are linked to missing projects.' };
      }

      if (!accessibleOrgIds.has(orgId)) {
        return {
          error: uniqueIds.length === 1 ? 'You do not have access to this item.' : 'Permission denied for one or more items.',
        };
      }
    }

    return { data: resolvedItems };
  } catch (err) {
    console.error('Unexpected error in ownership check:', err);
    return { error: 'Permission check failed.' };
  }
}

async function removeInventoryStorageObjects(items: InventoryAccessItem[]): Promise<{ success?: true; error?: string }> {
  const paths = [...new Set(items.flatMap((item) => [
    parseInventoryStoragePath(item.original_image_url),
    parseInventoryStoragePath(item.thumbnail_url),
    parseInventoryStoragePath(item.medium_image_url),
  ].filter((path): path is string => !!path)))];

  if (!paths.length) {
    return { success: true };
  }

  try {
    for (const pathChunk of chunkArray(paths, INVENTORY_STORAGE_DELETE_CHUNK_SIZE)) {
      const { error } = await supabase.storage
        .from('inventory-images')
        .remove(pathChunk);

      if (error) {
        console.error('Storage delete error:', error);
        return { error: 'Failed to delete item images.' };
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected storage delete error:', err);
    return { error: 'Failed to delete item images.' };
  }
}

export type UserProject = {
  id: string;
  name: string;
  org_id: string;
  org_name: string;
};

function mapProjectsToUserProjects(projects: Record<string, unknown>[]): UserProject[] {
  return projects.map((project) => ({
    id: project.id as string,
    name: project.name as string,
    org_id: project.org_id as string,
    org_name: ((project.organizations as Record<string, unknown> | null)?.name as string) ?? '',
  }));
}

export type InventoryPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type PaginatedInventoryResult = {
  data: InventoryItem[];
  pagination: InventoryPagination;
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

export async function getBulkAddPageProjects(userId: string) {
  try {
    const activeOrgId = await resolveActiveOrgId(userId);
    if (!activeOrgId) {
      return { activeOrgId: null, projects: [] as UserProject[] };
    }

    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, name, org_id, organizations(name)')
      .eq('org_id', activeOrgId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return { activeOrgId, error: 'Failed to load projects.' };
    }

    return {
      activeOrgId,
      projects: mapProjectsToUserProjects((projects ?? []) as Record<string, unknown>[]),
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { activeOrgId: null, error: 'An unexpected error occurred.' };
  }
}

export async function getUserProjects(userId: string, orgId?: string | null) {
  try {
    if (orgId) {
      const { data: membership, error: membershipError } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .maybeSingle();

      if (membershipError) {
        console.error('Supabase error:', membershipError);
        return { error: 'Failed to load projects.' };
      }

      if (!membership) {
        return { data: [] as UserProject[] };
      }

      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('id, name, org_id, organizations(name)')
        .eq('org_id', orgId)
        .order('name', { ascending: true });

      if (projectError) {
        console.error('Supabase error:', projectError);
        return { error: 'Failed to load projects.' };
      }

      return { data: mapProjectsToUserProjects((projects ?? []) as Record<string, unknown>[]) };
    }

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

    return { data: mapProjectsToUserProjects((projects ?? []) as Record<string, unknown>[]) };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

async function getValidatedBulkProjectOrgMap(
  userId: string,
  projectIds: string[],
): Promise<{ data?: Record<string, string>; error?: string }> {
  const uniqueProjectIds = [...new Set(projectIds.filter(Boolean))];
  if (!uniqueProjectIds.length) {
    return { data: {} };
  }

  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, org_id')
      .in('id', uniqueProjectIds);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to validate projects.' };
    }

    const resolvedProjects = projects ?? [];
    if (resolvedProjects.length !== uniqueProjectIds.length) {
      return { error: 'One or more selected projects were not found.' };
    }

    const orgIds = [...new Set(resolvedProjects.map((project) => project.org_id).filter(Boolean))];
    const permissionChecks = await Promise.all(
      orgIds.map(async (orgId) => ({
        orgId,
        result: await requirePermission(orgId, userId, 'inventory:create'),
      })),
    );

    const denied = permissionChecks.find((check) => !check.result.granted);
    if (denied && !denied.result.granted) {
      return { error: denied.result.error };
    }

    return {
      data: Object.fromEntries(resolvedProjects.map((project) => [project.id, project.org_id])),
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getInventoryItems(
  userId: string,
  orgId?: string | null,
  page: number = 1,
  pageSize: number = 20,
) {
  try {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const safePageSize = Number.isFinite(pageSize)
      ? Math.max(1, Math.min(100, Math.floor(pageSize)))
      : 20;

    const orgIdsResult = await getAccessibleOrgIds(userId);
    if (orgIdsResult.error) {
      return { error: 'Failed to load inventory.' };
    }

    const orgIds = orgIdsResult.data ?? [];
    if (!orgIds.length) {
      return {
        data: [] as InventoryItem[],
        pagination: {
          page: 1,
          pageSize: safePageSize,
          totalCount: 0,
          totalPages: 1,
        },
      } as PaginatedInventoryResult;
    }

    // Filter by specific org if provided
    const filteredOrgIds = orgId ? orgIds.filter((id) => id === orgId) : orgIds;
    if (orgId && !filteredOrgIds.length) {
      return {
        data: [] as InventoryItem[],
        pagination: {
          page: 1,
          pageSize: safePageSize,
          totalCount: 0,
          totalPages: 1,
        },
      } as PaginatedInventoryResult;
    }

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
    if (!projectIds.length) {
      return {
        data: [] as InventoryItem[],
        pagination: {
          page: 1,
          pageSize: safePageSize,
          totalCount: 0,
          totalPages: 1,
        },
      } as PaginatedInventoryResult;
    }

    const { count, error: countError } = await supabase
      .from('inventory_items')
      .select('id', { count: 'exact', head: true })
      .in('project_id', projectIds);

    if (countError) {
      console.error('Supabase error:', countError);
      return { error: 'Failed to load inventory.' };
    }

    const totalCount = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
    const clampedPage = Math.min(safePage, totalPages);
    const from = (clampedPage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    // Get inventory items for user's orgs
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*, project:projects(id, name, org_id, organizations(name, stripe_onboarding_complete))')
      .in('project_id', projectIds)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load inventory.' };
    }

    return {
      data: data as InventoryItem[],
      pagination: {
        page: clampedPage,
        pageSize: safePageSize,
        totalCount,
        totalPages,
      },
    } as PaginatedInventoryResult;
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
  const aiInsightsJson = formData.get('ai_insights') as string | null;

  let aiInsights: AIAnalysisResult | null = null;
  if (aiInsightsJson) {
    try {
      aiInsights = JSON.parse(aiInsightsJson) as AIAnalysisResult;
    } catch (err) {
      console.warn('[createInventoryItem] Invalid ai_insights payload:', err);
    }
  }

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
        ai_insights: aiInsights,
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
        { itemId: item.id, storagePath, skipAnalysis: !!aiInsights },
        async (data) => processItemImage(data.itemId, data.storagePath, { skipAnalysis: data.skipAnalysis }),
      );
    }

    await logProjectTransparencyEvent({
      orgId: project.org_id,
      projectId,
      actorId: userId,
      eventType: 'inventory_created',
      title: `Added ${name} to inventory`,
      body: `${name} is now part of the project inventory at $${price.toFixed(2)}.`,
      payload: {
        item_id: item.id,
        category: category || 'Uncategorized',
        condition: condition || 'Good',
        price,
      },
    });

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
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('org_id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return { error: 'Project not found.' };
    }

    const permissionCheck = await requirePermission(project.org_id, userId, 'inventory:update');
    if (!permissionCheck.granted) {
      return { error: permissionCheck.error };
    }

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

    await logProjectTransparencyEvent({
      orgId: project.org_id,
      projectId,
      actorId: userId,
      eventType: 'inventory_updated',
      title: `Updated ${name}`,
      body: `${name} inventory details were updated.`,
      payload: {
        item_id: id,
        category: category || 'Uncategorized',
        condition: condition || 'Good',
        status: status || 'available',
        price,
      },
    });

    revalidateInventoryRoutes();

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function deleteInventoryItem(id: string, userId: string) {
  const accessResult = await getAccessibleInventoryItems(userId, [id]);
  if (accessResult.error || !accessResult.data?.length) {
    return { error: accessResult.error || 'Failed to delete item.' };
  }

  try {
    const storageResult = await removeInventoryStorageObjects(accessResult.data);
    if (storageResult.error) {
      return { error: storageResult.error };
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
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return { error: 'No items selected.' };

  try {
    const accessResult = await getAccessibleInventoryItems(userId, uniqueIds);
    if (accessResult.error || !accessResult.data) {
      return { error: accessResult.error || 'Permission denied for one or more items.' };
    }

    const storageResult = await removeInventoryStorageObjects(accessResult.data);
    if (storageResult.error) {
      return { error: storageResult.error };
    }

    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .in('id', uniqueIds);

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
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return { error: 'No items selected.' };

  try {
    const accessResult = await getAccessibleInventoryItems(userId, uniqueIds);
    if (accessResult.error) {
      return { error: accessResult.error || 'Permission denied for one or more items.' };
    }

    const { error } = await supabase
      .from('inventory_items')
      .update({
        status,
        ...(status === 'sold' ? { sold_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      })
      .in('id', uniqueIds);

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
  ai_insights?: AIAnalysisResult | null;
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

  const userIds = [...new Set(items.map((item) => item.user_id).filter(Boolean))];
  if (userIds.length !== 1) {
    return { error: 'All items must belong to the same user.' };
  }

  const actingUserId = userIds[0];

  const projectIds = [...new Set(items.map((i) => i.project_id).filter(Boolean))] as string[];
  const projectValidation = await getValidatedBulkProjectOrgMap(actingUserId, projectIds);
  if (projectValidation.error || !projectValidation.data) {
    return { error: projectValidation.error || 'Failed to validate projects.' };
  }

  const projOrgMap = projectValidation.data;

  try {
    // 1. Normalize uploaded source images in parallel before storage.
    const imageData = await Promise.all(
      items.map(async (_, i) => {
        const imageFile = formData.get(`image-${i}`) as File | null;
        if (!imageFile || imageFile.size <= 0) return null;

        const rawBuffer = Buffer.from(await imageFile.arrayBuffer());
        const sourceBuffer = await normalizeSourceImage(rawBuffer);
        return { index: i, sourceBuffer };
      }),
    );

    const itemIds = items.map(() => crypto.randomUUID());

    // 2. Build rows from the in-place analysis results collected in the UI.
    const rows = items.map((item, i) => {
      const hasImage = imageData.some((d) => d?.index === i);
      const storagePath = `${itemIds[i]}/source.webp`;
      const originalImageUrl = hasImage
        ? supabase.storage.from('inventory-images').getPublicUrl(storagePath).data.publicUrl
        : null;

      return {
        id: itemIds[i],
        name: item.name || '',
        description: item.description || '',
        category: item.category || 'Other',
        price: item.price || 0,
        condition: item.condition || 'Good',
        status: 'available' as const,
        user_id: item.user_id,
        project_id: item.project_id || null,
        org_id: item.project_id ? (projOrgMap[item.project_id] ?? null) : null,
        original_image_url: originalImageUrl,
        ai_insights: item.ai_insights ?? null,
        processing_status: hasImage ? ('queued' as const) : ('none' as const),
      };
    });

    const { error } = await supabase
      .from('inventory_items')
      .insert(rows);

    if (error) {
      console.error('Supabase bulk insert error:', error);
      return { error: `Failed to add items: ${error?.message ?? 'Unknown error'}` };
    }

    // 3. Upload source images in bounded chunks.
    const failedUploadIds: string[] = [];
    const imageEntries = imageData.filter((entry): entry is NonNullable<typeof entry> => !!entry);

    for (const imageChunk of chunkArray(imageEntries, INVENTORY_IMAGE_UPLOAD_CHUNK_SIZE)) {
      await Promise.all(
        imageChunk.map(async (data) => {
          const itemId = itemIds[data.index];
          const storagePath = `${itemId}/source.webp`;

          const { error: uploadErr } = await supabase.storage
            .from('inventory-images')
            .upload(storagePath, data.sourceBuffer, { contentType: 'image/webp' });

          if (uploadErr) {
            console.error('Bulk image upload error:', uploadErr);
            failedUploadIds.push(itemId);
            return null;
          }

          await enqueue(
            TOPICS.PROCESS_IMAGE,
            { itemId, storagePath, skipAnalysis: !!items[data.index]?.ai_insights },
            async (d) => processItemImage(d.itemId, d.storagePath, { skipAnalysis: d.skipAnalysis }),
          );
        }),
      );
    }

    if (failedUploadIds.length > 0) {
      const { error: failedStatusError } = await supabase
        .from('inventory_items')
        .update({ processing_status: 'failed', original_image_url: null })
        .in('id', failedUploadIds);

      if (failedStatusError) {
        console.error('Supabase bulk upload failure status update error:', failedStatusError);
      }
    }

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

  const userIds = [...new Set(items.map((item) => item.user_id).filter(Boolean))];
  if (userIds.length !== 1) {
    return { error: 'All items must belong to the same user.' };
  }

  const actingUserId = userIds[0];

  const projectIds = [...new Set(items.map((i) => i.project_id).filter(Boolean))] as string[];
  const projectValidation = await getValidatedBulkProjectOrgMap(actingUserId, projectIds);
  if (projectValidation.error || !projectValidation.data) {
    return { error: projectValidation.error || 'Failed to validate projects.' };
  }

  const projOrgMap = projectValidation.data;

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
      .select('original_image_url, processing_status, ai_insights')
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
      { itemId, storagePath, skipAnalysis: !!item.ai_insights },
      async (data) => processItemImage(data.itemId, data.storagePath, { skipAnalysis: data.skipAnalysis }),
    );

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

// ── Direct-upload flow: prepare → client uploads → finalize ──────────

export type PrepareUploadDescriptor = {
  itemId: string;
  storagePath: string;
  signedUrl: string;
  token: string;
};

/**
 * Prepare a single inventory item: insert the DB row (processing_status=queued)
 * and return a signed upload URL so the browser can push image bytes directly
 * to Supabase Storage — no server-action proxy.
 */
export async function prepareInventoryItem(input: {
  name: string;
  description: string;
  category: string;
  price: number;
  condition: string;
  quantity: number;
  userId: string;
  projectId: string;
  hasImage: boolean;
  aiInsights?: AIAnalysisResult | null;
}): Promise<{ data?: { itemId: string; upload?: PrepareUploadDescriptor }; error?: string }> {
  const { name, description, category, price, condition, quantity, userId, projectId, hasImage, aiInsights } = input;

  if (!name) return { error: 'Name is required.' };
  if (isNaN(price) || price < 0) return { error: 'Valid price is required.' };
  if (!projectId) return { error: 'Project is required.' };

  const { data: project, error: projLookupErr } = await supabase
    .from('projects')
    .select('org_id')
    .eq('id', projectId)
    .single();

  if (projLookupErr || !project) return { error: 'Project not found.' };

  const permCheck = await requirePermission(project.org_id, userId, 'inventory:create');
  if (!permCheck.granted) return { error: permCheck.error };

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
        ai_insights: aiInsights ?? null,
        processing_status: hasImage ? 'queued' : 'none',
      })
      .select('id')
      .single();

    if (error || !item) {
      console.error('Supabase error:', error);
      return { error: 'Failed to add item. Please try again.' };
    }

    let upload: PrepareUploadDescriptor | undefined;

    if (hasImage) {
      const storagePath = `${item.id}/source.webp`;
      const { data: signedData, error: signedErr } = await supabase.storage
        .from('inventory-images')
        .createSignedUploadUrl(storagePath);

      if (signedErr || !signedData) {
        console.error('Signed URL error:', signedErr);
        await supabase.from('inventory_items').update({ processing_status: 'failed' }).eq('id', item.id);
        return { error: 'Failed to prepare image upload.' };
      }

      upload = {
        itemId: item.id,
        storagePath,
        signedUrl: signedData.signedUrl,
        token: signedData.token,
      };
    }

    await logProjectTransparencyEvent({
      orgId: project.org_id,
      projectId,
      actorId: userId,
      eventType: 'inventory_created',
      title: `Added ${name} to inventory`,
      body: `${name} is now part of the project inventory at $${price.toFixed(2)}.`,
      payload: { item_id: item.id, category: category || 'Uncategorized', condition: condition || 'Good', price },
    });

    revalidateInventoryRoutes();
    return { data: { itemId: item.id, upload } };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/**
 * Called by the client after a successful direct upload to Supabase Storage.
 * Sets original_image_url and enqueues the image processing pipeline.
 */
export async function finalizeInventoryUpload(input: {
  itemId: string;
  storagePath: string;
  skipAnalysis: boolean;
}): Promise<{ success?: true; error?: string }> {
  const { itemId, storagePath, skipAnalysis } = input;

  try {
    const { data: { publicUrl } } = supabase.storage
      .from('inventory-images')
      .getPublicUrl(storagePath);

    await supabase
      .from('inventory_items')
      .update({ original_image_url: publicUrl })
      .eq('id', itemId);

    await enqueue(
      TOPICS.PROCESS_IMAGE,
      { itemId, storagePath, skipAnalysis },
      async (data) => processItemImage(data.itemId, data.storagePath, { skipAnalysis: data.skipAnalysis }),
    );

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    await supabase.from('inventory_items').update({ processing_status: 'failed' }).eq('id', itemId);
    return { error: 'Failed to finalize upload.' };
  }
}

/**
 * Bulk prepare: insert all rows, generate signed upload URLs for items with images.
 * Returns descriptors the client uses for direct-to-storage uploads.
 */
export async function prepareBulkInventoryItems(input: {
  items: BulkItemInput[];
  imageIndexes: number[];
}): Promise<{ data?: { itemIds: string[]; uploads: PrepareUploadDescriptor[] }; error?: string }> {
  const { items, imageIndexes } = input;
  if (!items.length) return { error: 'No items provided.' };

  const userIds = [...new Set(items.map((item) => item.user_id).filter(Boolean))];
  if (userIds.length !== 1) return { error: 'All items must belong to the same user.' };

  const actingUserId = userIds[0];
  const projectIds = [...new Set(items.map((i) => i.project_id).filter(Boolean))] as string[];
  const projectValidation = await getValidatedBulkProjectOrgMap(actingUserId, projectIds);
  if (projectValidation.error || !projectValidation.data) {
    return { error: projectValidation.error || 'Failed to validate projects.' };
  }

  const projOrgMap = projectValidation.data;
  const imageIndexSet = new Set(imageIndexes);

  try {
    const itemIds = items.map(() => crypto.randomUUID());

    const rows = items.map((item, i) => {
      const hasImage = imageIndexSet.has(i);
      const storagePath = `${itemIds[i]}/source.webp`;
      const originalImageUrl = hasImage
        ? supabase.storage.from('inventory-images').getPublicUrl(storagePath).data.publicUrl
        : null;

      return {
        id: itemIds[i],
        name: item.name || '',
        description: item.description || '',
        category: item.category || 'Other',
        price: item.price || 0,
        condition: item.condition || 'Good',
        status: 'available' as const,
        user_id: item.user_id,
        project_id: item.project_id || null,
        org_id: item.project_id ? (projOrgMap[item.project_id] ?? null) : null,
        original_image_url: originalImageUrl,
        ai_insights: item.ai_insights ?? null,
        processing_status: hasImage ? ('queued' as const) : ('none' as const),
      };
    });

    const { error } = await supabase.from('inventory_items').insert(rows);

    if (error) {
      console.error('Supabase bulk insert error:', error);
      return { error: `Failed to add items: ${error.message}` };
    }

    // Generate signed upload URLs for items that have images.
    const uploads: PrepareUploadDescriptor[] = [];

    for (const idx of imageIndexes) {
      const itemId = itemIds[idx];
      const storagePath = `${itemId}/source.webp`;
      const { data: signedData, error: signedErr } = await supabase.storage
        .from('inventory-images')
        .createSignedUploadUrl(storagePath);

      if (signedErr || !signedData) {
        console.error('Signed URL error for bulk item:', signedErr);
        // Mark as failed but don't abort the whole batch
        await supabase.from('inventory_items').update({ processing_status: 'failed', original_image_url: null }).eq('id', itemId);
        continue;
      }

      uploads.push({
        itemId,
        storagePath,
        signedUrl: signedData.signedUrl,
        token: signedData.token,
      });
    }

    revalidateInventoryRoutes();
    return { data: { itemIds, uploads } };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/**
 * Bulk finalize: called after the client finishes all direct uploads.
 * Enqueues the image processing pipeline for each successfully uploaded item.
 */
export async function finalizeBulkUploads(input: {
  succeeded: { itemId: string; storagePath: string; skipAnalysis: boolean }[];
  failedItemIds: string[];
}): Promise<{ success?: true; error?: string }> {
  try {
    // Mark failed uploads in one batch
    if (input.failedItemIds.length > 0) {
      await supabase
        .from('inventory_items')
        .update({ processing_status: 'failed', original_image_url: null })
        .in('id', input.failedItemIds);
    }

    if (input.succeeded.length > 0) {
      // Batch-update original_image_url for all succeeded items at once
      await Promise.all(
        input.succeeded.map((item) => {
          const { data: { publicUrl } } = supabase.storage
            .from('inventory-images')
            .getPublicUrl(item.storagePath);

          return supabase
            .from('inventory_items')
            .update({ original_image_url: publicUrl })
            .eq('id', item.itemId);
        })
      );

      // Enqueue all image processing jobs in parallel
      await Promise.all(
        input.succeeded.map((item) =>
          enqueue(
            TOPICS.PROCESS_IMAGE,
            { itemId: item.itemId, storagePath: item.storagePath, skipAnalysis: item.skipAnalysis },
            async (data) => processItemImage(data.itemId, data.storagePath, { skipAnalysis: data.skipAnalysis }),
          )
        )
      );
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'Failed to finalize uploads.' };
  }
}



