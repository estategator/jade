"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { DocusealBuilder } from "@docuseal/react";

import { upsertContractTemplate } from "@/app/contracts/actions";

type DocusealBuilderProps = Readonly<{
  token: string;
  /** Existing Curator template ID when editing */
  curatorTemplateId?: string;
  /** Name to pre-fill for new templates */
  defaultName?: string;
  /** Agreement type to pre-fill */
  agreementType?: string;
}>;

export function DocusealBuilderPage({
  token,
  curatorTemplateId,
  defaultName,
  agreementType,
}: DocusealBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(defaultName ?? "");

  // Track the latest Docuseal template data from builder callbacks
  const [docusealData, setDocusealData] = useState<{
    templateId?: number;
    slug?: string;
    documents?: { url: string; filename?: string }[];
    previewUrl?: string;
  }>({});

  const handleLoad = useCallback((detail: Record<string, unknown>) => {
    if (detail) {
      setDocusealData((prev) => ({
        ...prev,
        templateId: (detail.id as number) ?? prev.templateId,
        slug: (detail.slug as string) ?? prev.slug,
      }));
    }
  }, []);

  const handleSave = useCallback((detail: Record<string, unknown>) => {
    if (detail) {
      const documents = detail.documents as
        | { url: string; filename?: string; preview_image_url?: string }[]
        | undefined;
      setDocusealData((prev) => ({
        ...prev,
        templateId: (detail.id as number) ?? prev.templateId,
        slug: (detail.slug as string) ?? prev.slug,
        documents: documents ?? prev.documents,
        previewUrl: documents?.[0]?.preview_image_url ?? prev.previewUrl,
      }));
    }
  }, []);

  const handleSaveToCurator = () => {
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }

    setError(null);
    setSaved(false);

    const fd = new FormData();
    if (curatorTemplateId) {
      fd.set("template_id", curatorTemplateId);
    }
    fd.set("name", name.trim());
    fd.set("agreement_type", agreementType ?? "estate_sale");

    if (docusealData.templateId) {
      fd.set("docuseal_template_id", String(docusealData.templateId));
    }
    if (docusealData.slug) {
      fd.set("docuseal_slug", docusealData.slug);
    }
    if (docusealData.previewUrl) {
      fd.set("preview_url", docusealData.previewUrl);
    }
    if (docusealData.documents) {
      fd.set("document_urls", JSON.stringify(docusealData.documents));
    }

    startTransition(async () => {
      const res = await upsertContractTemplate(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
      setTimeout(() => {
        router.push("/contracts");
        router.refresh();
      }, 800);
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <Link
            href="/contracts"
            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name…"
              className="border-none bg-transparent text-base font-semibold text-stone-900 outline-none placeholder:text-stone-400 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {error && (
            <span className="text-sm text-red-600 dark:text-red-400">
              {error}
            </span>
          )}
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              Saved!
            </span>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={handleSaveToCurator}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save template
          </button>
        </div>
      </div>

      {/* Builder */}
      <div className="flex-1 overflow-hidden">
        <DocusealBuilder
          token={token}
          onLoad={handleLoad}
          onSave={handleSave}
          withSendButton={false}
          withSignYourselfButton={false}
        />
      </div>
    </div>
  );
}
