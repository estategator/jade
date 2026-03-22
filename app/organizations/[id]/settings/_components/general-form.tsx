"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, Save, Upload, X, Phone } from "lucide-react";
import { updateOrganization, getOrganization } from "@/app/organizations/actions";

const US_STATES = [
  { value: "", label: "Select state" },
  { value: "AL", label: "AL" }, { value: "AK", label: "AK" }, { value: "AZ", label: "AZ" },
  { value: "AR", label: "AR" }, { value: "CA", label: "CA" }, { value: "CO", label: "CO" },
  { value: "CT", label: "CT" }, { value: "DE", label: "DE" }, { value: "FL", label: "FL" },
  { value: "GA", label: "GA" }, { value: "HI", label: "HI" }, { value: "ID", label: "ID" },
  { value: "IL", label: "IL" }, { value: "IN", label: "IN" }, { value: "IA", label: "IA" },
  { value: "KS", label: "KS" }, { value: "KY", label: "KY" }, { value: "LA", label: "LA" },
  { value: "ME", label: "ME" }, { value: "MD", label: "MD" }, { value: "MA", label: "MA" },
  { value: "MI", label: "MI" }, { value: "MN", label: "MN" }, { value: "MS", label: "MS" },
  { value: "MO", label: "MO" }, { value: "MT", label: "MT" }, { value: "NE", label: "NE" },
  { value: "NV", label: "NV" }, { value: "NH", label: "NH" }, { value: "NJ", label: "NJ" },
  { value: "NM", label: "NM" }, { value: "NY", label: "NY" }, { value: "NC", label: "NC" },
  { value: "ND", label: "ND" }, { value: "OH", label: "OH" }, { value: "OK", label: "OK" },
  { value: "OR", label: "OR" }, { value: "PA", label: "PA" }, { value: "RI", label: "RI" },
  { value: "SC", label: "SC" }, { value: "SD", label: "SD" }, { value: "TN", label: "TN" },
  { value: "TX", label: "TX" }, { value: "UT", label: "UT" }, { value: "VT", label: "VT" },
  { value: "VA", label: "VA" }, { value: "WA", label: "WA" }, { value: "WV", label: "WV" },
  { value: "WI", label: "WI" }, { value: "WY", label: "WY" }, { value: "DC", label: "DC" },
];

type GeneralFormProps = Readonly<{
  orgId: string;
  initialName: string;
  initialCoverImageUrl: string | null;
  initialPhone: string;
  initialAddressLine1: string;
  initialAddressLine2: string;
  initialCity: string;
  initialState: string;
  initialZipCode: string;
  canManageSettings: boolean;
}>;

export function GeneralForm({
  orgId,
  initialName,
  initialCoverImageUrl,
  initialPhone,
  initialAddressLine1,
  initialAddressLine2,
  initialCity,
  initialState,
  initialZipCode,
  canManageSettings,
}: GeneralFormProps) {
  const [editOrgName, setEditOrgName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [addressLine1, setAddressLine1] = useState(initialAddressLine1);
  const [addressLine2, setAddressLine2] = useState(initialAddressLine2);
  const [city, setCity] = useState(initialCity);
  const [state, setState] = useState(initialState);
  const [zipCode, setZipCode] = useState(initialZipCode);
  const [orgImageFile, setOrgImageFile] = useState<File | null>(null);
  const [orgImagePreview, setOrgImagePreview] = useState<string | null>(
    initialCoverImageUrl
  );
  const [orgDragging, setOrgDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const orgFileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = useCallback(async () => {
    setError("");
    setSuccess("");
    if (!editOrgName.trim()) {
      setError("Organization name is required.");
      return;
    }

    setSaving(true);
    const formData = new FormData();
    formData.append("name", editOrgName);
    formData.append("phone", phone);
    formData.append("address_line1", addressLine1);
    formData.append("address_line2", addressLine2);
    formData.append("city", city);
    formData.append("state", state);
    formData.append("zip_code", zipCode);
    if (orgImageFile) formData.append("image", orgImageFile);

    const result = await updateOrganization(orgId, formData);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(result.warning || "Organization updated.");
      setOrgImageFile(null);
      const orgResult = await getOrganization(orgId);
      if (orgResult.data) {
        setOrgImagePreview(orgResult.data.cover_image_url ?? null);
      }
    }
    setSaving(false);
  }, [editOrgName, orgId, orgImageFile, phone, addressLine1, addressLine2, city, state, zipCode]);

  function handleFileSelect(file: File) {
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

  return (
    <>
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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Organization Details */}
        <SettingsSection title="Organization Details" description="Name and contact information">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="org-name" className="settings-label">
                Organization name
              </label>
              <input
                id="org-name"
                type="text"
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
                className="settings-input"
                disabled={!canManageSettings}
              />
            </div>
            <div>
              <label htmlFor="org-phone" className="settings-label">
                Phone <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400 dark:text-zinc-500" />
                <input
                  id="org-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="settings-input pl-9"
                  disabled={!canManageSettings}
                />
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* Address */}
        <SettingsSection title="Address" description="Business address for your organization">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="org-address1" className="settings-label">Street address</label>
                <input
                  id="org-address1"
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="123 Main St"
                  className="settings-input"
                  disabled={!canManageSettings}
                />
              </div>
              <div>
                <label htmlFor="org-address2" className="settings-label">
                  Suite / unit <span className="text-stone-400 dark:text-zinc-500">(optional)</span>
                </label>
                <input
                  id="org-address2"
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Suite 200"
                  className="settings-input"
                  disabled={!canManageSettings}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="org-city" className="settings-label">City</label>
                <input
                  id="org-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Springfield"
                  className="settings-input"
                  disabled={!canManageSettings}
                />
              </div>
              <div>
                <label htmlFor="org-state" className="settings-label">State</label>
                <select
                  id="org-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="settings-input"
                  disabled={!canManageSettings}
                >
                  {US_STATES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="org-zip" className="settings-label">ZIP</label>
                <input
                  id="org-zip"
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="62704"
                  className="settings-input"
                  disabled={!canManageSettings}
                />
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* Cover Image */}
        <SettingsSection title="Cover Image" description="Displayed on your organization profile">
          <input
            ref={orgFileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
            className="hidden"
            disabled={!canManageSettings}
          />
          {orgImagePreview ? (
            <div className="relative w-48 overflow-hidden rounded-lg border border-stone-200 dark:border-zinc-700">
              <Image
                src={orgImagePreview}
                alt="Organization cover"
                width={192}
                height={192}
                className="aspect-square w-full object-cover"
                unoptimized
              />
              {canManageSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setOrgImageFile(null);
                    setOrgImagePreview(null);
                    if (orgFileInputRef.current) orgFileInputRef.current.value = "";
                  }}
                  className="absolute right-2 top-2 rounded-md bg-stone-900/70 p-1 text-white backdrop-blur-sm transition-colors hover:bg-stone-900"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div
              onClick={() => canManageSettings && orgFileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (canManageSettings) setOrgDragging(true); }}
              onDragLeave={() => setOrgDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOrgDragging(false);
                if (!canManageSettings) return;
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 transition-all ${
                orgDragging
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

        {/* Save */}
        {canManageSettings && (
          <div className="flex items-center justify-end border-t border-stone-200 pt-4 dark:border-zinc-800">
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
        )}
      </motion.div>
    </>
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
