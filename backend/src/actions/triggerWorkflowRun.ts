import { pool, withTransaction } from "../db.js";
import { requireRole, requireUserId, requireWorkflowOrgRole, type SessionVariables } from "../security/authorize.js";
import { HttpError } from "../security/errors.js";
import { runWorkflowSteps } from "../workflow-engine/executor.js";

export interface TriggerWorkflowRunInput {
  workflow_id: string;
}

export interface TriggerWorkflowRunOutput {
  workflow_run_id: string;
  status: string;
}

/**
 * Main workflow execution entry point (spec section 19). Sequence:
 * 1. Identify current user  2. Find workflow  3. Find its org
 * 4. Check org_members      5. Check role (owner/editor)
 * 6. Check quota            7. Create workflow_run   8. Execute steps.
 * Any failed check throws before a workflow_run row (or any side effect)
 * is ever created.
 */
export async function triggerWorkflowRun(
  input: TriggerWorkflowRunInput,
  sessionVariables: SessionVariables
): Promise<TriggerWorkflowRunOutput> {
  const userId = requireUserId(sessionVariables);

  const { orgId, role } = await requireWorkflowOrgRole(pool, input.workflow_id, userId);
  requireRole(role, ["owner", "editor"]);

  // Quota check + workflow_run creation happen in one short transaction with
  // a row lock, so two concurrent triggers on a nearly-exhausted quota can't
  // both slip through. Step execution below intentionally runs outside this
  // transaction (see db.ts `Queryable`) so progress is visible live.
  const workflowRunId = await withTransaction(async (client) => {
    const orgResult = await client.query<{ quota_allowed: number; quota_used: number }>(
      `select quota_allowed, quota_used from organizations where id = $1 for update`,
      [orgId]
    );
    const org = orgResult.rows[0];
    if (!org) {
      throw new HttpError(404, "Organization not found");
    }
    if (org.quota_used >= org.quota_allowed) {
      throw new HttpError(402, "Organization quota exhausted - workflow was not started");
    }

    const runResult = await client.query<{ id: string }>(
      `insert into workflow_runs (workflow_id, status, trigger_type, triggered_by, started_at)
       values ($1, 'running', 'manual', $2, now())
       returning id`,
      [input.workflow_id, userId]
    );
    return runResult.rows[0].id;
  });

  const outcome = await runWorkflowSteps(pool, {
    orgId,
    workflowId: input.workflow_id,
    workflowRunId,
    fromPosition: 1,
  });

  return { workflow_run_id: workflowRunId, status: outcome.status };
}
