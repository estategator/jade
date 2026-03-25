import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveActiveOrgId } from "@/lib/rbac";
import { getInventoryItems } from "@/app/inventory/actions";
import { getCartItems } from "@/app/cart/actions";
import { CartProvider } from "@/lib/cart-context";
import { InventoryList } from "@/app/inventory/_components/inventory-list";
import type { PaginatedInventoryResult } from "@/app/inventory/actions";

export const dynamic = "force-dynamic";

type InventoryListPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const DEFAULT_PAGE_SIZE = 20;

function parsePositiveInt(value: string | string[] | undefined, fallback: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export default async function InventoryListPage({ searchParams }: InventoryListPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activeOrgId = await resolveActiveOrgId(user.id);
  const params = (await searchParams) ?? {};
  const page = parsePositiveInt(params.page, 1);
  const pageSize = parsePositiveInt(params.pageSize, DEFAULT_PAGE_SIZE);

  const [inventoryResult, cartResult] = await Promise.all([
    getInventoryItems(user.id, activeOrgId, page, pageSize),
    activeOrgId ? getCartItems(user.id, activeOrgId) : Promise.resolve({ data: [] }),
  ]);
  const paginatedInventory: PaginatedInventoryResult = "error" in inventoryResult
    ? {
      data: [],
      pagination: {
        page,
        pageSize,
        totalCount: 0,
        totalPages: 1,
      },
    }
    : inventoryResult;

  const items = paginatedInventory.data;
  const cartItems = cartResult.data ?? [];
  const pagination = paginatedInventory.pagination;

  return (
    <CartProvider userId={user.id} orgId={activeOrgId ?? ""} initialItems={cartItems}>
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <InventoryList
          key={`${activeOrgId ?? "all"}:${pagination.page}:${pagination.pageSize}`}
          initialItems={items}
          pagination={pagination}
          userId={user.id}
        />
      </div>
    </CartProvider>
  );
}
