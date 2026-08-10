import type { RunStatus } from "./types";

/**
 * Display-level status for a pipeline step card. This is derived purely
 * from backend data (step_runs.status + step_runs.output), never from a
 * frontend timer - "skipped" isn't a real step_runs.status value, it's a
 * completed row whose output carries `{ skipped: true }` (see
 * backend/src/workflow-engine/executor.ts), and "queued" means no step_runs
 * row exists yet for that workflow_step in this run.
 */
export type StepDisplayStatus = "queued" | "running" | "completed" | "skipped" | "failed" | "paused";

export interface StepRunLike {
  status: RunStatus;
  output: unknown;
}

export function isSkippedOutput(output: unknown): boolean {
  return Boolean(output && typeof output === "object" && (output as Record<string, unknown>).skipped === true);
}

export function deriveStepDisplayStatus(stepRun: StepRunLike | undefined): StepDisplayStatus {
  if (!stepRun) return "queued";
  switch (stepRun.status) {
    case "completed":
      return isSkippedOutput(stepRun.output) ? "skipped" : "completed";
    case "running":
      return "running";
    case "paused":
      return "paused";
    case "failed":
      return "failed";
    case "pending":
    default:
      return "queued";
  }
}

export function deriveOverallStatus(runStatus: RunStatus | undefined): StepDisplayStatus {
  if (!runStatus) return "queued";
  if (runStatus === "pending") return "queued";
  return runStatus as StepDisplayStatus;
}

export const STATUS_ICON: Record<StepDisplayStatus, string> = {
  queued: "○",
  running: "⟳",
  completed: "✓",
  skipped: "⊘",
  failed: "✗",
  paused: "⏸",
};

export const STATUS_LABEL: Record<StepDisplayStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  skipped: "Skipped",
  failed: "Failed",
  paused: "Paused",
};

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
