import type { Queryable } from "../db.js";
import type { Role } from "../workflow-engine/types.js";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "./errors.js";

export interface SessionVariables {
  "x-hasura-user-id"?: string;
  "x-hasura-role"?: string;
  [key: string]: string | undefined;
}

/**
 * Layer 1, step 1: who is making this request?
 * Hasura Actions send the caller's session variables in the request body -
 * this is authenticated by Hasura Auth's JWT before the action ever runs,
 * so a missing user id here means the request is not authenticated at all.
 */
export function requireUserId(sessionVariables: SessionVariables): string {
  const userId = sessionVariables["x-hasura-user-id"];
  if (!userId) {
    throw new UnauthenticatedError();
  }
  return userId;
}

/**
 * Layer 1, steps 3-5: does this user belong to the organization that owns
 * `workflowId`, and if so with which role? Every organization-scoped
 * Action handler must call this before doing anything else - it is what
 * makes cross-organization ID guessing return a 403/404 instead of data.
 */
export async function requireWorkflowOrgRole(
  client: Queryable,
  workflowId: string,
  userId: string
): Promise<{ orgId: string; role: Role }> {
  const workflowResult = await client.query<{ org_id: string }>(
    `select org_id from workflows where id = $1`,
    [workflowId]
  );
  const workflow = workflowResult.rows[0];
  if (!workflow) {
    throw new NotFoundError("Workflow not found");
  }

  const role = await getOrgRole(client, workflow.org_id, userId);
  if (!role) {
    throw new ForbiddenError("You do not belong to this organization");
  }

  return { orgId: workflow.org_id, role };
}

export async function getOrgRole(
  client: Queryable,
  orgId: string,
  userId: string
): Promise<Role | null> {
  const result = await client.query<{ role: Role }>(
    `select role from org_members where org_id = $1 and user_id = $2`,
    [orgId, userId]
  );
  return result.rows[0]?.role ?? null;
}

export function requireRole(role: Role, allowed: Role[]): void {
  if (!allowed.includes(role)) {
    throw new ForbiddenError(
      `Role '${role}' is not permitted to perform this operation`
    );
  }
}
