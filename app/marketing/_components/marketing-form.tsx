'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ImageIcon, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { createMarketingAsset, type MarketingAsset, type SourceImage } from '@/app/marketing/actions';
import type { MarketingTemplate } from '@/lib/marketing-templates';

type MarketingFormProps = Readonly<{
  template: MarketingTemplate;
  sourceImages: SourceImage[];
  projects: { id: string; name: string }[];
  orgId: string;
  userId: string;
  onCreated: (asset: MarketingAsset) => void;
  onCancel: () => void;
}>;

export function MarketingForm({
  template,
  sourceImages,
  projects,
  orgId,
  userId,
  onCreated,
  onCancel,
}: MarketingFormProps) {
  const [title, setTitle] = useState(template.name);
  const [headline, setHeadline] = useState(template.defaultHeadline);
  const [body, setBody] = useState(template.defaultBody);
  const [cta, setCta] = useState(template.defaultCta);
  const [projectId, setProjectId] = useState('');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Group images by type
  const orgImages = sourceImages.filter((i) => i.type === 'organization');
  const projectImages = sourceImages.filter((i) => i.type === 'project');
  const inventoryImages = sourceImages.filter((i) => i.type === 'inventory');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.set('org_id', orgId);
    formData.set('user_id', userId);
    formData.set('template_id', template.id);
    formData.set('title', title);
    formData.set('headline', headline);
    formData.set('body', body);
    formData.set('cta', cta);
    if (projectId) formData.set('project_id', projectId);
    if (selectedImage) formData.set('source_image_url', selectedImage);

    const result = await createMarketingAsset(formData);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    if (result.data) {
      onCreated(result.data);
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-white">
            {template.name}
          </h2>
          <p className="text-sm text-stone-500 dark:text-zinc-400">
            {template.description}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
        {/* Left: Content fields */}
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
            Content
          </h3>

          <div>
            <label htmlFor="mk-title" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
              Title
            </label>
            <input
              id="mk-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="mk-headline" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
              Headline
            </label>
            <input
              id="mk-headline"
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="mk-body" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
              Body
            </label>
            <textarea
              id="mk-body"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>

          <div>
            <label htmlFor="mk-cta" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
              Call to Action
            </label>
            <input
              id="mk-cta"
              type="text"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>

          {projects.length > 0 && (
            <div>
              <label htmlFor="mk-project" className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                Project (optional)
              </label>
              <select
                id="mk-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create Material'}
          </button>
        </div>

        {/* Right: Source image picker */}
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
            Source Image
          </h3>
          <p className="text-xs text-stone-500 dark:text-zinc-400">
            Select an image from your organization, projects, or inventory to use as the base for your marketing material.
          </p>

          {sourceImages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-300 p-8 dark:border-zinc-700">
              <ImageIcon className="h-8 w-8 text-stone-300 dark:text-zinc-600" />
              <p className="text-sm text-stone-400 dark:text-zinc-500">
                No images available. Upload images to your organization, projects, or inventory first.
              </p>
            </div>
          ) : (
            <div className="max-h-[480px] space-y-4 overflow-y-auto">
              {orgImages.length > 0 && (
                <ImageGroup
                  title="Organization"
                  images={orgImages}
                  selectedUrl={selectedImage}
                  onSelect={setSelectedImage}
                />
              )}
              {projectImages.length > 0 && (
                <ImageGroup
                  title="Projects"
                  images={projectImages}
                  selectedUrl={selectedImage}
                  onSelect={setSelectedImage}
                />
              )}
              {inventoryImages.length > 0 && (
                <ImageGroup
                  title="Inventory Items"
                  images={inventoryImages}
                  selectedUrl={selectedImage}
                  onSelect={setSelectedImage}
                />
              )}
            </div>
          )}

          {selectedImage && (
            <button
              type="button"
              onClick={() => setSelectedImage('')}
              className="text-xs text-stone-500 underline hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Clear selection
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function ImageGroup({
  title,
  images,
  selectedUrl,
  onSelect,
}: {
  title: string;
  images: SourceImage[];
  selectedUrl: string;
  onSelect: (url: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
        {title}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {images.map((img) => {
          const isSelected = selectedUrl === img.url;
          return (
            <button
              key={img.url}
              type="button"
              onClick={() => onSelect(img.url)}
              className={cn(
                'group relative overflow-hidden rounded-xl border-2 transition-all',
                isSelected
                  ? 'border-indigo-500 shadow-md shadow-indigo-500/20'
                  : 'border-transparent hover:border-stone-300 dark:hover:border-zinc-600'
              )}
            >
              <div className="relative aspect-square bg-stone-100 dark:bg-zinc-800">
                <Image
                  src={img.url}
                  alt={img.label}
                  fill
                  className="object-cover"
                  sizes="120px"
                />
              </div>
              {isSelected && (
                <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                  <Check className="h-3 w-3" />
                </div>
              )}
              <p className="truncate px-1 py-1 text-[10px] text-stone-500 dark:text-zinc-400">
                {img.label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
