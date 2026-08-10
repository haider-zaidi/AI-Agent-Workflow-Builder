import { pool } from "../db.js";
import { sendEmail } from "../email.js";

export interface HasuraEventPayload {
  event: {
    op: string;
    data: { new: Record<string, unknown> | null };
  };
}

interface OwnerRow {
  email: string;
}

/**
 * Handler for the Hasura Event Trigger on notifications(insert) - this is
 * what actually makes the `notify` step type an Event Trigger rather than a
 * direct function call from the executor (spec section 2/17.4).
 *
 * Delivery is always email, always to the organization's owner(s) - never
 * whatever a workflow step's own config claims as a recipient. Only an
 * owner could add a notify step in the first place (workflow_steps insert
 * permission), and only an owner is who should be getting paged by one.
 */
export async function handleNotifyEvent(payload: HasuraEventPayload): Promise<void> {
  const row = payload.event.data.new;
  if (!row) return;

  const id = row.id as string;
  const orgId = row.org_id as string;
  const workflowId = row.workflow_id as string;
  const notifyPayload = row.payload as { message?: string };

  try {
    const ownersResult = await pool.query<OwnerRow>(
      `select au.email
       from org_members om
       join auth.users au on au.id = om.user_id
       where om.org_id = $1 and om.role = 'owner'`,
      [orgId]
    );
    const ownerEmails = ownersResult.rows.map((r) => r.email).filter(Boolean);
    if (ownerEmails.length === 0) {
      throw new Error(`No owner found for organization ${orgId}`);
    }

    const workflowResult = await pool.query<{ name: string }>(
      `select name from workflows where id = $1`,
      [workflowId]
    );
    const workflowName = workflowResult.rows[0]?.name ?? "A workflow";

    await sendEmail({
      to: ownerEmails,
      subject: `${workflowName}: notification from your workflow`,
      text: notifyPayload.message || "A step in your workflow requested a notification.",
    });

    await pool.query(
      `update notifications set status = 'sent', sent_at = now() where id = $1`,
      [id]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await pool.query(
      `update notifications set status = 'failed', error = $2 where id = $1`,
      [id, message]
    );
  }
}
