import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CancelRestorer } from "./cancel-restorer";

export default function CheckoutCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-stone-400 dark:text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Cancelling…</span>
          </div>
        }
      >
        <CancelRestorer />
      </Suspense>
    </div>
  );
}
