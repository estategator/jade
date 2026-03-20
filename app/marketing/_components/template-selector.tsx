'use client';

import { useState } from 'react';
import {
  Megaphone,
  Sparkles,
  Clock,
  Quote,
  FileText,
  Tag,
  SignpostBig,
  Mail,
  PartyPopper,
  LayoutDashboard,
  ShoppingBag,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  MARKETING_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type MarketingTemplate,
} from '@/lib/marketing-templates';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Megaphone,
  Sparkles,
  Clock,
  Quote,
  FileText,
  Tag,
  SignpostBig,
  Mail,
  PartyPopper,
  LayoutDashboard,
  ShoppingBag,
};

type TemplateSelectorProps = Readonly<{
  onSelect: (template: MarketingTemplate) => void;
  onCancel: () => void;
}>;

export function TemplateSelector({ onSelect, onCancel }: TemplateSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<string>('social');

  const filtered = MARKETING_TEMPLATES.filter((t) => t.category === activeCategory);

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
            Choose a Template
          </h2>
          <p className="text-sm text-stone-500 dark:text-zinc-400">
            Select a template to start creating your marketing material.
          </p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-stone-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeCategory === cat.id
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-zinc-800 dark:text-indigo-400'
                : 'text-stone-500 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => {
          const Icon = ICON_MAP[template.icon] ?? Sparkles;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template)}
              className="group rounded-2xl border border-stone-200 bg-white p-5 text-left transition-all hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-500/40 dark:hover:shadow-indigo-900/20"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 transition-colors group-hover:bg-indigo-100 dark:bg-indigo-900/20 dark:group-hover:bg-indigo-900/30">
                <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-stone-900 dark:text-white">
                {template.name}
              </h3>
              <p className="mb-2 text-xs text-stone-500 dark:text-zinc-400">
                {template.description}
              </p>
              <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-500 dark:bg-zinc-800 dark:text-zinc-400">
                {template.aspectRatio}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
