import type { Queryable } from "../db.js";
import { resolveTemplate } from "./template.js";
import { executeLlmCall, type LlmCallConfig } from "./steps/llmCall.js";
import { executeHttpRequest, type HttpRequestConfig } from "./steps/httpRequest.js";
import { executeDbWrite, type DbWriteConfig } from "./steps/dbWrite.js";
import { executeNotify, type NotifyConfig } from "./steps/notify.js";
import { evaluateConditionalBranch, type ConditionalBranchConfig } from "./steps/conditionalBranch.js";
import type { RunStatus, StepType, WorkflowStepRow } from "./types.js";

const RETRYABLE_TYPES: StepType[] = ["llm_call", "http_request"];

/**
 * Hasura's live query subscriptions poll the database (every ~1s by
 * default) rather than pushing on every write, so a step that finishes in
 * milliseconds (conditional_branch, db_write) can flip running -> completed
 * between two polls and the "running" state never reaches the browser at
 * all - it just looks like it jumped straight to completed, or worse, like
 * the subscription isn't live. Holding each step's "running" row for at
 * least this long guarantees it's visible for the live run screen (spec
 * section 27/29) regardless of poll timing.
 */
const MIN_RUNNING_VISIBLE_MS = 1200;

async function holdMinVisibleDuration(stepStartedAt: number): Promise<void> {
  const remaining = MIN_RUNNING_VISIBLE_MS - (Date.now() - stepStartedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

export interface RunParams {
  orgId: string;
  workflowId: string;
  workflowRunId: string;
  /** 1-indexed position to start/resume from. */
  fromPosition: number;
}

export interface RunOutcome {
  status: RunStatus;
  error?: string;
}

/**
 * Executes workflow_steps in position order, starting from `fromPosition`.
 * Used both for a fresh run (fromPosition = 1) and to resume after an
 * approval gate (fromPosition = gate's position + 1) - the loop itself does
 * not know or care which case it is, which is what guarantees the workflow
 * never restarts from the beginning on resume (spec section 18/38).
 */
export async function runWorkflowSteps(
  client: Queryable,
  params: RunParams
): Promise<RunOutcome> {
  const { orgId, workflowId, workflowRunId, fromPosition } = params;

  const stepsResult = await client.query<WorkflowStepRow>(
    `select id, workflow_id, position, type, config
     from workflow_steps
     where workflow_id = $1
     order by position asc`,
    [workflowId]
  );
  const steps = stepsResult.rows;

  const priorOutputsResult = await client.query<{ position: number; output: unknown }>(
    `select ws.position, sr.output
     from step_runs sr
     join workflow_steps ws on ws.id = sr.workflow_step_id
     where sr.workflow_run_id = $1 and sr.status = 'completed'`,
    [workflowRunId]
  );
  const outputsByPosition: Record<number, unknown> = {};
  for (const row of priorOutputsResult.rows) {
    outputsByPosition[row.position] = row.output;
  }

  let skipRemaining = 0;

  for (const step of steps) {
    if (step.position < fromPosition) continue;

    if (skipRemaining > 0) {
      skipRemaining--;
      await client.query(
        `insert into step_runs (workflow_run_id, workflow_step_id, status, input, output, attempt_count, started_at, completed_at)
         values ($1, $2, 'completed', '{}'::jsonb, $3, 0, now(), now())`,
        [workflowRunId, step.id, JSON.stringify({ skipped: true, reason: "condition_false" })]
      );
      continue;
    }

    const resolvedConfig = resolveTemplate(step.config, outputsByPosition) as Record<string, unknown>;

    const stepRunResult = await client.query<{ id: string }>(
      `insert into step_runs (workflow_run_id, workflow_step_id, status, input, attempt_count, started_at)
       values ($1, $2, 'running', $3, 0, now())
       returning id`,
      [workflowRunId, step.id, JSON.stringify(resolvedConfig)]
    );
    const stepRunId = stepRunResult.rows[0].id;
    const stepStartedAt = Date.now();

    if (step.type === "approval_gate") {
      await client.query(
        `update step_runs set status = 'paused', attempt_count = 1 where id = $1`,
        [stepRunId]
      );
      await client.query(
        `update workflow_runs set status = 'paused' where id = $1`,
        [workflowRunId]
      );
      return { status: "paused" };
    }

    if (step.type === "conditional_branch") {
      const result = evaluateConditionalBranch(
        resolvedConfig as unknown as ConditionalBranchConfig,
        outputsByPosition,
        step.position
      );
      await holdMinVisibleDuration(stepStartedAt);
      await client.query(
        `update step_runs set status = 'completed', output = $2, attempt_count = 1, completed_at = now() where id = $1`,
        [stepRunId, JSON.stringify(result)]
      );
      outputsByPosition[step.position] = result;
      skipRemaining = result.skip_steps;
      continue;
    }

    const isRetryable = RETRYABLE_TYPES.includes(step.type);
    const maxAttempts = isRetryable ? 2 : 1;

    let lastError: string | null = null;
    let output: unknown = null;
    let attempt = 0;
    let succeeded = false;

    while (attempt < maxAttempts && !succeeded) {
      attempt += 1;
      try {
        output = await executeStep(client, step, resolvedConfig, {
          orgId,
          workflowId,
          workflowRunId,
          stepRunId,
        });
        succeeded = true;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    await holdMinVisibleDuration(stepStartedAt);

    if (!succeeded) {
      await client.query(
        `update step_runs set status = 'failed', error = $2, attempt_count = $3, completed_at = now() where id = $1`,
        [stepRunId, lastError, attempt]
      );
      await client.query(
        `update workflow_runs set status = 'failed', error = $2, completed_at = now() where id = $1`,
        [workflowRunId, lastError]
      );
      return { status: "failed", error: lastError ?? "Unknown error" };
    }

    await client.query(
      `update step_runs set status = 'completed', output = $2, attempt_count = $3, completed_at = now() where id = $1`,
      [stepRunId, JSON.stringify(output), attempt]
    );
    outputsByPosition[step.position] = output;
  }

  await client.query(
    `update workflow_runs set status = 'completed', completed_at = now() where id = $1`,
    [workflowRunId]
  );
  await client.query(
    `update organizations set quota_used = quota_used + 1 where id = $1`,
    [orgId]
  );

  return { status: "completed" };
}

async function executeStep(
  client: Queryable,
  step: WorkflowStepRow,
  config: Record<string, unknown>,
  ctx: { orgId: string; workflowId: string; workflowRunId: string; stepRunId: string }
): Promise<unknown> {
  switch (step.type) {
    case "llm_call":
      return executeLlmCall(config as unknown as LlmCallConfig);
    case "http_request":
      return executeHttpRequest(config as unknown as HttpRequestConfig);
    case "db_write":
      return executeDbWrite(client, config as unknown as DbWriteConfig, ctx);
    case "notify":
      return executeNotify(client, config as unknown as NotifyConfig, ctx);
    default:
      throw new Error(`Unsupported step type: ${step.type}`);
  }
}
