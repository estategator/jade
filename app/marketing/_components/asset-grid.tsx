'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { deleteMarketingAsset, type MarketingAsset } from '@/app/marketing/actions';
import { getTemplateById } from '@/lib/marketing-templates';
import ConfirmDeleteModal from '@/app/components/confirm-delete-modal';

type AssetGridProps = Readonly<{
  assets: MarketingAsset[];
  orgId: string;
  userId: string;
  onDeleted: (id: string) => void;
}>;

export function AssetGrid({ assets, orgId, userId, onDeleted }: AssetGridProps) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const result = await deleteMarketingAsset(deleteTarget.id, orgId, userId);
    if (result.error) return;

    onDeleted(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (assets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <ImageIcon className="mx-auto mb-3 h-10 w-10 text-stone-300 dark:text-zinc-600" />
        <h3 className="mb-1 text-sm font-semibold text-stone-700 dark:text-zinc-300">
          No marketing materials yet
        </h3>
        <p className="text-sm text-stone-500 dark:text-zinc-400">
          Click &quot;Create Material&quot; to get started with a template.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {assets.map((asset) => {
          const template = getTemplateById(asset.template_id);
          const statusColors: Record<string, string> = {
            draft: 'bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-400',
            generating: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
            ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
            failed: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
          };

          return (
            <div
              key={asset.id}
              className="group relative overflow-hidden rounded-xl border border-stone-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <Link
                href={`/marketing/${asset.id}/edit`}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl"
              >
                {/* Image preview */}
                <div className="relative aspect-[4/3] bg-stone-100 dark:bg-zinc-800">
                  {asset.generated_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.generated_image_url}
                      alt={asset.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : asset.source_image_url ? (
                    <Image
                      src={asset.source_image_url}
                      alt={asset.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-stone-300 dark:text-zinc-600" />
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-3">
                  <div className="mb-1 flex items-start justify-between gap-1">
                    <h3 className="truncate text-xs font-semibold text-stone-900 dark:text-white">
                      {asset.title}
                    </h3>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-1.5 py-px text-[9px] font-medium uppercase tracking-wider',
                        statusColors[asset.status] ?? statusColors.draft
                      )}
                    >
                      {asset.status}
                    </span>
                  </div>

                  {asset.headline && (
                    <p className="mb-1 truncate text-[11px] font-medium text-stone-600 dark:text-zinc-300">
                      {asset.headline}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 text-[9px] text-stone-400 dark:text-zinc-500">
                    {template && (
                      <span className="truncate rounded bg-stone-100 px-1 py-px dark:bg-zinc-800">
                        {template.name}
                      </span>
                    )}
                    <span className="ml-auto shrink-0">
                      {new Date(asset.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>

              {/* Delete button overlay */}
              <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteTarget({ id: asset.id, title: asset.title });
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-red-600 shadow-sm transition-colors hover:bg-red-50 dark:bg-zinc-900/90 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          entityName={deleteTarget.title}
          entityType="marketing material"
          description="This action cannot be undone."
        />
      )}
    </>
  );
}
