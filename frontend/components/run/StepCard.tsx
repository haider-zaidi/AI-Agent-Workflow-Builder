"use client";

import { StatusIcon } from "./StatusIcon";
import { LiveDuration } from "./LiveDuration";
import { deriveStepDisplayStatus, formatDuration, STATUS_LABEL, type StepDisplayStatus } from "@/lib/runStatus";
import { STEP_TYPE_SHORT_LABELS, type Role, type StepRun, type WorkflowStepDef } from "@/lib/types";

interface ConditionalBranchConfig {
  source_step_position?: number;
  operator?: "contains" | "equals" | "not_contains";
  value?: string;
  skip_steps_if_false?: number;
}

interface ConditionalBranchOutput {
  condition_met: boolean;
  evaluated_value: string;
  skip_steps: number;
}

function isConditionalOutput(output: unknown): output is ConditionalBranchOutput {
  return Boolean(output && typeof output === "object" && "condition_met" in output);
}

export function StepCard({
  step,
  stepRun,
  isUpNext,
  role,
  onApprove,
  approving,
  approveError,
}: {
  step: WorkflowStepDef;
  stepRun: StepRun | undefined;
  isUpNext: boolean;
  role: Role | null;
  onApprove: (stepRunId: string) => void;
  approving: boolean;
  approveError: string | null;
}) {
  const displayStatus = deriveStepDisplayStatus(stepRun);
  const label = STEP_TYPE_SHORT_LABELS[step.type];

  const duration =
    stepRun?.started_at && stepRun?.completed_at
      ? formatDuration(new Date(stepRun.completed_at).getTime() - new Date(stepRun.started_at).getTime())
      : null;

  return (
    <div className={`step-card step-card-${displayStatus}${isUpNext ? " step-card-up-next" : ""}`}>
      <div className="step-card-header">
        <div className="step-card-title">
          <StatusIcon status={displayStatus} />
          <span className="step-card-position">{step.position}.</span>
          <strong>{label}</strong>
        </div>
        <span className={`pill ${pillClassFor(displayStatus)}`}>{STATUS_LABEL[displayStatus]}</span>
      </div>

      <div className="step-card-meta muted">
        {stepRun && <span>Attempt {stepRun.attempt_count || 1}</span>}
        {duration && <span>Duration: {duration}</span>}
        {displayStatus === "running" && stepRun?.started_at && (
          <span>
            Running for <LiveDuration startedAt={stepRun.started_at} />
          </span>
        )}
        {!stepRun && <span>Waiting to start</span>}
      </div>

      {displayStatus === "skipped" && (
        <p className="step-card-note step-card-note-skipped">
          Skipped because the conditional branch evaluated to false.
        </p>
      )}

      {displayStatus === "failed" && stepRun?.error && (
        <p className="error-text">{stepRun.error}</p>
      )}

      {step.type === "conditional_branch" && (
        <ConditionalBranchDetails config={step.config as ConditionalBranchConfig} output={stepRun?.output} />
      )}

      {displayStatus === "paused" && step.type === "approval_gate" && (
        <div className="step-card-approval stack">
          <p className="step-card-note step-card-note-paused">
            Workflow paused — awaiting approval.
          </p>
          {role === "owner" ? (
            <button
              className="primary"
              onClick={() => stepRun && onApprove(stepRun.id)}
              disabled={approving}
            >
              {approving ? "Approving..." : "Approve"}
            </button>
          ) : (
            <p className="muted">Only an organization owner can approve this step.</p>
          )}
          {approveError && <p className="error-text">{approveError}</p>}
        </div>
      )}

      {stepRun && (stepRun.output !== null || stepRun.error) && (
        <details className="step-card-details">
          <summary>Details</summary>
          {stepRun.input !== null && stepRun.input !== undefined && (
            <>
              <p className="muted step-card-details-label">Input</p>
              <pre>{JSON.stringify(stepRun.input, null, 2)}</pre>
            </>
          )}
          {stepRun.output !== null && stepRun.output !== undefined && (
            <>
              <p className="muted step-card-details-label">Output</p>
              <pre>{JSON.stringify(stepRun.output, null, 2)}</pre>
            </>
          )}
        </details>
      )}
    </div>
  );
}

function ConditionalBranchDetails({
  config,
  output,
}: {
  config: ConditionalBranchConfig;
  output: unknown;
}) {
  const operatorLabel =
    config.operator === "equals" ? "equals" : config.operator === "not_contains" ? "does not contain" : "contains";
  const conditionText = `Step ${config.source_step_position ?? "?"} output ${operatorLabel} "${config.value ?? ""}"`;

  if (!isConditionalOutput(output)) {
    return (
      <p className="step-card-note">
        Condition: <code>{conditionText}</code>
      </p>
    );
  }

  return (
    <div className="step-card-conditional">
      <p className="step-card-note">
        Condition: <code>{conditionText}</code>
      </p>
      <p className="step-card-note">
        Result: <strong className={output.condition_met ? "text-success" : "text-warning"}>
          {output.condition_met ? "TRUE" : "FALSE"}
        </strong>
        {!output.condition_met && output.skip_steps > 0 && (
          <span className="muted"> — skips the next {output.skip_steps} step(s)</span>
        )}
      </p>
    </div>
  );
}

function pillClassFor(status: StepDisplayStatus): string {
  return status === "queued" ? "pending" : status;
}
