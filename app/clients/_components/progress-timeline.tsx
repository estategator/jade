"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";

import type { OnboardingStepSummary } from "@/app/onboarding/actions";

const statusIcon = (status: string) => {
  if (status === "completed") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  }
  if (status === "in_progress") {
    return <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand-primary)]" />;
  }
  return <Circle className="h-5 w-5 text-stone-300 dark:text-zinc-600" />;
};

export function ProgressTimeline({
  steps,
  progressPercent,
}: Readonly<{
  steps: OnboardingStepSummary[];
  progressPercent: number;
}>) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-stone-500 dark:text-zinc-500">
        No onboarding steps created yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall progress bar */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-[var(--color-brand-primary)] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-sm font-medium text-stone-700 dark:text-zinc-300">
          {progressPercent}%
        </span>
      </div>

      {/* Step list */}
      <ol className="relative space-y-1">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-start gap-3">
            {/* Connector line */}
            <div className="flex flex-col items-center">
              {statusIcon(step.status)}
              {index < steps.length - 1 && (
                <div className="my-0.5 h-5 w-px bg-stone-200 dark:bg-zinc-700" />
              )}
            </div>
            <div className="min-w-0 pb-3">
              <p className="text-sm font-medium text-stone-900 dark:text-white">
                {step.title}
              </p>
              <p className="text-xs text-stone-500 dark:text-zinc-500">
                {step.description}
              </p>
              {step.completed_at && (
                <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                  Completed {new Date(step.completed_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
