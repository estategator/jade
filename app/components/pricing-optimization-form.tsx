'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PiUploadDuotone,
  PiSpinnerDuotone,
  PiCheckDuotone,
  PiXDuotone,
  PiImageBrokenDuotone,
  PiMagnifyingGlassPlusDuotone,
  PiRowsDuotone,
  PiGridFourDuotone,
  PiPackageDuotone,
  PiTrashDuotone,
  PiCheckCircleDuotone,
  PiCameraDuotone,
} from 'react-icons/pi';
import { cn } from '@/lib/cn';
import { processPricingBatch, addPricingResultToInventory, type PricingBatchResult } from '@/app/pricing-optimization/actions';
import { type UserProject } from '@/app/inventory/actions';

type PricingOptimizationFormProps = Readonly<{
  projects: UserProject[];
  userId: string;
}>;

type ConditionKey = 'excellent' | 'good' | 'fair' | 'poor';
type ViewDensity = 'comfortable' | 'compact';

const conditionStops: ConditionKey[] = ['poor', 'fair', 'good', 'excellent'];

type ResultItem = PricingBatchResult & {
  selectedCondition: ConditionKey;
  adding?: boolean;
  originalFile?: File;
  error?: string;
};

const conditionConfig: Record<
  ConditionKey,
  {
    label: string;
    bgLight: string;
    bgDark: string;
    textLight: string;
    textDark: string;
    borderLight: string;
    borderDark: string;
  }
> = {
  excellent: {
    label: 'Excellent',
    bgLight: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-900/20',
    textLight: 'text-emerald-700',
    textDark: 'dark:text-emerald-300',
    borderLight: 'border-emerald-500',
    borderDark: 'dark:border-emerald-600',
  },
  good: {
    label: 'Good',
    bgLight: 'bg-indigo-50',
    bgDark: 'dark:bg-indigo-900/20',
    textLight: 'text-indigo-700',
    textDark: 'dark:text-indigo-300',
    borderLight: 'border-indigo-500',
    borderDark: 'dark:border-indigo-600',
  },
  fair: {
    label: 'Fair',
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-900/20',
    textLight: 'text-amber-700',
    textDark: 'dark:text-amber-300',
    borderLight: 'border-amber-500',
    borderDark: 'dark:border-amber-600',
  },
  poor: {
    label: 'Poor',
    bgLight: 'bg-red-50',
    bgDark: 'dark:bg-red-900/20',
    textLight: 'text-red-700',
    textDark: 'dark:text-red-300',
    borderLight: 'border-red-500',
    borderDark: 'dark:border-red-600',
  },
};

export function PricingOptimizationForm({ projects, userId }: PricingOptimizationFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? '');
  const [viewDensity, setViewDensityState] = useState<ViewDensity>('comfortable');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const isCompact = viewDensity === 'compact';

  useEffect(() => {
    const saved = localStorage.getItem('pricing-view-density') as ViewDensity;
    if (saved === 'comfortable' || saved === 'compact') {
      setViewDensityState(saved);
    }
  }, []);

  const setViewDensity = useCallback((density: ViewDensity) => {
    setViewDensityState(density);
    localStorage.setItem('pricing-view-density', density);
  }, []);

  async function handleFiles(files: FileList) {
    setError('');
    setLoading(true);
    setSelected(new Set());

    const formData = new FormData();
    const fileArray: File[] = [];
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
      fileArray.push(files[i]);
    }

    const result = await processPricingBatch(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.data) {
      const resultsWithDefaults: ResultItem[] = result.data.map((r, idx) => ({
        ...r,
        selectedCondition: 'good' as ConditionKey,
        originalFile: fileArray[idx],
      }));
      setResults(resultsWithDefaults);
    }

    setLoading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }

  function showSuccess(msg: string) {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  }

  async function handleAddToInventory(index: number) {
    const item = results[index];
    if (!item?.selectedCondition) return;

    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, adding: true, error: undefined } : r))
    );

    const result = await addPricingResultToInventory(
      item.name,
      item.description,
      item.category,
      item.selectedCondition,
      item.pricePerCondition,
      selectedProjectId || projects[0]?.id || '',
      userId,
      item.originalFile
    );

    if (result.error) {
      setResults((prev) =>
        prev.map((r, i) => (i === index ? { ...r, adding: false, error: result.error } : r))
      );
    } else {
      showSuccess(`"${item.name}" added to inventory`);
      setResults((prev) => prev.filter((_, i) => i !== index));
      setSelected((prev) => {
        const next = new Set<number>();
        for (const idx of prev) {
          if (idx < index) next.add(idx);
          else if (idx > index) next.add(idx - 1);
        }
        return next;
      });
    }
  }

  async function handleBulkAdd() {
    if (selected.size === 0 || bulkAdding) return;
    setBulkAdding(true);

    const selectedIndices = Array.from(selected);
    const succeeded = new Set<number>();

    for (const idx of selectedIndices) {
      const item = results[idx];
      if (!item?.selectedCondition) continue;

      setResults((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, adding: true, error: undefined } : r))
      );

      const result = await addPricingResultToInventory(
        item.name,
        item.description,
        item.category,
        item.selectedCondition,
        item.pricePerCondition,
        selectedProjectId || projects[0]?.id || '',
        userId,
        item.originalFile
      );

      if (result.error) {
        setResults((prev) =>
          prev.map((r, i) => (i === idx ? { ...r, adding: false, error: result.error } : r))
        );
      } else {
        succeeded.add(idx);
      }
    }

    if (succeeded.size > 0) {
      setResults((prev) => prev.filter((_, i) => !succeeded.has(i)));
    }

    if (succeeded.size > 0) {
      showSuccess(`${succeeded.size} item${succeeded.size > 1 ? 's' : ''} added to inventory`);
    }
    setSelected(new Set());
    setBulkAdding(false);
  }

  function handleToggleSelect(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleToggleSelectAll() {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((_, i) => i)));
    }
  }

  function handleRemoveSelected() {
    if (selected.size === 0) return;
    setResults((prev) => prev.filter((_, i) => !selected.has(i)));
    setSelected(new Set());
  }

  function handleUploadMore() {
    setResults([]);
    setError('');
    setSelected(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="mt-8 space-y-8">
      {/* Project Selector */}
      {projects.length > 0 && (
        <div className="p-4 sm:p-6 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
          <label className="block text-sm font-medium text-stone-900 dark:text-white mb-3">
            Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-900 dark:text-white"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.org_name})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Success Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg"
          >
            <PiCheckCircleDuotone className="h-5 w-5" />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Area */}
      {results.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-8 sm:p-12 rounded-2xl border-2 border-dashed transition-all cursor-pointer',
            dragging
              ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10 scale-[1.01]'
              : 'border-stone-200 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-stone-50 dark:bg-zinc-900/30'
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !loading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
            disabled={loading}
          />

          <div className="text-center">
            {loading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-5"
              >
                <PiCameraDuotone className="mx-auto h-12 w-12 text-indigo-500 dark:text-indigo-400" />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-stone-900 dark:text-white">
                    Analyzing your items…
                  </h3>
                  <p className="text-sm text-stone-500 dark:text-zinc-400">
                    AI is identifying items and generating pricing recommendations
                  </p>
                </div>
                <div className="mx-auto max-w-xs">
                  <div className="h-1.5 rounded-full bg-stone-200 dark:bg-zinc-700 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-indigo-500"
                      initial={{ width: '5%' }}
                      animate={{ width: '85%' }}
                      transition={{ duration: 8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <>
                <PiUploadDuotone className={cn(
                  'mx-auto h-12 w-12 mb-4 transition-colors',
                  dragging ? 'text-indigo-500 dark:text-indigo-400' : 'text-stone-400 dark:text-zinc-500'
                )} />
                <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
                  {dragging ? 'Drop images here' : 'Upload item images'}
                </h3>
                <p className="text-sm text-stone-600 dark:text-zinc-400 mb-1">
                  Drag & drop up to 10 images, or click to browse
                </p>
                <p className="text-xs text-stone-400 dark:text-zinc-500">
                  JPG, PNG, WebP — max 10 MB each
                </p>
              </>
            )}
          </div>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Results Section */}
      {results.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Results Toolbar */}
          <div className="sticky top-16 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-stone-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-stone-200/50 dark:border-zinc-800/50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                  Results ({results.length})
                </h2>
                <button
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-lg text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {selected.size === results.length && results.length > 0 ? (
                    <PiCheckDuotone className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded border border-stone-300 dark:border-zinc-600" />
                  )}
                  {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                {/* Density Toggle */}
                <div className="flex items-center rounded-lg border border-stone-200 dark:border-zinc-700 overflow-hidden">
                  <button
                    onClick={() => setViewDensity('comfortable')}
                    className={cn(
                      'p-1.5 transition-colors',
                      !isCompact
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-stone-400 dark:text-zinc-500 hover:text-stone-600 dark:hover:text-zinc-300'
                    )}
                    aria-label="Comfortable view"
                  >
                    <PiGridFourDuotone className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewDensity('compact')}
                    className={cn(
                      'p-1.5 transition-colors',
                      isCompact
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-stone-400 dark:text-zinc-500 hover:text-stone-600 dark:hover:text-zinc-300'
                    )}
                    aria-label="Compact view"
                  >
                    <PiRowsDuotone className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={handleUploadMore}
                  className="px-3 py-1.5 text-sm font-medium text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                >
                  Upload more
                </button>
              </div>
            </div>

            {/* Bulk Action Bar */}
            <AnimatePresence>
              {selected.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 pt-3">
                    <button
                      onClick={handleBulkAdd}
                      disabled={bulkAdding}
                      className={cn(
                        'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                        bulkAdding
                          ? 'bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-500 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 dark:hover:bg-indigo-500'
                      )}
                    >
                      {bulkAdding ? (
                        <PiSpinnerDuotone className="h-4 w-4 animate-spin" />
                      ) : (
                        <PiPackageDuotone className="h-4 w-4" />
                      )}
                      Add {selected.size} to Inventory
                    </button>
                    <button
                      onClick={handleRemoveSelected}
                      disabled={bulkAdding}
                      className={cn(
                        'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                        bulkAdding
                          ? 'text-stone-400 dark:text-zinc-600 cursor-not-allowed'
                          : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                      )}
                    >
                      <PiTrashDuotone className="h-4 w-4" />
                      Remove {selected.size}
                    </button>
                    <button
                      onClick={() => setSelected(new Set())}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-stone-500 dark:text-zinc-400 hover:text-stone-700 dark:hover:text-zinc-200 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Result Cards */}
          <div className={cn('space-y-4', isCompact && 'space-y-2')}>
            {results.map((item, idx) => (
              <PricingResultCard
                key={idx}
                item={item}
                index={idx}
                compact={isCompact}
                isSelected={selected.has(idx)}
                onToggleSelect={() => handleToggleSelect(idx)}
                onSelectCondition={(condition) => {
                  setResults((prev) =>
                    prev.map((r, i) => (i === idx ? { ...r, selectedCondition: condition } : r))
                  );
                }}
                onAddToInventory={handleAddToInventory}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

type PricingResultCardProps = Readonly<{
  item: ResultItem;
  index: number;
  compact: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onSelectCondition: (condition: ConditionKey) => void;
  onAddToInventory: (index: number) => void;
}>;

import { Modal } from "@/app/components/ui/modal";

function ImagePreviewModal({ open, src, name, onClose }: { open: boolean; src: string; name: string; onClose: () => void }) {
  return (
    <Modal open={open} size="xl" panelClassName="p-0 max-w-3xl overflow-hidden bg-stone-900 shadow-2xl dark:border-zinc-700">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          aria-label="Close preview"
        >
          <PiXDuotone className="h-5 w-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          className="w-full max-h-[80vh] object-contain"
        />
    </Modal>
  );
}

function ConditionSlider({
  value,
  pricePerCondition,
  onChange,
  compact,
}: Readonly<{
  value: ConditionKey;
  pricePerCondition: Record<ConditionKey, number>;
  onChange: (condition: ConditionKey) => void;
  compact?: boolean;
}>) {
  const stopIndex = conditionStops.indexOf(value);
  const config = conditionConfig[value];
  const price = pricePerCondition[value];

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider',
            config.textLight,
            config.textDark
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              config.bgLight,
              config.bgDark
            )}
          />
          {config.label}
        </span>
        <span
          className={cn(
            'font-bold font-mono',
            compact ? 'text-lg' : 'text-2xl',
            config.textLight,
            config.textDark
          )}
        >
          ${price.toFixed(2)}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={3}
        step={1}
        value={stopIndex}
        onChange={(e) => onChange(conditionStops[parseInt(e.target.value)])}
        className={cn(
          'w-full h-1.5 appearance-none rounded-full cursor-pointer bg-stone-200 dark:bg-zinc-700',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:shadow-md',
          '[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110',
          '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:bg-indigo-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer'
        )}
        aria-label="Condition slider"
      />

      <div className="flex justify-between">
        {conditionStops.map((stop) => (
          <button
            key={stop}
            onClick={() => onChange(stop)}
            className={cn(
              'text-[10px] font-medium transition-colors',
              stop === value
                ? cn(conditionConfig[stop].textLight, conditionConfig[stop].textDark)
                : 'text-stone-400 dark:text-zinc-500 hover:text-stone-600 dark:hover:text-zinc-300'
            )}
          >
            {conditionConfig[stop].label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PricingResultCard({
  item,
  index,
  compact,
  isSelected,
  onToggleSelect,
  onSelectCondition,
  onAddToInventory,
}: PricingResultCardProps) {
  const previewUrl = useMemo(
    () => (item.originalFile ? URL.createObjectURL(item.originalFile) : null),
    [item.originalFile]
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <>
      <ImagePreviewModal
        open={isModalOpen && !!previewUrl}
        src={previewUrl ?? ""}
        name={item.name}
        onClose={() => setIsModalOpen(false)}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={cn(
          'rounded-2xl border overflow-hidden transition-colors',
          isSelected
            ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-900/10'
            : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50'
        )}
      >
        <div className="flex flex-col sm:flex-row">
          {/* Selection + Image */}
          <div
            className={cn(
              'relative sm:flex-shrink-0 bg-stone-100 dark:bg-zinc-800',
              compact ? 'sm:w-32' : 'sm:w-48'
            )}
          >
            <button
              onClick={onToggleSelect}
              className="absolute top-2 left-2 z-10 p-1 rounded-md bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-stone-200 dark:border-zinc-700 transition-colors hover:bg-white dark:hover:bg-zinc-900"
              aria-label={isSelected ? 'Deselect item' : 'Select item'}
            >
              {isSelected ? (
                <PiCheckDuotone className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-sm border border-stone-300 dark:border-zinc-600" />
              )}
            </button>

            {previewUrl ? (
              <button
                onClick={() => setIsModalOpen(true)}
                className={cn(
                  'relative w-full group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500',
                  compact ? 'h-32 sm:h-full' : 'h-48 sm:h-full'
                )}
                aria-label={`Enlarge image of ${item.name}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <PiMagnifyingGlassPlusDuotone
                    className={cn(
                      'text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg',
                      compact ? 'h-5 w-5' : 'h-7 w-7'
                    )}
                  />
                </div>
              </button>
            ) : (
              <div
                className={cn(
                  'w-full flex items-center justify-center',
                  compact ? 'h-32 sm:h-full' : 'h-48 sm:h-full'
                )}
              >
                <PiImageBrokenDuotone
                  className={cn(
                    'text-stone-300 dark:text-zinc-600',
                    compact ? 'h-8 w-8' : 'h-10 w-10'
                  )}
                />
              </div>
            )}
          </div>

          {/* Card Content */}
          <div className={cn('flex-1', compact ? 'p-3 space-y-2' : 'p-6 space-y-4')}>
            {/* Item Details */}
            <div className={compact ? 'flex items-start justify-between gap-3' : ''}>
              <div className={compact ? 'min-w-0 flex-1' : ''}>
                <h3
                  className={cn(
                    'font-bold text-stone-900 dark:text-white',
                    compact ? 'text-sm' : 'text-lg'
                  )}
                >
                  {item.name}
                </h3>
                <p
                  className={cn(
                    'text-stone-600 dark:text-zinc-400',
                    compact ? 'text-xs line-clamp-1 mt-0.5' : 'text-sm mt-1'
                  )}
                >
                  {item.description}
                </p>
                <p
                  className={cn(
                    'text-stone-500 dark:text-zinc-500',
                    compact ? 'text-[10px] mt-0.5' : 'text-xs mt-2'
                  )}
                >
                  Category: <span className="font-medium">{item.category}</span>
                </p>
              </div>
            </div>

            {/* Condition Slider */}
            <ConditionSlider
              value={item.selectedCondition}
              pricePerCondition={item.pricePerCondition}
              onChange={onSelectCondition}
              compact={compact}
            />

            {/* Condition chips with price summary */}
            <div className={cn('flex flex-wrap gap-2', compact && 'gap-1.5')}>
              {conditionStops.map((condition) => {
                const config = conditionConfig[condition];
                const isActive = item.selectedCondition === condition;
                return (
                  <button
                    key={condition}
                    onClick={() => onSelectCondition(condition)}
                    className={cn(
                      'rounded-lg font-medium transition-all',
                      compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
                      isActive
                        ? cn(config.bgLight, config.bgDark, config.textLight, config.textDark, 'ring-1', config.borderLight, config.borderDark)
                        : 'bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400 hover:bg-stone-200 dark:hover:bg-zinc-700'
                    )}
                  >
                    {config.label} · ${item.pricePerCondition[condition].toFixed(0)}
                  </button>
                );
              })}
            </div>

            {/* Per-item error */}
            {item.error && (
              <p className="text-xs text-red-600 dark:text-red-400">{item.error}</p>
            )}

            {/* Add to Inventory Button */}
            <button
              onClick={() => onAddToInventory(index)}
              disabled={item.adding}
              className={cn(
                'w-full rounded-lg font-medium transition-all',
                compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
                item.adding
                  ? 'bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-500 cursor-not-allowed'
                  : 'bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600'
              )}
            >
              {item.adding ? (
                <span className="flex items-center justify-center gap-2">
                  <PiSpinnerDuotone className="h-4 w-4 animate-spin" />
                  Adding…
                </span>
              ) : (
                'Add to Inventory'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
