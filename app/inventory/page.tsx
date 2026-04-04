import { redirect } from "next/navigation";
import Link from "next/link";
import { PiPlusDuotone, PiImagesDuotone } from "react-icons/pi";
import { createClient } from "@/utils/supabase/server";
import { resolveActiveOrgId } from "@/lib/rbac";
import { getInventoryItems } from "@/app/inventory/actions";
import { getCartItems } from "@/app/cart/actions";
import { CartProvider } from "@/lib/cart-context";
import { CartDrawer } from "@/app/components/cart-drawer";
import { InventoryList } from "@/app/inventory/_components/inventory-list";
import type { PaginatedInventoryResult } from "@/app/inventory/actions";
import type { InventoryListInitialFilters } from "@/app/inventory/_components/inventory-list";
import { DirectionalTransition } from "@/app/components/directional-transition";

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

function parseQueryValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
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
  const initialFilters: InventoryListInitialFilters = {
    search: parseQueryValue(params.search),
    project: parseQueryValue(params.project) || "all",
    status: (["all", "available", "sold", "reserved"] as const).includes(parseQueryValue(params.status) as "all" | "available" | "sold" | "reserved")
      ? (parseQueryValue(params.status) as "all" | "available" | "sold" | "reserved")
      : "all",
    category: parseQueryValue(params.category) || "all",
    condition: parseQueryValue(params.condition) || "all",
    age: (["all", "0-30", "31-60", "61-90", "90-plus"] as const).includes(parseQueryValue(params.age) as "all" | "0-30" | "31-60" | "61-90" | "90-plus")
      ? (parseQueryValue(params.age) as "all" | "0-30" | "31-60" | "61-90" | "90-plus")
      : "all",
  };

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
    <DirectionalTransition>
    <CartProvider userId={user.id} orgId={activeOrgId ?? ""} initialItems={cartItems}>
      <main className="mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-stone-900 dark:text-white sm:text-4xl">
              Inventory
            </h1>
            <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">
              Manage and track all your estate sale items — {pagination.totalCount}{" "}
              {pagination.totalCount === 1 ? "item" : "items"} across all projects.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CartDrawer />
            <Link
              href="/inventory/bulk"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition-all hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <PiImagesDuotone className="h-4 w-4" />
              Bulk add
            </Link>
            <Link
              href="/inventory/add"
              transitionTypes={['nav-forward']}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-transparent bg-[var(--color-brand-primary)] px-5 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-[var(--color-brand-primary-hover)]"
            >
              <PiPlusDuotone className="h-4 w-4" />
              Add item
            </Link>
          </div>
        </div>

        <InventoryList
          key={`${activeOrgId ?? "all"}:${pagination.page}:${pagination.pageSize}:${initialFilters.search}:${initialFilters.project}:${initialFilters.status}:${initialFilters.category}:${initialFilters.condition}:${initialFilters.age}`}
          initialItems={items}
          pagination={pagination}
          userId={user.id}
          initialFilters={initialFilters}
        />
      </main>
    </CartProvider>
    </DirectionalTransition>
  );
}
