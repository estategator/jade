'use server';

import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

export type PublicProject = {
  id: string;
  name: string;
  description: string;
  cover_image_url: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  organization: { name: string } | null;
};

export type PublicProjectItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  condition: string;
  status: 'available' | 'sold' | 'reserved';
  medium_image_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
};

/** Public-safe project fetch. Authenticated portal users can view regardless of published status. */
export async function getPublicProject(id: string, options?: { skipPublishedCheck?: boolean }): Promise<{ data?: PublicProject; error?: string }> {
  try {
    let query = supabase
      .from('projects')
      .select('id, name, description, cover_image_url, phone, address_line1, address_line2, city, state, zip_code, organizations:org_id(name)')
      .eq('id', id);

    if (!options?.skipPublishedCheck) {
      query = query.eq('published', true);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return { error: 'Project not found.' };
    }

    const raw = data as Record<string, unknown>;

    return {
      data: {
        id: raw.id as string,
        name: raw.name as string,
        description: raw.description as string,
        cover_image_url: raw.cover_image_url as string | null,
        phone: raw.phone as string | null,
        address_line1: raw.address_line1 as string | null,
        address_line2: raw.address_line2 as string | null,
        city: raw.city as string | null,
        state: raw.state as string | null,
        zip_code: raw.zip_code as string | null,
        organization: raw.organizations as { name: string } | null,
      },
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

/** Fetch all buyer-visible items for a project — no auth required. */
export async function getPublicProjectItems(projectId: string): Promise<{ data?: PublicProjectItem[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id, name, description, category, price, condition, status, medium_image_url, thumbnail_url, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load items.' };
    }

    return { data: (data ?? []) as PublicProjectItem[] };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}
