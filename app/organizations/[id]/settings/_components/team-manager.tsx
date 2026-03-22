"use client";

import { useState } from "react";
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
import { InviteMemberModal } from "@/app/components/invite-member-modal";
import {
  getPendingInvitations,
  sendOrgInvitation,
  cancelInvitation,
  updateMemberRole,
  updateMemberStatus,
  type OrgMember,
  type OrgInvitation,
  type MemberWithProfile,
} from "@/app/organizations/actions";

type MemberRow = MemberWithProfile;
type PendingInvitationRow = OrgInvitation;

type TeamManagerProps = Readonly<{
  orgId: string;
  canInviteMembers: boolean;
  canUpdateMembers: boolean;
  initialMembers: MemberRow[];
  initialPendingInvitations: PendingInvitationRow[];
}>;

export function TeamManager({
  orgId,
  canInviteMembers,
  canUpdateMembers,
  initialMembers,
  initialPendingInvitations,
}: TeamManagerProps) {
  const [error, setError] = useState("");
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [pendingInvitations, setPendingInvitations] =
    useState<PendingInvitationRow[]>(initialPendingInvitations);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteWarning, setInviteWarning] = useState("");
  const [memberUpdating, setMemberUpdating] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<Record<string, string>>({});

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

  return (
    <>
      {!canInviteMembers && !canUpdateMembers && (
        <p className="mb-3 text-xs text-stone-500 dark:text-zinc-400">
          You can view membership, but only managers can modify roles or send invitations.
        </p>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </motion.p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-5"
      >
        {/* Active Members */}
        <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-stone-900 dark:text-white">
                Members
              </h2>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:bg-zinc-800 dark:text-zinc-400">
                {members.length}
              </span>
            </div>
            {canInviteMembers && (
              <button
                type="button"
                onClick={() => { setInviteError(""); setInviteModalOpen(true); }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-indigo-700"
              >
                <Mail className="h-3.5 w-3.5" />
                Invite
              </button>
            )}
          </div>

          <div className="divide-y divide-stone-100 dark:divide-zinc-800/60">
            {members.map((member) => {
              const isUpdating = memberUpdating === member.id;
              const rowError = memberError[member.id];
              const RoleIcon =
                member.role === "superadmin" ? Crown
                  : member.role === "admin" ? Shield
                  : User;

              return (
                <div key={member.id} className="flex items-center justify-between px-5 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        member.status === "suspended"
                          ? "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-stone-200 text-stone-600 dark:bg-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {(member.profiles?.full_name?.[0] || member.email?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-stone-900 dark:text-white">
                        {member.profiles?.full_name || member.email || "Unknown"}
                      </p>
                      {member.status === "suspended" && (
                        <p className="text-[11px] text-red-500 dark:text-red-400">Suspended</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}

                    {canUpdateMembers ? (
                      <>
                        <select
                          value={member.role}
                          disabled={isUpdating}
                          onChange={(e) =>
                            handleRoleChange(member.id, e.target.value as OrgMember["role"])
                          }
                          className="rounded-md border border-stone-200 bg-white px-1.5 py-1 text-[11px] font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
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
                              member.status === "active" ? "suspended" : "active"
                            )
                          }
                          className={`rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            member.status === "active"
                              ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                              : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                          }`}
                        >
                          {member.status === "active" ? (
                            <><AlertTriangle className="mr-0.5 inline h-3 w-3" />Suspend</>
                          ) : (
                            <><Shield className="mr-0.5 inline h-3 w-3" />Activate</>
                          )}
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:bg-zinc-800 dark:text-zinc-300">
                        <RoleIcon className="h-3 w-3" />
                        {member.role === "superadmin" ? "Super Admin" : member.role === "admin" ? "Admin" : "Member"}
                      </span>
                    )}
                  </div>

                  {rowError && (
                    <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{rowError}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Invitations */}
        <div className="rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-3 dark:border-zinc-800/60">
            <Mail className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500" />
            <h3 className="text-sm font-semibold text-stone-900 dark:text-white">
              Pending Invitations
            </h3>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:bg-zinc-800 dark:text-zinc-400">
              {pendingInvitations.length}
            </span>
          </div>

          {pendingInvitations.length === 0 ? (
            <div className="px-5 py-4 text-sm text-stone-500 dark:text-zinc-400">
              No pending invitations.
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-zinc-800/60">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between px-5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900 dark:text-white">
                      {invitation.email}
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-zinc-500">
                      {new Date(invitation.created_at).toLocaleDateString()} &middot;{" "}
                      {invitation.requested_role === "admin" ? "Admin" : "Member"}
                    </p>
                  </div>

                  {canInviteMembers && (
                    <button
                      type="button"
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="rounded-md px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
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
        onClose={() => { setInviteModalOpen(false); setInviteWarning(""); }}
        onSubmit={handleInviteMember}
        isLoading={inviteSubmitting}
        error={inviteError}
        warning={inviteWarning}
      />
    </>
  );
}
