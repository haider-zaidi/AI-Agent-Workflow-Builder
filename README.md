# AI Agent Workflow Builder

A small, secure, multi-tenant workflow builder (a purpose-built slice of n8n): create workflows out of
LLM calls, HTTP requests, conditional branches, approval gates, DB writes and notifications; run them
manually or via webhook; watch execution progress live; and gate everything behind organization
membership + role, enforced on the backend, not just the UI.

## 1. What this is

- **Multi-tenant**: any number of organizations, users belong to one or more via `org_members` with a
  role (`owner` / `editor` / `viewer`).
- **Workflows**: an ordered list of steps (`llm_call`, `http_request`, `db_write`, `notify`,
  `conditional_branch`, `approval_gate`) plus triggers (`manual`, `webhook`, ...).
- **Execution**: a Node/TS engine runs steps in order, retries `llm_call`/`http_request` once on
  failure, pauses at `approval_gate` until an owner approves, and resumes from the *next* step (never
  restarts).
- **Real-time**: the run screen subscribes to `step_runs` over a GraphQL subscription - no polling, no
  refresh.
- **Security**: every organization-scoped operation checks both (1) org membership and (2) role, in
  Hasura permissions for plain CRUD and in the Action handlers for `triggerWorkflowRun`/`approveStep`.
  Guessing another organization's workflow ID must fail even for an authenticated user.

## 2. Architecture

```text
Next.js (App Router) --GraphQL/WS--> Hasura --Actions/Events--> Node/TS backend --> LLM API / HTTP / Slack
                                        |
                                    PostgreSQL
```

- **Nhost** provides the backend trio: PostgreSQL, Hasura, and Hasura Auth (JWT-based email/password
  auth). Locally these run via `docker-compose.yml` instead of the Nhost CLI - see [section 4](#4-why-docker-compose-instead-of-the-nhost-cli) for why.
- **Hasura** is the GraphQL API and does org-level data isolation via row-level permissions
  (`hasura/metadata`). `triggerWorkflowRun` and `approveStep` are Hasura Actions backed by the Node
  server; `notify` is delivered via a Hasura Event Trigger on the `notifications` table.
- **backend/** is a small Express app: Action handlers, the workflow executor, step type handlers, the
  webhook trigger endpoint, and the notify event handler.
- **frontend/** is Next.js using `@nhost/nhost-js` for auth, `graphql-request` for queries/mutations,
  and `graphql-ws` for subscriptions.

## 3. Project layout

```text
backend/
  src/
    actions/            triggerWorkflowRun, approveStep (Layer 2 authorization)
    security/           authorize.ts (org membership + role checks), errors.ts
    workflow-engine/     executor.ts + steps/{llmCall,httpRequest,dbWrite,notify,conditionalBranch}.ts
    webhooks/            workflow webhook trigger + notify event handler
    scripts/seed.ts      creates the two demo organizations/users from spec section 33
frontend/
  app/                  Next.js App Router pages (login, workflows, run screen, usage, members)
  lib/                  nhost client, session/org React contexts, graphql + subscription helpers
  graphql/               query/mutation/subscription documents
hasura/
  migrations/            SQL schema (organizations -> org_members / workflows -> steps/triggers/runs -> step_runs)
  metadata/               relationships, permissions (role: "user"), Actions, the notify Event Trigger
docker-compose.yml        local Postgres + Hasura + Hasura Auth + Mailhog
```

## 4. Why docker-compose instead of the Nhost CLI

The Nhost CLI has no native Windows binary (Windows support is WSL2-only). Rather than require WSL2,
local dev here runs the same open-source services Nhost runs in the cloud (Postgres, Hasura GraphQL
Engine, Hasura Auth) directly via Docker, driven by the official Hasura CLI (which does have a native
Windows binary). The `hasura/migrations` + `hasura/metadata` directories are the same artifacts you'd
get from a real Nhost project, and deploying to actual Nhost cloud later uses the same Hasura CLI
pointed at the cloud project's GraphQL endpoint.

## 5. Local setup

### Prerequisites

- Node.js 20+, Docker Desktop
- The Hasura CLI on your PATH. On Windows (no native installer script), download the binary directly:

  ```powershell
  Invoke-WebRequest -Uri "https://github.com/hasura/graphql-engine/releases/download/v2.38.0/cli-hasura-windows-amd64.exe" -OutFile "$env:USERPROFILE\bin\hasura.exe"
  # make sure %USERPROFILE%\bin is on PATH
  ```

  On macOS/Linux: `curl -L https://cli.hasura.io/install.sh | bash`

### Steps

```bash
cp .env.example .env                       # docker-compose reads this from the repo root
cp .env.example backend/.env                # dotenv only auto-loads .env from the process's cwd, which
                                             # is backend/ when `npm run dev` runs there (directly or via
                                             # `npm run dev:backend`, since npm workspaces sets cwd to
                                             # the workspace) - not the repo root
cp .env.example frontend/.env.local         # same story for Next.js: only frontend/ itself is auto-loaded
                                             # Keep the shared values (LLM_API_KEY, ports, secrets, etc.)
                                             # in sync across all three copies
npm install                 # installs frontend + backend workspaces

docker compose up -d        # Postgres :55432, Hasura :8081, Hasura Auth :4000, Mailhog UI :8025
                             # (non-default ports - chosen to avoid clashing with services you may
                             # already have running locally on 5432/8080; change freely in
                             # docker-compose.yml + .env if those ports are free on your machine)

hasura migrate apply --project hasura --database-name default
hasura metadata apply --project hasura

npm run dev:backend         # Express Actions/webhook/events server on :4001
npm run dev:frontend        # Next.js on :3000

npm run seed --workspace backend   # creates Organization A/B + demo users (see section 8)
```

Open http://localhost:3000.

## 6. Environment variables

See `.env.example` for the full list with comments. The important ones:

| Variable | Used by | Purpose |
|---|---|---|
| `HASURA_GRAPHQL_ADMIN_SECRET` | hasura, hasura-auth, backend | Admin access to Hasura/Postgres |
| `HASURA_GRAPHQL_JWT_SECRET_KEY` | hasura, hasura-auth | Shared JWT signing key |
| `HASURA_ACTION_SECRET` / `HASURA_EVENT_SECRET` | hasura, backend | Backend rejects Action/Event calls that didn't come from Hasura |
| `LLM_API_KEY` | backend | Groq API key for `llm_call`. Empty -> clearly-disclosed stub response |
| `SLACK_WEBHOOK_URL` | backend | Slack delivery for `notify`. Empty -> logged stub delivery |
| `NEXT_PUBLIC_NHOST_*` | frontend | Auth/GraphQL endpoints (or `NEXT_PUBLIC_NHOST_SUBDOMAIN`/`REGION` for real Nhost cloud) |

Never commit a real `.env` - only `.env.example` is tracked.

## 7. Configuring the LLM API

Sign up for a free [Groq](https://console.groq.com) API key and set `LLM_API_KEY` in `.env`
(`LLM_MODEL` defaults to `llama-3.1-8b-instant`). Without a key, `llm_call` steps return a stubbed
response after an artificial delay so the rest of the workflow (including the conditional branch that
reads the LLM output) still runs end-to-end - this is disclosed in the step's own output
(`{"stub": true, ...}`), never silently.

## 8. Demo data

`npm run seed --workspace backend` (with the stack running) creates the exact scenario from the spec:

| Organization | User | Role |
|---|---|---|
| Organization A | owner-a@example.com | owner |
| Organization A | editor-a@example.com | editor |
| Organization A | viewer-a@example.com | viewer |
| Organization B | owner-b@example.com | owner |

All demo accounts share the password `Password123!`. The script is idempotent (safe to re-run).

## 9. How authentication works

Hasura Auth (`nhost/hasura-auth`) issues a JWT on sign-in containing `x-hasura-user-id` and
`x-hasura-default-role: user` claims. The frontend attaches this JWT as a Bearer token to every
GraphQL request and subscription. There is a single Hasura role (`user`) for all authenticated
requests - org/role-specific access is *not* encoded as different Hasura roles (a user can be `owner`
in one org and `viewer` in another, which a static per-token role can't express). Instead every
permission filter/check dynamically looks up `org_members` for the current `x-hasura-user-id` against
the row's organization. See `hasura/metadata/databases/default/tables/*.yaml`.

## 10. Organization roles & permission model

Two layers, per spec:

**Layer 1 - organization + role (Hasura permissions).** Every table permission filter traverses
relationships back to `org_members` and checks `user_id = x-hasura-user-id`, so a user only ever sees
rows belonging to organizations they're a member of - guessing another org's workflow ID returns an
empty result, not data. Mutations additionally check `role` (e.g. only `owner`/`editor` can insert
`workflows`; only `owner` can insert `workflow_triggers`; only `owner` can insert a `db_write`/`notify`
step). `workflow_runs` and `step_runs` have **no** insert/update/delete permission for the `user` role
at all - they're written exclusively by the backend, which is what stops a client from forging its own
"completed" run or its own approval.

**Layer 2 - sensitive operations + approval (`backend/src/actions`, `backend/src/security/authorize.ts`).**
`triggerWorkflowRun` re-derives the workflow's organization, checks membership, requires
`owner`/`editor`, checks quota, and only then creates a run. `approveStep` re-derives the organization
from the step run, requires `owner` (only owners can approve per spec section 5), and verifies the step
is actually a paused `approval_gate` before recording the approval and resuming.

## 11. How workflow execution works

`backend/src/workflow-engine/executor.ts` loads `workflow_steps` ordered by `position` and runs them
one at a time starting at a given position (1 for a fresh run). For each step it inserts a `step_runs`
row and commits status changes immediately via the connection pool (not inside one long transaction) -
this is what lets the GraphQL subscription see progress *while* the run is still going, not only after
it finishes. `llm_call`/`http_request` get a second attempt on failure (`attempt_count` tracked);
`conditional_branch` evaluates a prior step's output and can skip N following steps; `approval_gate`
marks the run `paused` and stops the loop.

## 12. How approval pause/resume works

1. Executor reaches an `approval_gate` step -> sets `step_runs.status = 'paused'` and
   `workflow_runs.status = 'paused'`, returns.
2. Frontend's live subscription shows the paused state and an **Approve** button (owner only).
3. `approveStep` Action verifies authorization + state, records `approved_by`/`approved_at`, sets the
   step to `completed`, sets the run back to `running`.
4. The executor is invoked again with `fromPosition = (gate's position) + 1` - it re-reads the step
   list and continues from there. It never re-runs earlier steps.

## 13. Testing cross-organization security

With the seed data loaded:

1. Sign in as `owner-a@example.com`, create a workflow in Organization A, copy its URL
   (`/workflows/<id>`).
2. Sign in as `owner-b@example.com` (Organization B only) and open that same URL directly.
   `workflows_by_pk` returns `null` (Hasura's permission filter excludes the row) -> the page shows
   "Workflow not found, or you do not have access to it."
3. As `owner-b@example.com`, call `triggerWorkflowRun`/`approveStep` against Organization A's
   workflow/step-run IDs (e.g. via GraphiQL) - both return a 403 from `requireWorkflowOrgRole`/
   `getOrgRole` in `backend/src/security/authorize.ts`, because the lookup finds no `org_members` row
   for that user in that organization.
4. As `viewer-a@example.com`, confirm the Run button is disabled/hidden and `triggerWorkflowRun`
   still rejects a direct call (`requireRole` only allows `owner`/`editor`).

## 14. Running the final demonstration

1. Sign in as `owner-a@example.com`. Create a workflow with steps in this order: `llm_call` ->
   `http_request` -> `conditional_branch` (checking step 1's output) -> `approval_gate` -> `db_write`.
   Add a webhook trigger from the workflow page (owner only).
2. Click **Run Workflow** - you're taken to the run screen, which updates live as each step completes,
   then shows **Paused** with an **Approve** button at the approval gate.
3. Click **Approve** - the run resumes from `db_write` (not from the start) and completes.
4. `POST` to the webhook URL shown on the workflow page (e.g. `curl -X POST <url>`) - the same workflow
   starts without touching the Run button.
5. Repeat section 13's cross-org checks as `owner-b@example.com`.

## 15. Deployment

- **Frontend**: Vercel, with the `NEXT_PUBLIC_*` vars pointed at your Nhost cloud project (or your own
  hosted Hasura/Auth).
- **Backend/infra**: create a real Nhost project at nhost.io, apply `hasura/migrations` and
  `hasura/metadata` against it with the Hasura CLI (`--endpoint <project>.hasura.<region>.nhost.run`,
  `--admin-secret <secret>`), then deploy `backend/` anywhere that can run a Node process (Railway,
  Render, Fly.io, etc.) and set `ACTIONS_BASE_URL`/the notify Event Trigger's webhook base URL in
  Hasura to point at it.

---

**One-page technical write-up** (schema reasoning, the two permission layers, and the approval gate
flow) is covered inline above in sections 10-12, per the spec's write-up requirement.
