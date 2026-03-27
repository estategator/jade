import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { ProjectTransparencyEventType } from "@/lib/onboarding";

export async function logProjectTransparencyEvent(params: {
  orgId: string;
  projectId: string;
  eventType: ProjectTransparencyEventType;
  title: string;
  body?: string;
  assignmentId?: string | null;
  actorId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("project_transparency_events").insert({
      org_id: params.orgId,
      project_id: params.projectId,
      assignment_id: params.assignmentId ?? null,
      event_type: params.eventType,
      title: params.title,
      body: params.body ?? null,
      created_by: params.actorId ?? null,
      payload: params.payload ?? {},
    });

    if (error) {
      console.error("Failed to log project transparency event:", error);
    }
  } catch (error) {
    console.error("Unexpected error while logging project transparency event:", error);
  }
}