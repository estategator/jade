import { XCircle } from "lucide-react";
import { CheckoutMessage } from "@/app/components/checkout-message";
import { CheckoutSuccessContent } from "./_components/checkout-success-content";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center px-4 py-24">
        <CheckoutMessage
          icon={XCircle}
          title="Something went wrong"
          description="We couldn't verify your payment session."
          backLink={{ href: "/inventory", label: "Back to Inventory" }}
          iconColor="text-stone-400 dark:text-zinc-500"
        />
      </div>
    );
  }

  return <CheckoutSuccessContent sessionId={sessionId} />;
}
