'use client';

import { useState } from 'react';
import type { MarketingAsset, SourceImage } from '@/app/marketing/actions';
import { TemplateSelector } from './template-selector';
import { MarketingForm } from './marketing-form';
import { AssetGrid } from './asset-grid';
import type { MarketingTemplate } from '@/lib/marketing-templates';

type MarketingDashboardProps = Readonly<{
  assets: MarketingAsset[];
  sourceImages: SourceImage[];
  projects: { id: string; name: string }[];
  orgId: string;
  userId: string;
  initialError?: string;
}>;

export function MarketingDashboard({
  assets: initialAssets,
  sourceImages,
  projects,
  orgId,
  userId,
  initialError,
}: MarketingDashboardProps) {
  const [view, setView] = useState<'grid' | 'create'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<MarketingTemplate | null>(null);
  const [assets, setAssets] = useState<MarketingAsset[]>(initialAssets);
  const [filterProject, setFilterProject] = useState<string>('');

  const handleSelectTemplate = (template: MarketingTemplate) => {
    setSelectedTemplate(template);
    setView('create');
  };

  const handleCreated = (asset: MarketingAsset) => {
    setAssets((prev) => [asset, ...prev]);
    setView('grid');
    setSelectedTemplate(null);
  };

  const handleCancel = () => {
    setView('grid');
    setSelectedTemplate(null);
  };

  const handleDeleted = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const filteredAssets = filterProject
    ? assets.filter((a) => a.project_id === filterProject)
    : assets;

  if (initialError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800/50 dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">{initialError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {view === 'grid' && (
        <>
          {/* Controls bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {projects.length > 0 && (
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  <option value="">All projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <span className="text-sm text-stone-400 dark:text-zinc-500">
                {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setView('create')}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Create Material
            </button>
          </div>

          <AssetGrid
            assets={filteredAssets}
            orgId={orgId}
            userId={userId}
            onDeleted={handleDeleted}
          />
        </>
      )}

      {view === 'create' && !selectedTemplate && (
        <TemplateSelector
          onSelect={handleSelectTemplate}
          onCancel={handleCancel}
        />
      )}

      {view === 'create' && selectedTemplate && (
        <MarketingForm
          template={selectedTemplate}
          sourceImages={sourceImages}
          projects={projects}
          orgId={orgId}
          userId={userId}
          onCreated={handleCreated}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
