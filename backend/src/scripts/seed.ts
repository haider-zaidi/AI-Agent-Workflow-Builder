import "dotenv/config";
import { pool } from "../db.js";

const AUTH_URL = process.env.AUTH_URL ?? "http://localhost:4000";
const DEMO_PASSWORD = "Password123!";

interface DemoUser {
  email: string;
  role: "owner" | "editor" | "viewer";
}

interface DemoOrg {
  name: string;
  quotaAllowed: number;
  users: DemoUser[];
}

// Recreates the exact demo scenario from spec section 33: two orgs, with
// Organization A having one member of each role and Organization B having
// only an owner, so cross-org isolation is easy to walk through.
const ORGS: DemoOrg[] = [
  {
    name: "Organization A",
    quotaAllowed: 100,
    users: [
      { email: "owner-a@example.com", role: "owner" },
      { email: "editor-a@example.com", role: "editor" },
      { email: "viewer-a@example.com", role: "viewer" },
    ],
  },
  {
    name: "Organization B",
    quotaAllowed: 100,
    users: [{ email: "owner-b@example.com", role: "owner" }],
  },
];

async function signUpOrSignIn(email: string): Promise<string> {
  const signUpResponse = await fetch(`${AUTH_URL}/signup/email-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  const signUpBody = (await signUpResponse.json()) as {
    session?: { user?: { id: string } };
    error?: string;
  };
  if (signUpResponse.ok && signUpBody.session?.user?.id) {
    return signUpBody.session.user.id;
  }

  // Already exists from a previous seed run - sign in instead.
  const signInResponse = await fetch(`${AUTH_URL}/signin/email-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  const signInBody = (await signInResponse.json()) as {
    session?: { user?: { id: string } };
  };
  const userId = signInBody.session?.user?.id;
  if (!userId) {
    throw new Error(`Could not sign up or sign in ${email}: ${JSON.stringify(signUpBody)}`);
  }
  return userId;
}

async function main() {
  for (const org of ORGS) {
    const orgResult = await pool.query<{ id: string }>(
      `insert into organizations (name, quota_allowed)
       values ($1, $2)
       returning id`,
      [org.name, org.quotaAllowed]
    );
    const orgId = orgResult.rows[0].id;
    console.log(`Created ${org.name} (${orgId})`);

    for (const user of org.users) {
      const userId = await signUpOrSignIn(user.email);
      await pool.query(
        `insert into org_members (org_id, user_id, role)
         values ($1, $2, $3)
         on conflict (org_id, user_id) do update set role = excluded.role`,
        [orgId, userId, user.role]
      );
      console.log(`  ${user.email} -> ${user.role} (${userId})`);
    }
  }

  console.log(`\nAll demo users share the password: ${DEMO_PASSWORD}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
