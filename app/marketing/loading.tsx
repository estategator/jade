import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function MarketingLoading() {
  return (
    <main className="px-4 py-12 sm:px-6 lg:px-8">
      {/* Page header skeleton */}
      <div className="mb-8">
        <Skeleton
          width={160}
          height={32}
          baseColor="var(--skeleton-base, #e7e5e4)"
          highlightColor="var(--skeleton-highlight, #f5f5f4)"
          borderRadius={8}
        />
        <Skeleton
          width={380}
          height={18}
          baseColor="var(--skeleton-base, #e7e5e4)"
          highlightColor="var(--skeleton-highlight, #f5f5f4)"
          borderRadius={6}
          className="mt-2"
        />
      </div>

      <div className="space-y-6">
        {/* Controls bar skeleton: project filter + count + button */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton
              width={160}
              height={38}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
              borderRadius={12}
            />
            <Skeleton
              width={70}
              height={18}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
              borderRadius={6}
            />
          </div>
          <Skeleton
            width={140}
            height={40}
            baseColor="var(--skeleton-base, #e7e5e4)"
            highlightColor="var(--skeleton-highlight, #f5f5f4)"
            borderRadius={12}
          />
        </div>

        {/* Asset grid skeleton: 2-col on mobile, 5-col on xl */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Image preview placeholder */}
              <div className="aspect-[4/3]">
                <Skeleton
                  height="100%"
                  width="100%"
                  baseColor="var(--skeleton-base, #e7e5e4)"
                  highlightColor="var(--skeleton-highlight, #f5f5f4)"
                  borderRadius={0}
                  style={{ display: "block", lineHeight: 1 }}
                />
              </div>
              {/* Card body */}
              <div className="p-3">
                <div className="mb-1 flex items-start justify-between gap-1">
                  <Skeleton
                    width={90}
                    height={14}
                    baseColor="var(--skeleton-base, #e7e5e4)"
                    highlightColor="var(--skeleton-highlight, #f5f5f4)"
                    borderRadius={4}
                  />
                  <Skeleton
                    width={40}
                    height={14}
                    baseColor="var(--skeleton-base, #e7e5e4)"
                    highlightColor="var(--skeleton-highlight, #f5f5f4)"
                    borderRadius={999}
                  />
                </div>
                <Skeleton
                  width={120}
                  height={12}
                  baseColor="var(--skeleton-base, #e7e5e4)"
                  highlightColor="var(--skeleton-highlight, #f5f5f4)"
                  borderRadius={4}
                  className="mb-1"
                />
                <div className="flex items-center gap-1.5">
                  <Skeleton
                    width={60}
                    height={12}
                    baseColor="var(--skeleton-base, #e7e5e4)"
                    highlightColor="var(--skeleton-highlight, #f5f5f4)"
                    borderRadius={4}
                  />
                  <Skeleton
                    width={50}
                    height={12}
                    baseColor="var(--skeleton-base, #e7e5e4)"
                    highlightColor="var(--skeleton-highlight, #f5f5f4)"
                    borderRadius={4}
                    className="ml-auto"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
