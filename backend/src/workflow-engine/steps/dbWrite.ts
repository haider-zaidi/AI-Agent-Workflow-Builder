import type { Queryable } from "../../db.js";

export interface DbWriteConfig {
  /** Static fields to merge into the saved record, e.g. { "customer": "Haider" }. */
  data?: Record<string, unknown>;
}

export interface DbWriteContext {
  orgId: string;
  workflowId: string;
  workflowRunId: string;
  stepRunId: string;
}

/**
 * Only an organization owner may add a db_write step (enforced at insert
 * time by the workflow_steps Hasura permission). Executing it just persists
 * the resolved config into the app-owned workflow_records table, scoped by
 * org_id so it is subject to the same isolation as everything else.
 */
export async function executeDbWrite(
  client: Queryable,
  config: DbWriteConfig,
  ctx: DbWriteContext
): Promise<unknown> {
  const data = config.data ?? {};
  const result = await client.query<{ id: string }>(
    `insert into workflow_records (org_id, workflow_id, workflow_run_id, step_run_id, data)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [ctx.orgId, ctx.workflowId, ctx.workflowRunId, ctx.stepRunId, JSON.stringify(data)]
  );
  return { record_id: result.rows[0].id, data };
}
