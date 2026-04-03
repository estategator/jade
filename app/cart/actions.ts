'use server';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireOrgMembership } from '@/lib/rbac';

export type CartItem = {
  id: string;
  user_id: string;
  org_id: string;
  inventory_item_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  inventory_item?: {
    id: string;
    name: string;
    description: string;
    category: string;
    price: number;
    condition: string;
    status: 'available' | 'sold' | 'reserved';
    quantity: number;
    thumbnail_url: string | null;
    medium_image_url: string | null;
    project_id: string;
    project?: { id: string; name: string; org_id: string; organizations?: { name: string } };
  };
};

export async function getCartItems(userId: string, orgId: string): Promise<{ data?: CartItem[]; error?: string }> {
  try {
    const membership = await requireOrgMembership(orgId, userId);
    if ('error' in membership) return { error: membership.error };

    const { data, error } = await supabaseAdmin
      .from('cart_items')
      .select(`
        *,
        inventory_item:inventory_items(
          id, name, description, category, price, condition, status, quantity,
          thumbnail_url, medium_image_url, project_id,
          project:projects(id, name, org_id, organizations(name))
        )
      `)
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to load cart.' };
    }

    return { data: data as CartItem[] };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function addToCart(
  userId: string,
  orgId: string,
  inventoryItemId: string,
  quantity: number = 1,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const membership = await requireOrgMembership(orgId, userId);
    if ('error' in membership) return { error: membership.error };

    const qty = Math.max(1, Math.floor(quantity));

    // Verify the item exists, is available, and belongs to this org
    const { data: item, error: itemErr } = await supabaseAdmin
      .from('inventory_items')
      .select('id, status, quantity, project_id')
      .eq('id', inventoryItemId)
      .single();

    if (itemErr || !item) return { error: 'Item not found.' };
    if (item.status !== 'available') return { error: 'Item is not available.' };

    // Verify item belongs to this org via project
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('org_id')
      .eq('id', item.project_id)
      .single();

    if (!project || project.org_id !== orgId) {
      return { error: 'Item does not belong to this organization.' };
    }

    // Check existing cart entry
    const { data: existing } = await supabaseAdmin
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .eq('inventory_item_id', inventoryItemId)
      .maybeSingle();

    const newQty = (existing?.quantity ?? 0) + qty;
    if (newQty > item.quantity) {
      return { error: `Only ${item.quantity} available.` };
    }

    if (existing) {
      const { error } = await supabaseAdmin
        .from('cart_items')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      if (error) {
        console.error('Supabase error:', error);
        return { error: 'Failed to update cart.' };
      }
    } else {
      const { error } = await supabaseAdmin
        .from('cart_items')
        .insert({
          user_id: userId,
          org_id: orgId,
          inventory_item_id: inventoryItemId,
          quantity: qty,
        });

      if (error) {
        if (error.code === '23505') {
          // Race condition: row was inserted concurrently — just update
          return addToCart(userId, orgId, inventoryItemId, quantity);
        }
        console.error('Supabase error:', error);
        return { error: 'Failed to add to cart.' };
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function updateCartItemQuantity(
  userId: string,
  cartItemId: string,
  quantity: number,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const qty = Math.max(1, Math.floor(quantity));

    // Fetch cart item and verify ownership
    const { data: cartItem, error: cartErr } = await supabaseAdmin
      .from('cart_items')
      .select('id, user_id, inventory_item_id')
      .eq('id', cartItemId)
      .eq('user_id', userId)
      .single();

    if (cartErr || !cartItem) return { error: 'Cart item not found.' };

    // Check available stock
    const { data: item } = await supabaseAdmin
      .from('inventory_items')
      .select('quantity, status')
      .eq('id', cartItem.inventory_item_id)
      .single();

    if (!item || item.status !== 'available') return { error: 'Item is no longer available.' };
    if (qty > item.quantity) return { error: `Only ${item.quantity} available.` };

    const { error } = await supabaseAdmin
      .from('cart_items')
      .update({ quantity: qty, updated_at: new Date().toISOString() })
      .eq('id', cartItemId)
      .eq('user_id', userId);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to update quantity.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function removeFromCart(
  userId: string,
  cartItemId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('id', cartItemId)
      .eq('user_id', userId);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to remove item.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function clearCart(
  userId: string,
  orgId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('user_id', userId)
      .eq('org_id', orgId);

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to clear cart.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
}

export async function getCartCount(userId: string, orgId: string): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin
      .from('cart_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('org_id', orgId);

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
