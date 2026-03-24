import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function InvoicesLoading() {
  return (
    <main className="px-4 py-12 sm:px-6 lg:px-8">
      {/* Page header skeleton */}
      <div className="mb-8">
        <Skeleton
          width={180}
          height={32}
          baseColor="var(--skeleton-base, #e7e5e4)"
          highlightColor="var(--skeleton-highlight, #f5f5f4)"
          borderRadius={8}
        />
        <Skeleton
          width={320}
          height={18}
          baseColor="var(--skeleton-base, #e7e5e4)"
          highlightColor="var(--skeleton-highlight, #f5f5f4)"
          borderRadius={6}
          className="mt-2"
        />
      </div>

      <div className="space-y-8">
        {/* Generate form skeleton */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-5 flex items-center gap-3">
            <Skeleton
              width={40}
              height={40}
              borderRadius={12}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
            />
            <div>
              <Skeleton
                width={160}
                height={22}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={6}
              />
              <Skeleton
                width={220}
                height={16}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={6}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton
              height={40}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
              borderRadius={12}
            />
            <Skeleton
              height={40}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
              borderRadius={12}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Skeleton
              height={40}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
              borderRadius={12}
            />
            <Skeleton
              height={40}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
              borderRadius={12}
            />
          </div>
        </div>

        {/* Filter bar skeleton */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton
            height={38}
            width={240}
            baseColor="var(--skeleton-base, #e7e5e4)"
            highlightColor="var(--skeleton-highlight, #f5f5f4)"
            borderRadius={12}
          />
          <div className="flex gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                width={70}
                height={30}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={8}
              />
            ))}
          </div>
        </div>

        {/* Table skeleton */}
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {/* Table header */}
          <div className="border-b border-stone-200 bg-stone-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex gap-4">
              {[100, 80, 140, 90, 50, 80, 100].map((w, i) => (
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
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-stone-100 px-4 py-3 last:border-b-0 dark:border-zinc-800"
            >
              {[100, 80, 140, 90, 50, 80, 100].map((w, j) => (
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
      </div>
    </main>
  );
}
