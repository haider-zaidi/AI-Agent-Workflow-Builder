import { pool } from "../db.js";
import { getOrgRole, requireRole, requireUserId, type SessionVariables } from "../security/authorize.js";
import { ForbiddenError } from "../security/errors.js";

export interface LookupUserByEmailInput {
  org_id: string;
  email: string;
}

export interface LookupUserByEmailOutput {
  user_id: string | null;
  display_name: string | null;
  email: string | null;
  already_member: boolean;
}

/**
 * Resolves an email to a user id so an owner can add them to org_members
 * (spec: "Manage organization members" is owner-only). This exists because
 * the auth.users select permission only lets someone see users who already
 * share an org with them - a brand new signup wouldn't be visible via plain
 * GraphQL yet, so the lookup itself needs the same org-scoped authorization
 * as the rest of the owner-only Actions.
 */
export async function lookupUserByEmail(
  input: LookupUserByEmailInput,
  sessionVariables: SessionVariables
): Promise<LookupUserByEmailOutput> {
  const userId = requireUserId(sessionVariables);

  const role = await getOrgRole(pool, input.org_id, userId);
  if (!role) {
    throw new ForbiddenError("You do not belong to this organization");
  }
  requireRole(role, ["owner"]);

  const userResult = await pool.query<{ id: string; display_name: string; email: string }>(
    `select id, display_name, email from auth.users where lower(email) = lower($1)`,
    [input.email]
  );
  const user = userResult.rows[0];
  if (!user) {
    return { user_id: null, display_name: null, email: null, already_member: false };
  }

  const memberResult = await pool.query(
    `select 1 from org_members where org_id = $1 and user_id = $2`,
    [input.org_id, user.id]
  );

  return {
    user_id: user.id,
    display_name: user.display_name,
    email: user.email,
    already_member: (memberResult.rowCount ?? 0) > 0,
  };
}
