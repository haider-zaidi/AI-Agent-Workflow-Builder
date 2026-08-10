import { pool, withTransaction } from "../db.js";
import { HttpError, NotFoundError } from "../security/errors.js";
import { runWorkflowSteps } from "../workflow-engine/executor.js";

export interface WebhookTriggerResult {
  workflow_run_id: string;
  status: string;
}

interface TriggerLookup {
  workflow_id: string;
  org_id: string;
  type: string;
}

/**
 * Starts a workflow from an external POST to /webhooks/:token (spec section
 * 24). The token itself (an unguessable uuid stored on workflow_triggers,
 * scoped to one workflow/org) is the credential here - there is no logged-in
 * user, so org role checks don't apply, but the quota check still does.
 *
 * Matches both 'webhook' and 'scheduled' trigger types: a scheduled trigger
 * is started exactly the same way as a webhook one - an HTTP POST with a
 * valid token - the only difference is *who* calls it. A manual trigger
 * (the Run button) never has a meaningful token here, so 'manual' rows are
 * deliberately excluded.
 */
export async function triggerFromWebhook(token: string): Promise<WebhookTriggerResult> {
  const triggerResult = await pool.query<TriggerLookup>(
    `select wt.workflow_id, w.org_id, wt.type
     from workflow_triggers wt
     join workflows w on w.id = wt.workflow_id
     where wt.token = $1 and wt.type in ('webhook', 'scheduled')`,
    [token]
  );
  const trigger = triggerResult.rows[0];
  if (!trigger) {
    throw new NotFoundError("Unknown or inactive webhook");
  }

  const workflowRunId = await withTransaction(async (client) => {
    const orgResult = await client.query<{ quota_allowed: number; quota_used: number }>(
      `select quota_allowed, quota_used from organizations where id = $1 for update`,
      [trigger.org_id]
    );
    const org = orgResult.rows[0];
    if (!org || org.quota_used >= org.quota_allowed) {
      throw new HttpError(402, "Organization quota exhausted - workflow was not started");
    }

    const runResult = await client.query<{ id: string }>(
      `insert into workflow_runs (workflow_id, status, trigger_type, started_at)
       values ($1, 'running', $2, now())
       returning id`,
      [trigger.workflow_id, trigger.type]
    );
    return runResult.rows[0].id;
  });

  const outcome = await runWorkflowSteps(pool, {
    orgId: trigger.org_id,
    workflowId: trigger.workflow_id,
    workflowRunId,
    fromPosition: 1,
  });

  return { workflow_run_id: workflowRunId, status: outcome.status };
}
