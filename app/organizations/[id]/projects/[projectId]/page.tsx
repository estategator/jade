"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, Save, Upload, X, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/page-header";
import {
  getProject,
  getOrganization,
  updateProject,
  deleteProject,
  type Project,
} from "@/app/organizations/actions";
import ConfirmDeleteModal from "@/app/components/confirm-delete-modal";

export default function ProjectEditPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;
  const projectId = params.projectId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [warning, setWarning] = useState("");
  const [userId, setUserId] = useState("");
  const [orgName, setOrgName] = useState("");
  const [project, setProject] = useState<Project | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserId(session.user.id);

      const [orgResult, projectResult] = await Promise.all([
        getOrganization(orgId),
        getProject(projectId),
      ]);

      if (orgResult.data) setOrgName(orgResult.data.name);

      if (projectResult.data) {
        const p = projectResult.data;
        setProject(p);
        setName(p.name);
        setDescription(p.description);
        setImagePreview(p.cover_image_url);
      } else {
        setError("Project not found.");
      }

      setLoading(false);
    }
    init();
  }, [router, orgId, projectId]);

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

  async function handleSave() {
    setError("");
    setSuccess("");
    setWarning("");
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    setSaving(true);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    if (imageFile) {
      formData.append("image", imageFile);
    }

    const result = await updateProject(projectId, formData);

    if (result.error) {
      setError(result.error);
    } else {
      if (result.warning) {
        setWarning(result.warning);
      }
      setSuccess(result.warning ? "" : "Project updated.");
      setImageFile(null);
      // Refresh project data
      const refreshed = await getProject(projectId);
      if (refreshed.data) {
        setProject(refreshed.data);
        setImagePreview(refreshed.data.cover_image_url);
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    const result = await deleteProject(projectId, userId, orgId);
    if (result.error) {
      setError(result.error);
    } else {
      router.push(`/organizations/${orgId}`);
    }
    setDeleteModalOpen(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <>
        <PageHeader
          title="Project not found"
          backLink={{ href: `/organizations/${orgId}`, label: orgName || "Organization" }}
        />
        <p className="mt-6 text-sm text-stone-500 dark:text-zinc-400">
          This project doesn&apos;t exist or you don&apos;t have access to it.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Edit project"
        description={project.name}
        backLink={{ href: `/organizations/${orgId}`, label: orgName || "Organization" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-8"
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

        {success && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400"
          >
            {success}
          </motion.p>
        )}

        {warning && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-600 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-400"
          >
            {warning}
          </motion.p>
        )}

        <div className="space-y-6">
          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300"
            >
              Project name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring 2026 Estate Sale"
              className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300"
            >
              Description{" "}
              <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this project…"
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
                  unoptimized
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

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </button>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-50 dark:border-red-900/40 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-4 w-4" />
              Delete project
            </button>
            <Link
              href={`/organizations/${orgId}`}
              className="text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
            >
              Cancel
            </Link>
          </div>
        </div>
      </motion.div>

      <ConfirmDeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        entityName={project.name}
        entityType="project"
        description={`Are you sure you want to delete "${project.name}"? All inventory items in this project will be unlinked. This action cannot be undone.`}
      />
    </>
  );
}
