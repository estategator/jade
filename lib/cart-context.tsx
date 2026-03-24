"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  getCartItems,
  addToCart as addToCartAction,
  updateCartItemQuantity as updateQtyAction,
  removeFromCart as removeAction,
  clearCart as clearAction,
  type CartItem,
} from "@/app/cart/actions";

type CartContextValue = {
  items: CartItem[];
  /** Total quantity across all cart lines */
  count: number;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  addItem: (inventoryItemId: string, quantity?: number) => Promise<{ error?: string }>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<{ error?: string }>;
  removeItem: (cartItemId: string) => Promise<{ error?: string }>;
  clear: () => Promise<{ error?: string }>;
};

const CartContext = createContext<CartContextValue | null>(null);

function totalQty(items: CartItem[]): number {
  return items.reduce((sum, ci) => sum + ci.quantity, 0);
}

type CartProviderProps = Readonly<{
  userId: string;
  orgId: string;
  initialItems: CartItem[];
  children: ReactNode;
}>;

export function CartProvider({ userId, orgId, initialItems, children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await getCartItems(userId, orgId);
    if (result.error) {
      setError(result.error);
    } else {
      setItems(result.data ?? []);
    }
    setLoading(false);
  }, [userId, orgId]);

  const addItem = useCallback(
    async (inventoryItemId: string, quantity: number = 1) => {
      // Optimistic: add or increment the item in local state immediately
      setItems((prev) => {
        const existing = prev.find((ci) => ci.inventory_item_id === inventoryItemId);
        if (existing) {
          return prev.map((ci) =>
            ci.inventory_item_id === inventoryItemId
              ? { ...ci, quantity: ci.quantity + quantity }
              : ci,
          );
        }
        // For new items we create a placeholder; refresh will fill details
        return [
          ...prev,
          {
            id: `optimistic-${inventoryItemId}`,
            user_id: userId,
            org_id: orgId,
            inventory_item_id: inventoryItemId,
            quantity,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as CartItem,
        ];
      });

      const result = await addToCartAction(userId, orgId, inventoryItemId, quantity);
      if (result.error) {
        // Rollback on error
        await refresh();
        return { error: result.error };
      }
      // Sync with server to get full data (inventory_item details, real id)
      await refresh();
      return {};
    },
    [userId, orgId, refresh],
  );

  const updateQuantity = useCallback(
    async (cartItemId: string, quantity: number) => {
      // Optimistic: update quantity immediately
      setItems((prev) =>
        prev.map((ci) => (ci.id === cartItemId ? { ...ci, quantity } : ci)),
      );

      const result = await updateQtyAction(userId, cartItemId, quantity);
      if (result.error) {
        await refresh();
        return { error: result.error };
      }
      return {};
    },
    [userId, refresh],
  );

  const removeItem = useCallback(
    async (cartItemId: string) => {
      // Optimistic: remove immediately
      setItems((prev) => prev.filter((ci) => ci.id !== cartItemId));

      const result = await removeAction(userId, cartItemId);
      if (result.error) {
        await refresh();
        return { error: result.error };
      }
      return {};
    },
    [userId, refresh],
  );

  const clear = useCallback(async () => {
    // Optimistic: clear immediately
    const prev = items;
    setItems([]);

    const result = await clearAction(userId, orgId);
    if (result.error) {
      setItems(prev);
      return { error: result.error };
    }
    return {};
  }, [userId, orgId, items]);

  return (
    <CartContext.Provider
      value={{
        items,
        count: totalQty(items),
        loading,
        error,
        refresh,
        addItem,
        updateQuantity,
        removeItem,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
