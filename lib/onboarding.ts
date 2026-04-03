export const ONBOARDING_STEP_BLUEPRINTS = [
  {
    key: "welcome_sent",
    title: "Send welcome email",
    description: "Share the onboarding overview and next steps.",
  },
  {
    key: "walkthrough_scheduled",
    title: "Schedule walkthrough",
    description: "Book the walkthrough and confirm meeting details.",
  },
  {
    key: "contract_sent",
    title: "Create contract",
    description: "Prepare and send the client agreement for review.",
  },
  {
    key: "contract_signed",
    title: "Contract signed",
    description: "Confirm the signed agreement is complete.",
  },
  {
    key: "project_shared",
    title: "Share client portal",
    description: "Create a read-only project link for the client.",
  },
  {
    key: "inventory_in_progress",
    title: "Inventory in progress",
    description: "Track inventory submissions and catalog progress.",
  },
  {
    key: "pricing_in_progress",
    title: "Pricing in progress",
    description: "Track pricing decisions and recommendations.",
  },
  {
    key: "sale_ready",
    title: "Sale ready",
    description: "Confirm the project is ready to launch.",
  },
] as const;

export type OnboardingStepKey =
  (typeof ONBOARDING_STEP_BLUEPRINTS)[number]["key"];

export type OnboardingStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "blocked";

export type OnboardingWorkflowStage = "invited" | OnboardingStepKey;

export type ContractStatus =
  | "not_started"
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "declined"
  | "voided"
  | "expired";

export type WalkthroughStatus =
  | "pending"
  | "scheduled"
  | "completed"
  | "canceled"
  | "rescheduled";

export type WelcomeMessageStatus = "draft" | "queued" | "sent" | "failed";

export type ShareLinkStatus = "active" | "revoked" | "expired";

export type ProjectTransparencyEventType =
  | "client_assigned"
  | "share_link_created"
  | "project_published"
  | "inventory_created"
  | "inventory_updated"
  | "pricing_updated"
  | "milestone_updated"
  | "contract_sent"
  | "contract_signed"
  | "welcome_email_sent"
  | "walkthrough_scheduled"
  | "walkthrough_completed"
  | "client_portal_emailed";

export type OnboardingStepRecord = {
  step_key: OnboardingStepKey;
  status: OnboardingStepStatus;
};

export function getOnboardingStepOrder(stepKey: OnboardingStepKey): number {
  return ONBOARDING_STEP_BLUEPRINTS.findIndex((step) => step.key === stepKey);
}

export function getWorkflowProgressPercent(
  steps: ReadonlyArray<OnboardingStepRecord>,
): number {
  if (steps.length === 0) {
    return 0;
  }

  const completedCount = steps.filter((step) => step.status === "completed").length;
  return Math.round((completedCount / steps.length) * 100);
}

export function getWorkflowStage(
  steps: ReadonlyArray<OnboardingStepRecord>,
): OnboardingWorkflowStage {
  const completedSteps = [...steps]
    .filter((step) => step.status === "completed")
    .sort(
      (left, right) =>
        getOnboardingStepOrder(left.step_key) - getOnboardingStepOrder(right.step_key),
    );

  return completedSteps.at(-1)?.step_key ?? "invited";
}