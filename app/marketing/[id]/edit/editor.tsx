'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Save,
  Loader2,
  ImageIcon,
  Check,
  Wand2,
  ImagePlus,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  updateMarketingAsset,
  generateMarketingContent,
  generateMarketingImage,
  type MarketingAsset,
  type SourceImage,
} from '@/app/marketing/actions';
import { getTemplateById } from '@/lib/marketing-templates';

type MarketingEditorProps = Readonly<{
  asset: MarketingAsset;
  sourceImages: SourceImage[];
  orgId: string;
  userId: string;
}>;

export function MarketingEditor({
  asset: initialAsset,
  sourceImages,
  orgId,
  userId,
}: MarketingEditorProps) {
  const router = useRouter();
  const template = getTemplateById(initialAsset.template_id);

  const [title, setTitle] = useState(initialAsset.title);
  const [headline, setHeadline] = useState(initialAsset.headline);
  const [body, setBody] = useState(initialAsset.body);
  const [cta, setCta] = useState(initialAsset.cta);
  const [selectedImage, setSelectedImage] = useState(initialAsset.source_image_url ?? '');
  const [generatedImageUrl, setGeneratedImageUrl] = useState(initialAsset.generated_image_url ?? '');
  const [status, setStatus] = useState(initialAsset.status);

  const [generatingText, setGeneratingText] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const orgImages = sourceImages.filter((i) => i.type === 'organization');
  const projectImages = sourceImages.filter((i) => i.type === 'project');
  const inventoryImages = sourceImages.filter((i) => i.type === 'inventory');

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.set('org_id', orgId);
    formData.set('user_id', userId);
    formData.set('title', title);
    formData.set('headline', headline);
    formData.set('body', body);
    formData.set('cta', cta);
    if (selectedImage) formData.set('source_image_url', selectedImage);

    const result = await updateMarketingAsset(initialAsset.id, formData);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Saved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    }
    setSaving(false);
  }, [orgId, userId, title, headline, body, cta, selectedImage, initialAsset.id]);

  const handleGenerateText = useCallback(async () => {
    setGeneratingText(true);
    setError('');

    // Build prompt from existing content context
    const contextPrompt = [
      title && `Title: ${title}`,
      template?.name && `Template: ${template.name}`,
      template?.category && `Category: ${template.category}`,
    ].filter(Boolean).join('. ');

    const result = await generateMarketingContent(
      initialAsset.id,
      orgId,
      userId,
      contextPrompt
    );

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setHeadline(result.data.headline);
      setBody(result.data.body);
      setCta(result.data.cta);
      setStatus('ready');
      setSuccess('AI copy generated!');
      setTimeout(() => setSuccess(''), 5000);
    }
    setGeneratingText(false);
  }, [initialAsset.id, orgId, userId, title, template]);

  const handleGenerateImage = useCallback(async () => {
    setGeneratingImage(true);
    setError('');
    setStatus('generating');

    // Build image prompt from content + reference image context
    const contextParts = [
      `Marketing material for: ${title}`,
      headline && `Headline: ${headline}`,
      body && `Context: ${body}`,
      template?.name && `Style: ${template.name} (${template.category})`,
    ].filter(Boolean).join('. ');

    const result = await generateMarketingImage(
      initialAsset.id,
      orgId,
      userId,
      contextParts
    );

    if (result.error) {
      setError(result.error);
      setStatus('failed');
    } else if (result.imageUrl) {
      setGeneratedImageUrl(result.imageUrl);
      setStatus('ready');
      setSuccess('Image generated!');
      setTimeout(() => setSuccess(''), 5000);
    }
    setGeneratingImage(false);
  }, [initialAsset.id, orgId, userId, title, headline, body, template]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Left column: scrollable — AI buttons, content fields, reference images */}
      <div className="min-w-0 flex-1 space-y-5">
        {/* AI action buttons — compact row */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateText}
            disabled={generatingText}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-500/30 ring-1 ring-indigo-400/50 transition-all hover:shadow-lg hover:shadow-indigo-500/40 hover:brightness-110 disabled:opacity-50"
          >
            {generatingText ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            {generatingText ? 'Writing…' : 'AI Copy'}
          </button>
          <button
            type="button"
            onClick={handleGenerateImage}
            disabled={generatingImage}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-violet-500/30 ring-1 ring-violet-400/50 transition-all hover:shadow-lg hover:shadow-violet-500/40 hover:brightness-110 disabled:opacity-50"
          >
            {generatingImage ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            {generatingImage ? 'Creating…' : 'AI Image'}
          </button>
          <span className="text-[10px] text-stone-400 dark:text-zinc-500">
            Uses title, content &amp; reference image as context
          </span>
        </div>

        {/* Content fields */}
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
              Content
            </h3>
            {template && (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-500 dark:bg-zinc-800 dark:text-zinc-400">
                {template.name}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="edit-title" className="mb-1 block text-xs font-medium text-stone-600 dark:text-zinc-400">
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="edit-headline" className="mb-1 block text-xs font-medium text-stone-600 dark:text-zinc-400">
              Headline
            </label>
            <input
              id="edit-headline"
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className={cn(
                'w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
                status === 'ready'
                  ? 'border-emerald-300 bg-emerald-50/50 text-stone-900 focus:border-emerald-500 dark:border-emerald-500/30 dark:bg-emerald-950/10 dark:text-white'
                  : 'border-stone-200 bg-white text-stone-900 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white'
              )}
            />
          </div>

          <div>
            <label htmlFor="edit-body" className="mb-1 block text-xs font-medium text-stone-600 dark:text-zinc-400">
              Body
            </label>
            <textarea
              id="edit-body"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={cn(
                'w-full resize-none rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
                status === 'ready'
                  ? 'border-emerald-300 bg-emerald-50/50 text-stone-900 focus:border-emerald-500 dark:border-emerald-500/30 dark:bg-emerald-950/10 dark:text-white'
                  : 'border-stone-200 bg-white text-stone-900 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white'
              )}
            />
          </div>

          <div>
            <label htmlFor="edit-cta" className="mb-1 block text-xs font-medium text-stone-600 dark:text-zinc-400">
              Call to Action
            </label>
            <input
              id="edit-cta"
              type="text"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              className={cn(
                'w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
                status === 'ready'
                  ? 'border-emerald-300 bg-emerald-50/50 text-stone-900 focus:border-emerald-500 dark:border-emerald-500/30 dark:bg-emerald-950/10 dark:text-white'
                  : 'border-stone-200 bg-white text-stone-900 focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white'
              )}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {success && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/marketing')}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              Back
            </button>
          </div>
        </div>

        {/* Reference image picker — in left column */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-1 text-sm font-semibold text-stone-900 dark:text-white">
            Reference Image
          </h3>
          <p className="mb-3 text-xs text-stone-500 dark:text-zinc-400">
            Optional: pick a source image for context.
          </p>

          {sourceImages.length === 0 ? (
            <p className="text-xs text-stone-400 dark:text-zinc-500">
              No images available.
            </p>
          ) : (
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {orgImages.length > 0 && (
                <ImageGroup title="Organization" images={orgImages} selectedUrl={selectedImage} onSelect={setSelectedImage} />
              )}
              {projectImages.length > 0 && (
                <ImageGroup title="Projects" images={projectImages} selectedUrl={selectedImage} onSelect={setSelectedImage} />
              )}
              {inventoryImages.length > 0 && (
                <ImageGroup title="Inventory" images={inventoryImages} selectedUrl={selectedImage} onSelect={setSelectedImage} />
              )}
            </div>
          )}

          {selectedImage && (
            <button
              type="button"
              onClick={() => setSelectedImage('')}
              className="mt-2 text-xs text-stone-500 underline hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Clear selection
            </button>
          )}
        </div>
      </div>

      {/* Right column: sticky generated image */}
      <div className="w-full shrink-0 lg:sticky lg:top-24 lg:w-[380px]">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-3 text-sm font-semibold text-stone-900 dark:text-white">
            Generated Image
          </h3>
          <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-zinc-700">
            <div className="relative aspect-square bg-stone-100 dark:bg-zinc-800">
              {generatingImage ? (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                  <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                    Generating image…
                  </p>
                </div>
              ) : generatedImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={generatedImageUrl}
                  alt="Generated marketing image"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <ImageIcon className="h-10 w-10 text-stone-300 dark:text-zinc-600" />
                  <p className="text-xs text-stone-400 dark:text-zinc-500">
                    No image generated yet. Click &quot;AI Image&quot; to create one.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
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
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
        {title}
        <span className="ml-1 font-normal text-stone-300 dark:text-zinc-600">{images.length}</span>
      </p>
      <div className="grid grid-cols-5 gap-1 sm:grid-cols-6 lg:grid-cols-8">
        {images.map((img) => {
          const isSelected = selectedUrl === img.url;
          return (
            <button
              key={img.url}
              type="button"
              onClick={() => onSelect(img.url)}
              className={cn(
                'relative overflow-hidden rounded-lg border-2 transition-all',
                isSelected
                  ? 'border-indigo-500 shadow-sm shadow-indigo-500/20'
                  : 'border-transparent hover:border-stone-300 dark:hover:border-zinc-600'
              )}
            >
              <div className="relative aspect-square bg-stone-100 dark:bg-zinc-800">
                <Image src={img.url} alt={img.label} fill className="object-cover" sizes="48px" />
              </div>
              {isSelected && (
                <div className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-600 text-white">
                  <Check className="h-2 w-2" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
