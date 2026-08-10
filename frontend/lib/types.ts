export type Role = "owner" | "editor" | "viewer";

export type StepType =
  | "llm_call"
  | "http_request"
  | "db_write"
  | "notify"
  | "conditional_branch"
  | "approval_gate";

export type RunStatus = "pending" | "running" | "paused" | "completed" | "failed";

export const SENSITIVE_STEP_TYPES: StepType[] = ["db_write", "notify"];

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  llm_call: "LLM Call",
  http_request: "HTTP Request",
  db_write: "DB Write (owner only)",
  notify: "Notify (owner only)",
  conditional_branch: "Conditional Branch",
  approval_gate: "Approval Gate",
};

/** Same labels without the "(owner only)" suffix - used on the run screen, where it's noise. */
export const STEP_TYPE_SHORT_LABELS: Record<StepType, string> = {
  llm_call: "LLM Call",
  http_request: "HTTP Request",
  db_write: "DB Write",
  notify: "Notify",
  conditional_branch: "Conditional Branch",
  approval_gate: "Approval Gate",
};

export interface WorkflowStepDef {
  id: string;
  position: number;
  type: StepType;
  config: Record<string, unknown>;
}

export interface StepRun {
  id: string;
  status: RunStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  attempt_count: number;
  approved_by: string | null;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  workflow_step: { id: string; position: number; type: StepType };
}
