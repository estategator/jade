import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function MarketingEditLoading() {
  return (
    <main className="px-4 py-12 sm:px-6 lg:px-8">
      {/* Back link + header skeleton */}
      <div className="mb-8">
        <Skeleton
          width={140}
          height={16}
          baseColor="var(--skeleton-base, #e7e5e4)"
          highlightColor="var(--skeleton-highlight, #f5f5f4)"
          borderRadius={6}
        />
        <Skeleton
          width={180}
          height={32}
          baseColor="var(--skeleton-base, #e7e5e4)"
          highlightColor="var(--skeleton-highlight, #f5f5f4)"
          borderRadius={8}
          className="mt-2"
        />
        <Skeleton
          width={240}
          height={18}
          baseColor="var(--skeleton-base, #e7e5e4)"
          highlightColor="var(--skeleton-highlight, #f5f5f4)"
          borderRadius={6}
          className="mt-1"
        />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left column */}
        <div className="min-w-0 flex-1 space-y-5">
          {/* AI action buttons skeleton */}
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton
              width={90}
              height={30}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
              borderRadius={8}
            />
            <Skeleton
              width={95}
              height={30}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
              borderRadius={8}
            />
          </div>

          {/* Content fields skeleton */}
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <Skeleton
                width={70}
                height={18}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={6}
              />
              <Skeleton
                width={80}
                height={16}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={999}
              />
            </div>

            {/* Title field */}
            <div>
              <Skeleton
                width={40}
                height={14}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={4}
                className="mb-1"
              />
              <Skeleton
                height={38}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={12}
              />
            </div>

            {/* Headline field */}
            <div>
              <Skeleton
                width={60}
                height={14}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={4}
                className="mb-1"
              />
              <Skeleton
                height={38}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={12}
              />
            </div>

            {/* Body field */}
            <div>
              <Skeleton
                width={40}
                height={14}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={4}
                className="mb-1"
              />
              <Skeleton
                height={96}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={12}
              />
            </div>

            {/* CTA field */}
            <div>
              <Skeleton
                width={90}
                height={14}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={4}
                className="mb-1"
              />
              <Skeleton
                height={38}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={12}
              />
            </div>

            {/* Save + Back buttons skeleton */}
            <div className="flex items-center gap-3 pt-1">
              <Skeleton
                width={130}
                height={40}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={12}
              />
              <Skeleton
                width={60}
                height={40}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={12}
              />
            </div>
          </div>

          {/* Reference image picker skeleton */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <Skeleton
              width={120}
              height={18}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
              borderRadius={6}
              className="mb-1"
            />
            <Skeleton
              width={230}
              height={14}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
              borderRadius={4}
              className="mb-3"
            />
            <div className="grid grid-cols-5 gap-1 sm:grid-cols-6 lg:grid-cols-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton
                  key={i}
                  height={0}
                  baseColor="var(--skeleton-base, #e7e5e4)"
                  highlightColor="var(--skeleton-highlight, #f5f5f4)"
                  borderRadius={8}
                  style={{ paddingBottom: "100%" }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right column: generated image skeleton */}
        <div className="w-full shrink-0 lg:sticky lg:top-24 lg:w-[380px]">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <Skeleton
              width={130}
              height={18}
              baseColor="var(--skeleton-base, #e7e5e4)"
              highlightColor="var(--skeleton-highlight, #f5f5f4)"
              borderRadius={6}
              className="mb-3"
            />
            <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-zinc-700">
              <Skeleton
                height={0}
                baseColor="var(--skeleton-base, #e7e5e4)"
                highlightColor="var(--skeleton-highlight, #f5f5f4)"
                borderRadius={0}
                style={{ paddingBottom: "100%" }}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
