"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2,
  Users,
  Mail,
  Crown,
  Shield,
  User,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/app/components/page-header";
import { OrgSettingsNav } from "../_components/org-settings-nav";
import { InviteMemberModal } from "@/app/components/invite-member-modal";
import {
  getOrganization,
  getPermissionsForOrg,
  getOrgMembers,
  getPendingInvitations,
  sendOrgInvitation,
  cancelInvitation,
  updateMemberRole,
  updateMemberStatus,
  type OrgMember,
  type OrgInvitation,
} from "@/app/organizations/actions";

type MemberRow = OrgMember & {
  email: string | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
};
type PendingInvitationRow = OrgInvitation;

export default function OrgSettingsTeamPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");
  const [canInviteMembers, setCanInviteMembers] = useState(false);
  const [canUpdateMembers, setCanUpdateMembers] = useState(false);
  const [error, setError] = useState("");

  // Team state
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitationRow[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteWarning, setInviteWarning] = useState("");
  const [memberUpdating, setMemberUpdating] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<Record<string, string>>({});

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const [orgResult, permsResult, membersResult, pendingResult] =
        await Promise.all([
          getOrganization(orgId),
          getPermissionsForOrg(orgId, session.user.id),
          getOrgMembers(orgId),
          getPendingInvitations(orgId),
        ]);

      if (orgResult.error || !orgResult.data) {
        router.replace("/organizations");
        return;
      }

      setOrgName(orgResult.data.name);
      setCanInviteMembers(permsResult.includes("members:invite"));
      setCanUpdateMembers(permsResult.includes("members:update_role"));
      setMembers((membersResult.data ?? []) as MemberRow[]);
      setPendingInvitations((pendingResult.data ?? []) as PendingInvitationRow[]);
      setLoading(false);
    }
    init();
  }, [router, orgId]);

  async function handleInviteMember(email: string, role: "admin" | "member") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setInviteError("Not authenticated.");
      throw new Error("Not authenticated.");
    }

    setInviteSubmitting(true);
    setInviteError("");
    setInviteWarning("");

    const result = await sendOrgInvitation(orgId, email, role, session.user.id);
    if (result.error) {
      setInviteError(result.error);
      setInviteSubmitting(false);
      throw new Error(result.error);
    }

    if (result.warning) {
      setInviteWarning(result.warning);
    }

    const pendingResult = await getPendingInvitations(orgId);
    if (pendingResult.data) {
      setPendingInvitations(pendingResult.data as PendingInvitationRow[]);
    }

    setInviteSubmitting(false);
  }

  async function handleCancelInvitation(invitationId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Not authenticated.");
      return;
    }

    const result = await cancelInvitation(orgId, invitationId, session.user.id);
    if (result.error) {
      setError(result.error);
      return;
    }

    setPendingInvitations((prev) =>
      prev.filter((invite) => invite.id !== invitationId)
    );
  }

  async function handleRoleChange(
    memberId: string,
    newRole: OrgMember["role"]
  ) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    setMemberUpdating(memberId);
    setMemberError((prev) => {
      const next = { ...prev };
      delete next[memberId];
      return next;
    });

    const result = await updateMemberRole(
      orgId,
      memberId,
      newRole,
      session.user.id
    );
    if (result.error) {
      setMemberError((prev) => ({ ...prev, [memberId]: result.error! }));
    } else {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    }
    setMemberUpdating(null);
  }

  async function handleStatusChange(
    memberId: string,
    newStatus: "active" | "suspended"
  ) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    setMemberUpdating(memberId);
    setMemberError((prev) => {
      const next = { ...prev };
      delete next[memberId];
      return next;
    });

    const result = await updateMemberStatus(
      orgId,
      memberId,
      newStatus,
      session.user.id
    );
    if (result.error) {
      setMemberError((prev) => ({ ...prev, [memberId]: result.error! }));
    } else {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, status: newStatus } : m
        )
      );
    }
    setMemberUpdating(null);
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

      <p className="mt-6 text-sm text-stone-500 dark:text-zinc-400">
        Manage organization members and pending invitations.
      </p>

      {!canInviteMembers && !canUpdateMembers && (
        <p className="mt-3 text-sm text-stone-500 dark:text-zinc-400">
          You can view membership, but only managers can modify roles or send
          invitations.
        </p>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mt-6 space-y-6"
      >
        <div>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-stone-400 dark:text-zinc-500" />
              <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                Members
              </h2>
              <span className="text-sm text-stone-500 dark:text-zinc-500">
                ({members.length})
              </span>
            </div>
            {canInviteMembers && (
              <button
                type="button"
                onClick={() => {
                  setInviteError("");
                  setInviteModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-700"
              >
                <Mail className="h-4 w-4" />
                Invite member
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {members.map((member) => {
              const isUpdating = memberUpdating === member.id;
              const rowError = memberError[member.id];
              const RoleIcon =
                member.role === "superadmin"
                  ? Crown
                  : member.role === "admin"
                    ? Shield
                    : User;

              return (
                <div
                  key={member.id}
                  className="border-b border-stone-100 px-5 py-3.5 last:border-b-0 dark:border-zinc-800/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                          member.status === "suspended"
                            ? "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-stone-200 text-stone-600 dark:bg-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {(
                          member.profiles?.full_name?.[0] ||
                          member.email?.[0] ||
                          "?"
                        ).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-900 dark:text-white">
                          {member.profiles?.full_name ||
                            member.email ||
                            "Unknown user"}
                        </p>
                        {member.status === "suspended" && (
                          <p className="text-xs text-red-500 dark:text-red-400">
                            Suspended
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isUpdating && (
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                      )}

                      {canUpdateMembers ? (
                        <>
                          <select
                            value={member.role}
                            disabled={isUpdating}
                            onChange={(e) =>
                              handleRoleChange(
                                member.id,
                                e.target.value as OrgMember["role"]
                              )
                            }
                            className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            <option value="superadmin">Super Admin</option>
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                          </select>

                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              handleStatusChange(
                                member.id,
                                member.status === "active"
                                  ? "suspended"
                                  : "active"
                              )
                            }
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                              member.status === "active"
                                ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                            }`}
                          >
                            {member.status === "active" ? (
                              <>
                                <AlertTriangle className="h-3 w-3" />
                                Suspend
                              </>
                            ) : (
                              <>
                                <Shield className="h-3 w-3" />
                                Activate
                              </>
                            )}
                          </button>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600 dark:bg-zinc-800 dark:text-zinc-300">
                          <RoleIcon className="h-3 w-3" />
                          {member.role === "superadmin"
                            ? "Super Admin"
                            : member.role === "admin"
                              ? "Admin"
                              : "Member"}
                        </span>
                      )}
                    </div>
                  </div>

                  {rowError && (
                    <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                      {rowError}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
              Pending invitations ({pendingInvitations.length})
            </h3>
          </div>

          {pendingInvitations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              No pending invitations.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/20">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between border-b border-amber-100 px-5 py-3.5 last:border-b-0 dark:border-amber-900/30"
                >
                  <div>
                    <p className="text-sm font-medium text-stone-900 dark:text-white">
                      {invitation.email}
                    </p>
                    <p className="text-xs text-stone-600 dark:text-zinc-400">
                      Invited{" "}
                      {new Date(invitation.created_at).toLocaleDateString()} as{" "}
                      {invitation.requested_role === "admin"
                        ? "Admin"
                        : "Member"}
                    </p>
                  </div>

                  {canInviteMembers && (
                    <button
                      type="button"
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <InviteMemberModal
        isOpen={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setInviteWarning("");
        }}
        onSubmit={handleInviteMember}
        isLoading={inviteSubmitting}
        error={inviteError}
        warning={inviteWarning}
      />
    </>
  );
}
