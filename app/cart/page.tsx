import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveActiveOrgId } from "@/lib/rbac";
import { getCartItems } from "@/app/cart/actions";
import { CartProvider } from "@/lib/cart-context";
import { CartReview } from "@/app/cart/_components/cart-review";
import { DirectionalTransition } from "@/app/components/directional-transition";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const activeOrgId = await resolveActiveOrgId(user.id);
  const cartResult = await getCartItems(user.id, activeOrgId ?? "");
  const cartItems = cartResult.data ?? [];

  return (
    <DirectionalTransition>
    <CartProvider userId={user.id} orgId={activeOrgId ?? ""} initialItems={cartItems}>
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <CartReview />
      </div>
    </CartProvider>
    </DirectionalTransition>
  );
}
