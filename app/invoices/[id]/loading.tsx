import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function InvoiceDetailLoading() {
  return (
    <main className="px-4 py-12 sm:px-6 lg:px-8">
      {/* Back link + header */}
      <div className="mb-8">
        <Skeleton
          width={120}
          height={16}
          baseColor="var(--skeleton-base, #e7e5e4)"
          highlightColor="var(--skeleton-highlight, #f5f5f4)"
          borderRadius={6}
        />
        <Skeleton
          width={220}
          height={32}
          baseColor="var(--skeleton-base, #e7e5e4)"
          highlightColor="var(--skeleton-highlight, #f5f5f4)"
          borderRadius={8}
          className="mt-2"
        />
        <Skeleton
          width={260}
          height={18}
          baseColor="var(--skeleton-base, #e7e5e4)"
          highlightColor="var(--skeleton-highlight, #f5f5f4)"
          borderRadius={6}
          className="mt-1"
        />
      </div>

      {/* Status + action bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Skeleton
          width={90}
          height={30}
          baseColor="var(--skeleton-base, #e7e5e4)"
          highlightColor="var(--skeleton-highlight, #f5f5f4)"
          borderRadius={999}
        />
        <div className="ml-auto flex gap-2">
          <Skeleton
            width={100}
            height={38}
            baseColor="var(--skeleton-base, #e7e5e4)"
            highlightColor="var(--skeleton-highlight, #f5f5f4)"
            borderRadius={12}
          />
          <Skeleton
            width={100}
            height={38}
            baseColor="var(--skeleton-base, #e7e5e4)"
            highlightColor="var(--skeleton-highlight, #f5f5f4)"
            borderRadius={12}
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Skeleton
              width={80}
              height={14}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
              borderRadius={4}
            />
            <Skeleton
              width={120}
              height={28}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
              borderRadius={6}
              className="mt-2"
            />
          </div>
        ))}
      </div>

      {/* Details section */}
      <div className="mb-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <Skeleton
          width={80}
          height={20}
          baseColor="var(--skeleton-base, #e7e5e4)"
          highlightColor="var(--skeleton-highlight, #f5f5f4)"
          borderRadius={6}
          className="mb-4"
        />
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton
                width={80}
                height={14}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={4}
              />
              <Skeleton
                width={160}
                height={18}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={4}
                className="mt-1"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Line items table */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-stone-200 px-6 py-4 dark:border-zinc-800">
          <Skeleton
            width={100}
            height={20}
            baseColor="var(--skeleton-base, #e7e5e4)"
            highlightColor="var(--skeleton-highlight, #f5f5f4)"
            borderRadius={6}
          />
        </div>
        {/* Table header */}
        <div className="border-b border-stone-200 bg-stone-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex gap-4">
            {[30, 140, 90, 40, 80, 80, 90].map((w, i) => (
              <Skeleton
                key={i}
                width={w}
                height={16}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={4}
              />
            ))}
          </div>
        </div>
        {/* Table rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-stone-100 px-4 py-3 last:border-b-0 dark:border-zinc-800"
          >
            {[30, 140, 90, 40, 80, 80, 90].map((w, j) => (
              <Skeleton
                key={j}
                width={w}
                height={16}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={4}
              />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
