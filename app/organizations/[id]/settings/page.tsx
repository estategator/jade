"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, Save, Building2, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/page-header";
import { OrgSettingsNav } from "./_components/org-settings-nav";
import {
  getOrganization,
  getPermissionsForOrg,
  updateOrganization,
} from "@/app/organizations/actions";

export default function OrgSettingsGeneralPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");
  const [editOrgName, setEditOrgName] = useState("");
  const [orgImageFile, setOrgImageFile] = useState<File | null>(null);
  const [orgImagePreview, setOrgImagePreview] = useState<string | null>(null);
  const [orgDragging, setOrgDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [canManageSettings, setCanManageSettings] = useState(false);
  const orgFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const [orgResult, permsResult] = await Promise.all([
        getOrganization(orgId),
        getPermissionsForOrg(orgId, session.user.id),
      ]);

      if (orgResult.error || !orgResult.data) {
        router.replace("/organizations");
        return;
      }

      setOrgName(orgResult.data.name);
      setEditOrgName(orgResult.data.name);
      setOrgImagePreview(orgResult.data.cover_image_url ?? null);
      setCanManageSettings(permsResult.includes("settings:manage"));
      setLoading(false);
    }
    init();
  }, [router, orgId]);

  async function handleSave() {
    setError("");
    setSuccess("");
    if (!editOrgName.trim()) {
      setError("Organization name is required.");
      return;
    }

    setSaving(true);
    const formData = new FormData();
    formData.append("name", editOrgName);
    if (orgImageFile) formData.append("image", orgImageFile);

    const result = await updateOrganization(orgId, formData);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(result.warning || "Organization updated.");
      setOrgName(editOrgName.trim());
      setOrgImageFile(null);
      const orgResult = await getOrganization(orgId);
      if (orgResult.data) {
        setOrgImagePreview(orgResult.data.cover_image_url ?? null);
      }
    }
    setSaving(false);
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
        title="Organization Settings"
        description={`Manage settings for ${orgName}.`}
      />
      <OrgSettingsNav orgId={orgId} />

      {error && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}

      {success && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-400"
        >
          {success}
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mt-8 space-y-8"
      >
        <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                Organization Details
              </h2>
              <p className="text-sm text-stone-500 dark:text-zinc-500">
                Update your organization name and image
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Org name */}
            <div>
              <label
                htmlFor="org-name"
                className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300"
              >
                Organization name
              </label>
              <input
                id="org-name"
                type="text"
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
                className="block w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder-stone-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                disabled={!canManageSettings}
              />
            </div>

            {/* Cover image */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700 dark:text-zinc-300">
                Cover image
              </label>
              <input
                ref={orgFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (!file.type.startsWith("image/")) {
                      setError("Please upload an image file.");
                      return;
                    }
                    if (file.size > 10 * 1024 * 1024) {
                      setError("Image must be under 10 MB.");
                      return;
                    }
                    setError("");
                    setOrgImageFile(file);
                    setOrgImagePreview(URL.createObjectURL(file));
                  }
                }}
                className="hidden"
                disabled={!canManageSettings}
              />
              {orgImagePreview ? (
                <div className="relative overflow-hidden rounded-xl border border-stone-200 dark:border-zinc-700">
                  <Image
                    src={orgImagePreview}
                    alt="Organization cover"
                    width={600}
                    height={300}
                    className="w-full max-h-56 object-cover"
                    unoptimized
                  />
                  {canManageSettings && (
                    <div className="absolute right-2 top-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOrgImageFile(null);
                          setOrgImagePreview(null);
                          if (orgFileInputRef.current)
                            orgFileInputRef.current.value = "";
                        }}
                        className="rounded-lg bg-stone-900/70 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-stone-900"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() =>
                    canManageSettings && orgFileInputRef.current?.click()
                  }
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (canManageSettings) setOrgDragging(true);
                  }}
                  onDragLeave={() => setOrgDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOrgDragging(false);
                    if (!canManageSettings) return;
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      if (!file.type.startsWith("image/")) {
                        setError("Please upload an image file.");
                        return;
                      }
                      if (file.size > 10 * 1024 * 1024) {
                        setError("Image must be under 10 MB.");
                        return;
                      }
                      setError("");
                      setOrgImageFile(file);
                      setOrgImagePreview(URL.createObjectURL(file));
                    }
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition-all ${
                    orgDragging
                      ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-900/10"
                      : "border-stone-300 bg-white hover:border-indigo-300 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-800 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <Upload className="h-6 w-6 text-stone-400 dark:text-zinc-500" />
                  <p className="text-sm font-medium text-stone-900 dark:text-white">
                    Click or drag an image
                  </p>
                  <p className="text-xs text-stone-500 dark:text-zinc-500">
                    JPG, PNG, or WebP up to 10 MB
                  </p>
                </div>
              )}
            </div>

            {/* Save */}
            {canManageSettings && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save changes
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
