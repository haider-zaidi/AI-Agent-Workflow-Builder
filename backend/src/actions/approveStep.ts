import { pool, withTransaction } from "../db.js";
import { requireRole, requireUserId, getOrgRole, type SessionVariables } from "../security/authorize.js";
import { ForbiddenError, HttpError, NotFoundError } from "../security/errors.js";
import { runWorkflowSteps } from "../workflow-engine/executor.js";

export interface ApproveStepInput {
  step_run_id: string;
}

export interface ApproveStepOutput {
  step_run_id: string;
  status: string;
  workflow_run_status: string;
}

interface StepRunLookup {
  step_run_id: string;
  step_run_status: string;
  step_type: string;
  step_position: number;
  workflow_id: string;
  workflow_run_id: string;
  workflow_run_status: string;
  org_id: string;
}

/**
 * Approval flow (spec section 18/37):
 * 1. Authenticate  2. Find step run  3. Find workflow run  4. Find workflow
 * 5. Find organization  6-7. Check org_members  8. Check role is allowed to
 * approve (owner only - "Approve approval-gate steps" is an owner-only
 * capability per spec section 5)  9. Step is actually an approval_gate
 * 10. Workflow is currently paused there  11. Record approval  12. Resume
 * from the *next* step, never from the beginning.
 */
export async function approveStep(
  input: ApproveStepInput,
  sessionVariables: SessionVariables
): Promise<ApproveStepOutput> {
  const userId = requireUserId(sessionVariables);

  const lookupResult = await pool.query<StepRunLookup>(
    `select
        sr.id as step_run_id,
        sr.status as step_run_status,
        ws.type as step_type,
        ws.position as step_position,
        w.id as workflow_id,
        wr.id as workflow_run_id,
        wr.status as workflow_run_status,
        w.org_id as org_id
     from step_runs sr
     join workflow_steps ws on ws.id = sr.workflow_step_id
     join workflow_runs wr on wr.id = sr.workflow_run_id
     join workflows w on w.id = wr.workflow_id
     where sr.id = $1`,
    [input.step_run_id]
  );
  const stepRun = lookupResult.rows[0];
  if (!stepRun) {
    throw new NotFoundError("Step run not found");
  }

  const role = await getOrgRole(pool, stepRun.org_id, userId);
  if (!role) {
    throw new ForbiddenError("You do not belong to this organization");
  }
  requireRole(role, ["owner"]);

  if (stepRun.step_type !== "approval_gate") {
    throw new HttpError(400, "This step is not an approval gate");
  }
  if (stepRun.workflow_run_status !== "paused" || stepRun.step_run_status !== "paused") {
    throw new HttpError(409, "This workflow is not currently paused at this approval gate");
  }

  await withTransaction(async (client) => {
    await client.query(
      `update step_runs
       set status = 'completed', approved_by = $2, approved_at = now(), completed_at = now()
       where id = $1`,
      [stepRun.step_run_id, userId]
    );
    await client.query(`update workflow_runs set status = 'running' where id = $1`, [
      stepRun.workflow_run_id,
    ]);
  });

  const outcome = await runWorkflowSteps(pool, {
    orgId: stepRun.org_id,
    workflowId: stepRun.workflow_id,
    workflowRunId: stepRun.workflow_run_id,
    fromPosition: stepRun.step_position + 1,
  });

  return {
    step_run_id: stepRun.step_run_id,
    status: "completed",
    workflow_run_status: outcome.status,
  };
}
