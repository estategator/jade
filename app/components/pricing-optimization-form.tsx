'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Loader2, Check, X, ImageOff, ZoomIn } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { processPricingBatch, addPricingResultToInventory, type PricingBatchResult } from '@/app/pricing-optimization/actions';
import { type UserProject } from '@/app/inventory/actions';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type PricingOptimizationFormProps = Readonly<{
  projects: UserProject[];
  userId: string;
}>;

type ConditionKey = 'excellent' | 'good' | 'fair' | 'poor';

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
  const [results, setResults] = useState<(PricingBatchResult & { selectedCondition?: ConditionKey; adding?: boolean; originalFile?: File })[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? '');

  async function handleFiles(files: FileList) {
    setError('');
    setLoading(true);

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
      // Initialize with default condition selection and store original files
      const resultsWithDefaults = result.data.map((r, idx) => ({
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

  async function handleAddToInventory(index: number) {
    const item = results[index];
    if (!item || !item.selectedCondition) return;

    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, adding: true } : r))
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
      setError(result.error);
      setResults((prev) =>
        prev.map((r, i) => (i === index ? { ...r, adding: false } : r))
      );
    } else {
      // Remove from results after successful add
      setResults((prev) => prev.filter((_, i) => i !== index));
    }
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

      {/* Upload Area */}
      {results.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 sm:p-12 rounded-2xl border-2 border-dashed border-stone-200 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors cursor-pointer bg-stone-50 dark:bg-zinc-900/30"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
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
            <Upload className="mx-auto h-12 w-12 text-stone-400 dark:text-zinc-500 mb-4" />
            <h3 className="text-lg font-semibold text-stone-900 dark:text-white mb-2">
              {dragging ? 'Drop images here' : 'Upload item images'}
            </h3>
            <p className="text-sm text-stone-600 dark:text-zinc-400 mb-4">
              Drag & drop up to 10 images, or click to browse. Max 10MB each.
            </p>
            {loading && (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm text-indigo-600 dark:text-indigo-400">Analyzing images...</span>
              </div>
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

      {/* Results Grid */}
      {results.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-stone-900 dark:text-white">
              Pricing Results ({results.length})
            </h2>
            <button
              onClick={() => {
                setResults([]);
                setError('');
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="px-4 py-2 text-sm font-medium text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white"
            >
              Upload more
            </button>
          </div>

          {results.map((item, idx) => (
            <PricingResultCard
              key={idx}
              item={item}
              index={idx}
              onSelectCondition={(condition) => {
                setResults((prev) =>
                  prev.map((r, i) => (i === idx ? { ...r, selectedCondition: condition } : r))
                );
              }}
              onAddToInventory={handleAddToInventory}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

type PricingResultCardProps = Readonly<{
  item: PricingBatchResult & { selectedCondition?: ConditionKey; adding?: boolean; originalFile?: File };
  index: number;
  onSelectCondition: (condition: ConditionKey) => void;
  onAddToInventory: (index: number) => void;
}>;

function ImagePreviewModal({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.2 }}
        className="relative max-w-3xl w-full rounded-2xl overflow-hidden bg-stone-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          aria-label="Close preview"
        >
          <X className="h-5 w-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          className="w-full max-h-[80vh] object-contain"
        />
      </motion.div>
    </motion.div>
  );
}

function PricingResultCard({
  item,
  index,
  onSelectCondition,
  onAddToInventory,
}: PricingResultCardProps) {
  const previewUrl = useMemo(
    () => (item.originalFile ? URL.createObjectURL(item.originalFile) : null),
    [item.originalFile]
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Revoke the object URL when the component unmounts or the file changes.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <>
      <AnimatePresence>
        {isModalOpen && previewUrl && (
          <ImagePreviewModal
            key="modal"
            src={previewUrl}
            name={item.name}
            onClose={() => setIsModalOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row">
          {/* Image Thumbnail */}
          <div className="sm:w-48 sm:flex-shrink-0 bg-stone-100 dark:bg-zinc-800">
            {previewUrl ? (
              <button
                onClick={() => setIsModalOpen(true)}
                className="relative w-full h-48 sm:h-full group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                aria-label={`Enlarge image of ${item.name}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <ZoomIn className="h-7 w-7 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                </div>
              </button>
            ) : (
              <div className="w-full h-48 sm:h-full flex items-center justify-center">
                <ImageOff className="h-10 w-10 text-stone-300 dark:text-zinc-600" />
              </div>
            )}
          </div>

          {/* Card Content */}
          <div className="flex-1 p-6 space-y-4">
            {/* Item Details */}
            <div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">{item.name}</h3>
              <p className="text-sm text-stone-600 dark:text-zinc-400 mt-1">{item.description}</p>
              <p className="text-xs text-stone-500 dark:text-zinc-500 mt-2">
                Category: <span className="font-medium">{item.category}</span>
              </p>
            </div>

            {/* Condition Prices Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(Object.keys(conditionConfig) as ConditionKey[]).map((condition) => {
                const config = conditionConfig[condition];
                const price = item.pricePerCondition[condition];
                const isSelected = item.selectedCondition === condition;

                return (
                  <motion.button
                    key={condition}
                    onClick={() => onSelectCondition(condition)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'p-3 rounded-xl border-2 transition-all cursor-pointer',
                      isSelected
                        ? cn(config.bgLight, config.bgDark, `border-${condition === 'excellent' ? 'emerald' : condition === 'good' ? 'indigo' : condition === 'fair' ? 'amber' : 'red'}-500`)
                        : cn(
                            `border-${condition === 'excellent' ? 'emerald' : condition === 'good' ? 'indigo' : condition === 'fair' ? 'amber' : 'red'}-200`,
                            `dark:border-${condition === 'excellent' ? 'emerald' : condition === 'good' ? 'indigo' : condition === 'fair' ? 'amber' : 'red'}-800`,
                            'bg-white dark:bg-zinc-800/50'
                          )
                    )}
                  >
                    <div className={cn('text-xs font-semibold mb-1', isSelected ? cn(config.textLight, config.textDark) : 'text-stone-600 dark:text-zinc-400')}>
                      {config.label}
                    </div>
                    <div className={cn('text-lg font-bold', isSelected ? cn(config.textLight, config.textDark) : 'text-stone-900 dark:text-white')}>
                      ${price.toFixed(2)}
                    </div>
                    {isSelected && (
                      <Check className={cn('h-4 w-4 mt-1', config.textLight, config.textDark)} />
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Add to Inventory Button */}
            <button
              onClick={() => onAddToInventory(index)}
              disabled={item.adding}
              className={cn(
                'w-full px-4 py-2 rounded-lg font-medium text-sm transition-all',
                item.adding
                  ? 'bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-500 cursor-not-allowed'
                  : 'bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600'
              )}
            >
              {item.adding ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </div>
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
