import type { Queryable } from "../../db.js";

export interface NotifyConfig {
  message?: string;
}

export interface NotifyContext {
  orgId: string;
  workflowId: string;
  stepRunId: string;
}

/**
 * The notify step does not send the message itself. It inserts a row into
 * `notifications`, and a Hasura Event Trigger on that table's insert calls
 * the backend's /events/notify endpoint to do the actual delivery - this is
 * the "notify implemented as an Event Trigger" requirement (spec 17.4/2).
 *
 * Delivery is always by email, always to the organization's owner(s) -
 * backend/src/webhooks/notifyEvent.ts resolves the real recipient from
 * org_members/auth.users itself, never from step config, so there's nothing
 * to configure here beyond the message.
 */
export async function executeNotify(
  client: Queryable,
  config: NotifyConfig,
  ctx: NotifyContext
): Promise<unknown> {
  const payload = { message: config.message ?? "" };

  const result = await client.query<{ id: string }>(
    `insert into notifications (org_id, workflow_id, step_run_id, channel, payload)
     values ($1, $2, $3, 'email', $4)
     returning id`,
    [ctx.orgId, ctx.workflowId, ctx.stepRunId, JSON.stringify(payload)]
  );

  return { notification_id: result.rows[0].id, channel: "email", queued: true };
}
