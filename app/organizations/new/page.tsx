"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/page-header";
import { createOrganization } from "@/app/organizations/actions";

export default function NewOrganizationPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserId(session.user.id);
      setLoading(false);
    }
    checkAuth();
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("user_id", userId);
    if (imageFile) {
      formData.append("image", imageFile);
    }

    const result = await createOrganization(formData);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      router.push("/organizations");
    }
  }

  function processFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10 MB.");
      return;
    }
    setError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Create organization"
        backLink={{ href: "/organizations", label: "Organizations" }}
      />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
            >
              {error}
            </motion.p>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300"
              >
                Organization name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Estate Sales"
                className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
              />
            </div>

            {/* Cover image */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                Cover image{" "}
                <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {imagePreview ? (
                <div className="relative overflow-hidden rounded-xl border border-stone-200 dark:border-zinc-700">
                  <Image
                    src={imagePreview}
                    alt="Cover preview"
                    width={600}
                    height={300}
                    className="w-full max-h-56 object-cover"
                  />
                  <div className="absolute right-2 top-2">
                    <button
                      type="button"
                      onClick={removeImage}
                      className="rounded-lg bg-stone-900/70 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-stone-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition-all ${
                    dragging
                      ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-900/10"
                      : "border-stone-300 bg-white hover:border-indigo-300 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-800 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <Upload className="h-6 w-6 text-stone-400 dark:text-zinc-500" />
                  <p className="text-sm font-medium text-stone-900 dark:text-white">Click or drag an image</p>
                  <p className="text-xs text-stone-500 dark:text-zinc-500">JPG, PNG, or WebP up to 10 MB</p>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create organization
              </button>
              <Link
                href="/organizations"
                className="text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
              >
                Cancel
              </Link>
            </div>
          </form>
        </motion.div>
    </>
  );
}
