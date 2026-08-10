export type Role = "owner" | "editor" | "viewer";

export type StepType =
  | "llm_call"
  | "http_request"
  | "db_write"
  | "notify"
  | "conditional_branch"
  | "approval_gate";

export type RunStatus = "pending" | "running" | "paused" | "completed" | "failed";

export interface WorkflowStepRow {
  id: string;
  workflow_id: string;
  position: number;
  type: StepType;
  config: Record<string, unknown>;
}

export interface StepRunRow {
  id: string;
  workflow_run_id: string;
  workflow_step_id: string;
  status: RunStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  attempt_count: number;
}

export interface StepContext {
  /** Outputs of previously completed steps in this run, keyed by step id and by position index. */
  previousOutputs: Record<string, unknown>;
  orgId: string;
  workflowId: string;
  workflowRunId: string;
}

export interface StepResult {
  output: unknown;
  /** When a conditional_branch step decides to skip ahead/stop, it can signal that here. */
  control?: { type: "continue" } | { type: "pause" };
}
