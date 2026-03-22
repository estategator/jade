"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, Save, Upload, X, Trash2, Phone, Globe, GlobeLock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/page-header";
import {
  getProject,
  getOrganization,
  updateProject,
  deleteProject,
  toggleProjectPublished,
  type Project,
} from "@/app/organizations/actions";
import ConfirmDeleteModal from "@/app/components/confirm-delete-modal";

const US_STATES = [
  { value: "", label: "Select state" },
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" }, { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" }, { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" }, { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" }, { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" }, { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" }, { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" }, { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" }, { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" }, { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" }, { value: "DC", label: "District of Columbia" },
];

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
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [projectState, setProjectState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);

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
        setPhone(p.phone ?? "");
        setAddressLine1(p.address_line1 ?? "");
        setAddressLine2(p.address_line2 ?? "");
        setCity(p.city ?? "");
        setProjectState(p.state ?? "");
        setZipCode(p.zip_code ?? "");
        setImagePreview(p.cover_image_url);
        setPublished(p.published ?? false);
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
    formData.append("phone", phone);
    formData.append("address_line1", addressLine1);
    formData.append("address_line2", addressLine2);
    formData.append("city", city);
    formData.append("state", projectState);
    formData.append("zip_code", zipCode);
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

  async function handleTogglePublish() {
    setPublishing(true);
    setError("");
    const result = await toggleProjectPublished(projectId, userId, !published);
    if (result.error) {
      setError(result.error);
    } else {
      setPublished(!published);
    }
    setPublishing(false);
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
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Edit project"
        description={project.name}
        backLink={{ href: `/organizations/${orgId}`, label: orgName || "Organization" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto mt-8 max-w-4xl"
      >
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
          >
            {error}
          </motion.p>
        )}

        {success && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400"
          >
            {success}
          </motion.p>
        )}

        {warning && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-600 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-400"
          >
            {warning}
          </motion.p>
        )}

        <div className="space-y-6">
          {/* Project Details */}
          <SettingsSection title="Project Details" description="Name and description">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="settings-label">Project name</label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Spring 2026 Estate Sale"
                  className="settings-input"
                />
              </div>
              <div>
                <label htmlFor="proj-phone" className="settings-label">
                  Contact phone <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
                  <input
                    id="proj-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="settings-input pl-9"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="description" className="settings-label">
                Description <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
              </label>
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this project…"
                className="settings-input"
              />
            </div>
          </SettingsSection>

          {/* Sale Location */}
          <SettingsSection title="Sale Location" description="Address for this project">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="proj-address1" className="settings-label">Street address</label>
                  <input
                    id="proj-address1"
                    type="text"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="123 Main St"
                    className="settings-input"
                  />
                </div>
                <div>
                  <label htmlFor="proj-address2" className="settings-label">
                    Suite / unit <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
                  </label>
                  <input
                    id="proj-address2"
                    type="text"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    placeholder="Suite 200"
                    className="settings-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="proj-city" className="settings-label">City</label>
                  <input
                    id="proj-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Springfield"
                    className="settings-input"
                  />
                </div>
                <div>
                  <label htmlFor="proj-state" className="settings-label">State</label>
                  <select
                    id="proj-state"
                    value={projectState}
                    onChange={(e) => setProjectState(e.target.value)}
                    className="settings-input"
                  >
                    {US_STATES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="proj-zip" className="settings-label">ZIP</label>
                  <input
                    id="proj-zip"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="62704"
                    className="settings-input"
                  />
                </div>
              </div>
            </div>
          </SettingsSection>

          {/* Cover Image */}
          <SettingsSection title="Cover Image" description="Displayed on your project page">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative w-48 overflow-hidden rounded-xl border border-stone-200 dark:border-zinc-700">
                <Image
                  src={imagePreview}
                  alt="Cover preview"
                  width={192}
                  height={192}
                  className="aspect-square w-full object-cover"
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
                className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 transition-all ${
                  dragging
                    ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-900/10"
                    : "border-stone-300 hover:border-indigo-300 hover:bg-stone-50 dark:border-zinc-700 dark:hover:border-indigo-800 dark:hover:bg-zinc-800/50"
                }`}
              >
                <Upload className="h-5 w-5 text-stone-400 dark:text-zinc-500" />
                <p className="text-sm font-medium text-stone-700 dark:text-zinc-300">Click or drag an image</p>
                <p className="text-xs text-stone-500 dark:text-zinc-500">JPG, PNG, or WebP up to 10 MB</p>
              </div>
            )}
          </SettingsSection>

          {/* Publish */}
          <SettingsSection title="Visibility" description="Control public access to this project">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {published ? (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                    <Globe className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 dark:bg-zinc-800">
                    <GlobeLock className="h-4.5 w-4.5 text-stone-500 dark:text-zinc-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-stone-900 dark:text-white">
                    {published ? "Published" : "Draft"}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-zinc-500">
                    {published
                      ? "This project is live and visible to buyers."
                      : "This project is hidden from the public."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={publishing}
                onClick={handleTogglePublish}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  published
                    ? "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    : "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                }`}
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : published ? (
                  <GlobeLock className="h-4 w-4" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                {published ? "Unpublish" : "Publish"}
              </button>
            </div>
            {published && (
              <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-900/10">
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Public link:{" "}
                  <a
                    href={`/sales/${projectId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    /sales/{projectId}
                  </a>
                </p>
              </div>
            )}
          </SettingsSection>

          {/* Save */}
          <div className="flex items-center justify-between border-t border-stone-200 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-all hover:bg-red-50 dark:border-red-900/40 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-4 w-4" />
              Delete project
            </button>
            <div className="flex items-center gap-3">
              <Link
                href={`/organizations/${orgId}`}
                className="text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
              >
                Cancel
              </Link>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </button>
            </div>
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
    </div>
  );
}

// ── Reusable compact section wrapper ────────────────────────

function SettingsSection({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
        <h2 className="text-sm font-semibold text-stone-900 dark:text-white">{title}</h2>
        <p className="text-xs text-stone-500 dark:text-zinc-500">{description}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
