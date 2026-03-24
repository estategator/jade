"use client";

import { useState, useTransition } from "react";
import { DashboardRevenueChart } from "./dashboard-charts";
import { getRevenueByRange } from "../actions";
import type { RevenueByMonth, RevenuePeriod } from "../actions";

const PERIODS: { label: string; value: RevenuePeriod }[] = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "6M", value: "6M" },
  { label: "YTD", value: "YTD" },
  { label: "1Y", value: "1Y" },
];

type Props = Readonly<{
  initialData: RevenueByMonth[];
  userId: string;
  orgId: string | null;
}>;

export function RevenueChartWithPeriod({ initialData, userId, orgId }: Props) {
  const [period, setPeriod] = useState<RevenuePeriod>("6M");
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  function handlePeriodChange(p: RevenuePeriod) {
    if (p === period) return;
    setPeriod(p);
    startTransition(async () => {
      const res = await getRevenueByRange(userId, orgId, p);
      if (res.data) setData(res.data);
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePeriodChange(p.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              period === p.value
                ? "bg-[var(--color-brand-primary)] text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className={isPending ? "opacity-50 transition-opacity" : ""}>
        <DashboardRevenueChart data={data} />
      </div>
    </div>
  );
}
