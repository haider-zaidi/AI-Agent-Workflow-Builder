# AI Agent Workflow Builder

A small, secure, multi-tenant workflow builder (a purpose-built slice of n8n/Zapier): create workflows out
of LLM calls, HTTP requests, conditional branches, approval gates, DB writes and email notifications; run
them manually, via webhook, or on a schedule; watch execution progress live; and gate everything behind
organization membership + role, enforced on the backend — not just the UI.

**Live demo:** https://ai-agent-workflow-builder-frontend-pi.vercel.app

> This README covers both **local development setup** and **assignment/reviewer documentation**
> (architecture, schema reasoning, permission layers, approval-gate mechanics). Everything below is
> verified against this repository's actual code — nothing is aspirational.

---

## Table of Contents

1. [What This Is](#what-this-is)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Live Demo](#live-demo-1)
5. [Getting Started (Local Development)](#getting-started-local-development)
6. [Local Demo Accounts](#local-demo-accounts)
7. [User & Organization Onboarding](#user--organization-onboarding)
8. [Authentication & Authorization](#authentication--authorization)
9. [Database Schema](#database-schema)
10. [Hasura Metadata & the Two Permission Layers](#hasura-metadata--the-two-permission-layers)
11. [Approval-Gate Pause / Resume](#approval-gate-pause--resume)
12. [Project Structure](#project-structure)
13. [Running the Application](#running-the-application)
14. [Testing](#testing)
15. [Reviewer Quick Start](#reviewer-quick-start)
16. [API / External Services](#api--external-services)
17. [Troubleshooting](#troubleshooting)
18. [Security Notes](#security-notes)
19. [Assignment Design Notes](#assignment-design-notes)
20. [Recording / Final Task Walkthrough](#recording--final-task-walkthrough)

---

## What This Is

- **Multi-tenant**: any number of organizations; users belong to one or more via `org_members` with a
  role (`owner` / `editor` / `viewer`).
- **Workflows**: an ordered list of steps (`llm_call`, `http_request`, `db_write`, `notify`,
  `conditional_branch`, `approval_gate`) plus triggers (`manual`, `webhook`, `scheduled`).
- **Execution**: a Node/TS engine runs steps in order, retries `llm_call`/`http_request` once on failure,
  pauses at `approval_gate` until an owner approves, and resumes from the *next* step (never restarts).
- **Real-time**: the run screen subscribes to `step_runs` over a GraphQL subscription — no polling, no
  manual refresh.
- **Notifications**: the `notify` step delivers an email to the organization's owner(s) via a Hasura Event
  Trigger, not inline from the executor.
- **Security**: every organization-scoped operation checks both (1) org membership and (2) role — in
  Hasura row-level permissions for plain CRUD, and in backend Action handlers for
  `triggerWorkflowRun`/`approveStep`. Guessing another organization's workflow ID must fail even for an
  authenticated user.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Frontend styling | Tailwind CSS v4, `class-variance-authority`, `tailwind-merge`, `framer-motion`, `lucide-react`, Radix UI primitives |
| Frontend data layer | `@nhost/nhost-js` (auth), `graphql-request` (queries/mutations), `graphql-ws` (live subscriptions) |
| Backend | Node.js (TypeScript, ESM), Express |
| Backend data access | `pg` (node-postgres) — direct connection pool, bypassing the GraphQL API for all backend writes |
| Backend utilities | `zod`, `dotenv`, `nodemailer` |
| Database | PostgreSQL |
| API layer | Hasura GraphQL Engine (queries, mutations, subscriptions, row-level permissions, Actions, Event Triggers) |
| Auth | Hasura Auth (`nhost/hasura-auth`) — JWT-based email/password auth |
| Platform | Nhost (bundles Postgres + Hasura + Auth as one managed project in production; replicated locally via Docker Compose) |
| LLM provider | Groq (OpenAI-compatible API) for the `llm_call` step — optional, stubs cleanly if no key is set |
| Email delivery | SMTP via `nodemailer` (local: Mailhog; see [Troubleshooting](#troubleshooting) for the production caveat) |

No test framework, ORM, or state-management library is present in the repository — confirmed against
`package.json` in `frontend/`, `backend/`, and the repo root.

---

## Architecture

```mermaid
flowchart TB
    Browser["Browser"]
    FE["Next.js Frontend<br/>(Vercel)"]
    Auth["Hasura Auth<br/>(JWT email/password)"]
    Hasura["Hasura GraphQL Engine<br/>(permissions, Actions, Event Triggers)"]
    PG[("PostgreSQL")]
    BE["Node/Express Backend<br/>(Actions handlers, workflow executor)"]
    LLM["Groq LLM API"]
    HTTP["Arbitrary HTTP endpoint<br/>(http_request step)"]
    SMTP["SMTP (email delivery)"]
    Cron["External scheduler<br/>(e.g. cron-job.org)"]

    Browser -->|"REST: signup/signin"| Auth
    Browser -->|"GraphQL over HTTP + WebSocket"| Hasura
    Auth --> PG
    Hasura --> PG
    Hasura -->|"Actions: triggerWorkflowRun,<br/>approveStep, lookupUserByEmail"| BE
    Hasura -->|"Event Trigger: notify_on_insert"| BE
    BE -->|"direct SQL (pg.Pool)"| PG
    BE --> LLM
    BE --> HTTP
    BE --> SMTP
    Cron -->|"POST /webhooks/:token"| BE
```

- **Frontend** (`frontend/`) — Next.js App Router. Talks to Hasura directly for all data (queries,
  mutations, subscriptions) and to Hasura Auth directly for sign-up/sign-in. It never calls the backend
  directly except to display a webhook/scheduled-trigger URL as text.
- **Hasura** — the entire GraphQL API. Does org-level data isolation via row-level permissions
  (`hasura/metadata` / `nhost/metadata`), routes 3 Actions and 1 Event Trigger to the backend.
- **Backend** (`backend/`) — a small Express app: Action handlers, the workflow executor, step-type
  handlers, the webhook trigger endpoint, and the notify Event Trigger handler. Connects to Postgres
  directly via `pg`, bypassing Hasura's GraphQL API entirely for writes.
- **PostgreSQL** — single database; `public` schema holds the app's own tables, `auth` schema is owned by
  Hasura Auth.

---

## Live Demo

**Frontend:** https://ai-agent-workflow-builder-frontend-pi.vercel.app

The production backend runs on Railway; production Postgres/Hasura/Auth run on Nhost Cloud
(`ap-south-1` region). These URLs are internal to the deployed system — reviewers only need the frontend
URL above.

> **Note on production email delivery:** the `notify` step is fully implemented (see
> [Approval-Gate / notify implementation](#hasura-metadata--the-two-permission-layers)) and works
> end-to-end locally via Mailhog. In the current production deployment, outbound SMTP traffic from the
> Railway-hosted backend is not completing (a common restriction on PaaS platforms to prevent spam abuse);
> the notify step still correctly inserts a row and fires the Event Trigger, but the actual send can hang.
> This is a known, disclosed limitation of the current hosting configuration, not the notify
> implementation itself.

---

## Getting Started (Local Development)

### Prerequisites

- **Node.js 20+**
- **Docker Desktop** (runs local Postgres + Hasura + Hasura Auth + Mailhog)
- **Hasura CLI** on your PATH — used to apply migrations/metadata locally. Windows has no native installer
  script:

  ```powershell
  Invoke-WebRequest -Uri "https://github.com/hasura/graphql-engine/releases/download/v2.38.0/cli-hasura-windows-amd64.exe" -OutFile "$env:USERPROFILE\bin\hasura.exe"
  # ensure %USERPROFILE%\bin is on PATH
  ```

  macOS/Linux: `curl -L https://cli.hasura.io/install.sh | bash`

> The **Nhost CLI** is only needed if you intend to deploy to Nhost Cloud yourself — it has no native
> Windows binary (WSL2-only). Local development does **not** require it; it's replaced by Docker Compose
> running the same open-source services (see [why](#why-docker-compose-instead-of-the-nhost-cli) below).

### 1. Clone the repository

```bash
git clone https://github.com/haider-zaidi/AI-Agent-Workflow-Builder.git
cd AI-Agent-Workflow-Builder
```

### 2. Install dependencies

This is an npm-workspaces monorepo. One install at the root covers both `frontend/` and `backend/`
(declared in the root `package.json`'s `"workspaces"` field). A `functions/` directory exists with its own
`package.json` but currently contains no functions — nothing to install there.

```bash
npm install
```

### 3. Environment variables

Three `.env` files are needed because environment loaders (`dotenv`, Next.js) only auto-load `.env` files
from their own process's working directory, not the monorepo root:

```bash
cp .env.example .env                   # read by docker-compose.yml + hasura/config.yaml
cp .env.example backend/.env           # read by the backend when it runs (cwd = backend/)
cp .env.example frontend/.env.local    # read by Next.js (only frontend/ itself is auto-loaded)
```

Keep the shared values (secrets, API keys, ports) in sync across all three copies. **Never commit a real
`.env`, `.env.local`, or `.secrets`** — only `.env.example` is tracked (see `.gitignore`).

| Variable | Used by | Purpose | Required? | Local example |
|---|---|---|---|---|
| `POSTGRES_PASSWORD` | docker-compose | Local Postgres password | Yes | `postgres` |
| `HASURA_GRAPHQL_ADMIN_SECRET` | hasura, hasura-auth, backend, CLI | Admin access to Hasura/Postgres | Yes | `devsecret` |
| `HASURA_GRAPHQL_JWT_SECRET_KEY` | hasura, hasura-auth | Shared JWT signing key (32+ chars) | Yes | `development-only-jwt-secret-key-please-change-32chars` |
| `HASURA_ACTION_SECRET` / `HASURA_EVENT_SECRET` | hasura, backend | Backend rejects Action/Event calls that didn't come from Hasura | Yes | `devsecret-action` / `devsecret-event` |
| `FRONTEND_URL` | hasura-auth | Used for auth-related links | Yes | `http://localhost:3000` |
| `PORT` | backend | Port the Express server listens on | No (defaults to `4001`) | `4001` |
| `DATABASE_URL` | backend | Direct Postgres connection string | Yes | `postgres://postgres:postgres@localhost:55432/postgres` |
| `HASURA_GRAPHQL_URL` | backend | Defined but not currently called by any backend code path | No | `http://localhost:8081/v1/graphql` |
| `AUTH_URL` | backend (seed script only) | Hasura Auth REST base URL, used by `npm run seed` | Only for seeding | `http://localhost:4000` |
| `LLM_PROVIDER` | backend | LLM provider identifier for the `llm_call` step | No | `groq` |
| `LLM_API_KEY` | backend | Groq API key. **See below — the app runs fully without one.** | No | *(leave empty for local dev)* |
| `LLM_MODEL` | backend | Groq model name | No | `llama-3.1-8b-instant` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | backend | SMTP target for `notify` step email delivery | Yes (defaults point at local Mailhog) | `localhost` / `1025` / `false` |
| `SMTP_USER` / `SMTP_PASS` | backend | SMTP auth (Mailhog needs none) | No, for Mailhog | *(empty)* |
| `SMTP_FROM` | backend | From-address for notify emails | No | `AI Agent Workflow Builder <notifications@ai-workflow-builder.local>` |
| `NEXT_PUBLIC_NHOST_SUBDOMAIN` / `NEXT_PUBLIC_NHOST_REGION` | frontend | Set these **instead of** the URL vars below when pointing at a real Nhost Cloud project | No | *(empty for local Docker Compose)* |
| `NEXT_PUBLIC_NHOST_AUTH_URL` | frontend | Hasura Auth base URL | Yes (for local Docker Compose) | `http://localhost:4000/v1` |
| `NEXT_PUBLIC_NHOST_GRAPHQL_URL` | frontend | Hasura GraphQL endpoint — used directly by `frontend/lib/graphql.ts` and `frontend/lib/useLiveQuery.ts` (does **not** get derived from subdomain/region) | Yes (for local Docker Compose) | `http://localhost:8081/v1/graphql` |
| `NEXT_PUBLIC_NHOST_STORAGE_URL` | frontend | Required by the Nhost SDK constructor; storage is not used by any feature | Yes (SDK requires a value) | `http://localhost:8000/v1` |
| `NEXT_PUBLIC_BACKEND_URL` | frontend | Only used to display the webhook/scheduled-trigger URL as text on the workflow page | No | `http://localhost:4001` |

**No external API key is strictly required to run the project locally.** If `LLM_API_KEY` is left empty,
`llm_call` steps return a stubbed response after a short artificial delay instead of calling Groq — this is
disclosed in the step's own output (`{"stub": true, ...}`), never silently, and the rest of the workflow
(including any conditional branch reading that output) still runs end-to-end. To use a real LLM, sign up
for a free key at [console.groq.com](https://console.groq.com).

### 4. Start the local Nhost-equivalent stack

The Nhost CLI has no native Windows binary, so local development runs the same open-source services Nhost
runs in the cloud (Postgres, Hasura GraphQL Engine, Hasura Auth), directly via Docker, plus Mailhog as a
local fake-SMTP catcher:

```bash
docker compose up -d
```

This starts:

| Service | Container | Local port | Purpose |
|---|---|---|---|
| PostgreSQL 15 | `postgres` | `55432` | Database (non-default port to avoid clashing with any local Postgres on `5432`) |
| Hasura GraphQL Engine v2.38 | `graphql-engine` | `8081` | GraphQL API, console, Actions/Event Trigger routing |
| Hasura Auth | `auth` | `4000` | Email/password auth, JWT issuance |
| Mailhog | `mailhog` | `8025` (web UI), `1025` (SMTP) | Catches `notify`-step emails locally — view them at http://localhost:8025 |

Ports are non-default by design (see `docker-compose.yml`) to avoid clashing with services you may already
have running; change them freely in `docker-compose.yml` + `.env` if needed.

#### Why Docker Compose instead of the Nhost CLI {#why-docker-compose-instead-of-the-nhost-cli}

The Nhost CLI's Windows support is WSL2-only. Rather than require WSL2, this repo runs the identical
open-source services Nhost runs in the cloud, via Docker, driven by the official Hasura CLI (which does
have a native Windows binary). `hasura/migrations` + `hasura/metadata` are the same artifacts a real Nhost
project uses; deploying to Nhost Cloud later uses the same Hasura CLI pointed at the cloud project's
endpoint (the `nhost/` directory in this repo mirrors that content for the actual cloud deployment).

### 5. Apply the database schema (migrations + metadata)

```bash
hasura migrate apply --project hasura --database-name default
hasura metadata apply --project hasura
```

- **Migrations** (`hasura/migrations/default/1700000000000_init/up.sql`) create every table in one
  migration: `organizations`, `org_members`, `workflows`, `workflow_steps`, `workflow_triggers`,
  `workflow_runs`, `step_runs`, `workflow_records`, `notifications`, plus the `organization_usage` view and
  an `updated_at` trigger helper.
- **Metadata** (`hasura/metadata/`) declares table relationships, row-level permissions per role, the 3
  Hasura Actions, and the 1 Event Trigger. It's applied as a separate step from migrations.

Root-level npm scripts wrap both of these if you prefer:

```bash
npm run hasura:migrate
npm run hasura:metadata-apply
```

### 6. Start the app

```bash
npm run dev:backend    # Express Actions/webhook/events server on :4001
npm run dev:frontend   # Next.js on :3000
```

Open **http://localhost:3000**.

### 7. Seed demo data

```bash
npm run seed --workspace backend
```

See [Local Demo Accounts](#local-demo-accounts) below for exactly what this creates. The script is
idempotent — safe to re-run.

---

## Local Demo Accounts

> **These are local development credentials only.** They exist in the local Docker Compose
> Postgres/Hasura-Auth instance created by the seed script below, share a fixed known password, and must
> **never** be reused as real production credentials.

Running `npm run seed --workspace backend` (verified directly against `backend/src/scripts/seed.ts`)
creates exactly this scenario:

| Organization | User | Role |
|---|---|---|
| Organization A | `owner-a@example.com` | owner |
| Organization A | `editor-a@example.com` | editor |
| Organization A | `viewer-a@example.com` | viewer |
| Organization B | `owner-b@example.com` | owner |

All four accounts share the password **`Password123!`**. The script signs each account up through Hasura
Auth's real REST API (falling back to sign-in if the account already exists), then inserts the
`organizations`/`org_members` rows directly — so these are ordinary accounts, not special-cased ones.

> **Note on the specific demo credentials `haiderzaidi45h@gmail.com` / `zaidihsn127@gmail.com`:** these
> are not what the seed script produces — the seed script always creates the four `*-a@example.com` /
> `*-b@example.com` accounts above. If you want the exact `haiderzaidi45h@gmail.com` (Organization A
> owner) / `zaidihsn127@gmail.com` (Organization B owner) accounts, sign up with those emails through the
> app's normal sign-up page and have an existing owner add them via **Members → Add Member** (see next
> section) — or insert the `org_members` row directly. Also note this project enforces a **9-character
> minimum password**; a password like `zaidihsn` (8 characters) will be rejected by sign-up.

---

## User & Organization Onboarding

A newly registered user is **not** automatically added to any organization. Verified against
`frontend/lib/org.tsx` (which filters a new user's organization list down to `members.length > 0`) and
`frontend/app/(app)/members/page.tsx`:

1. A new user signs up through the app's sign-up page (email/password, via Hasura Auth).
2. They log in successfully — authentication succeeds independently of organization membership.
3. Since they belong to no organization yet, the app shows **"You do not belong to any organization
   yet."**
4. An **existing organization owner** goes to the **Members** page for their organization.
5. The owner clicks **Add Member**.
6. The owner enters the new user's **email address** and selects a **role**.
7. Behind the scenes, this calls the `lookupUserByEmail` Hasura Action (owner-only), which resolves the
   email to a user ID — this is necessary because `auth.users`'s own select permission only lets someone
   see users who already share an organization with them, so a brand-new signup wouldn't otherwise be
   visible via plain GraphQL.
8. If found and not already a member, the owner's **Add Member** submission inserts an `org_members` row
   linking that user to the organization with the chosen role.
9. The user can now access organization-scoped functionality according to that role.

**Available roles** (from the `org_members.role` check constraint and Hasura permissions):
`owner`, `editor`, `viewer`.

| Role | Can do |
|---|---|
| `owner` | Everything `editor` can, plus: manage members (add/change role/remove), manage triggers (webhook/scheduled), add `db_write`/`notify` steps, approve `approval_gate` steps |
| `editor` | Create/run workflows, add most step types (not `db_write`/`notify`) |
| `viewer` | Read-only — cannot trigger runs or modify anything |

---

## Authentication & Authorization

These are deliberately separate concerns in this codebase:

- **Authentication** (*who is this user?*) is entirely Hasura Auth's job. Sign-up/sign-in/logout go through
  `@nhost/nhost-js` (`frontend/lib/nhost.ts`) calling Hasura Auth's REST API. On success, Hasura Auth
  issues a JWT containing `x-hasura-user-id` and `x-hasura-default-role: user` claims. The frontend attaches
  this JWT as `Authorization: Bearer <token>` to every GraphQL request (`frontend/lib/graphql.ts`) and
  subscription (`frontend/lib/useLiveQuery.ts`). Sessions are refreshed automatically by the SDK; logout
  clears the session client-side.
- **Authorization** (*what can this authenticated user do?*) is **not** encoded as different Hasura roles —
  there's a single Hasura role, `user`, for every authenticated request. This is deliberate: a person can
  be `owner` in one organization and `viewer` in another, which a single static per-token role can't
  express. Instead, every permission filter and every Action handler dynamically looks up the caller's
  `org_members` row for the specific organization the request touches. See the next section for exactly
  how.

---

## Database Schema

Defined entirely in `hasura/migrations/default/1700000000000_init/up.sql` (mirrored at
`nhost/migrations/` for the production deployment):

```mermaid
erDiagram
    organizations ||--o{ org_members : "has"
    organizations ||--o{ workflows : "owns"
    organizations ||--o{ workflow_records : "scopes"
    organizations ||--o{ notifications : "scopes"
    organizations ||--|| organization_usage : "aggregated by (view)"
    workflows ||--o{ workflow_steps : "has ordered"
    workflows ||--o{ workflow_triggers : "has"
    workflows ||--o{ workflow_runs : "executed as"
    workflow_runs ||--o{ step_runs : "produces"
    workflow_steps ||--o{ step_runs : "executed via"
    step_runs ||--o{ workflow_records : "may write"
    step_runs ||--o{ notifications : "may trigger"

    organizations {
        uuid id PK
        text name
        int quota_allowed
        int quota_used
    }
    org_members {
        uuid id PK
        uuid org_id FK
        uuid user_id "no DB FK - auth.users owned by Hasura Auth"
        text role "owner | editor | viewer"
    }
    workflows {
        uuid id PK
        uuid org_id FK
        text name
        text description
    }
    workflow_steps {
        uuid id PK
        uuid workflow_id FK
        int position
        text type "llm_call | http_request | db_write | notify | conditional_branch | approval_gate"
        jsonb config
    }
    workflow_triggers {
        uuid id PK
        uuid workflow_id FK
        text type "manual | webhook | scheduled | database_event"
        uuid token "unguessable webhook credential"
    }
    workflow_runs {
        uuid id PK
        uuid workflow_id FK
        text status "pending | running | paused | completed | failed"
        text trigger_type
        uuid triggered_by
    }
    step_runs {
        uuid id PK
        uuid workflow_run_id FK
        uuid workflow_step_id FK
        text status "pending | running | paused | completed | failed"
        jsonb input
        jsonb output
        int attempt_count
        uuid approved_by
        timestamptz approved_at
    }
    workflow_records {
        uuid id PK
        uuid org_id FK
        uuid workflow_id FK
        uuid workflow_run_id FK
        uuid step_run_id FK
        jsonb data
    }
    notifications {
        uuid id PK
        uuid org_id FK
        uuid workflow_id FK
        uuid step_run_id FK
        text channel "email"
        text status "pending | sent | failed"
    }
```

`organization_usage` is a Postgres view (not a table) aggregating `quota_allowed`/`quota_used` and run
counts per organization, backing the app's Usage page.

---

## Hasura Metadata & the Two Permission Layers

Metadata lives in `hasura/metadata/` (mirrored at `nhost/metadata/` for the production project) — one YAML
file per table under `databases/default/tables/`, plus `actions.yaml`/`actions.graphql` for the 3 Hasura
Actions. It declares every relationship (e.g. `workflows.organization`, `org_members.user` →
`auth.users`), and per-table `select_permissions`/`insert_permissions`/`update_permissions`/
`delete_permissions` scoped to the single `user` role.

This project enforces authorization in **two distinct layers**, for two different kinds of operation:

### Layer 1 — Organization + role, via Hasura row-level permissions

**Where:** every table's permission YAML under `hasura/metadata/databases/default/tables/`.
**What it protects:** direct GraphQL queries/mutations against tables (`workflows`, `workflow_steps`,
`org_members`, etc.).
**How:** every permission filter traverses relationships back to `org_members` and checks
`user_id = X-Hasura-User-Id`, so a user only ever sees rows belonging to organizations they're a member of.
Mutations additionally check `role` — e.g. `workflow_steps`' insert permission requires `owner` specifically
for `db_write`/`notify` step types, but allows `owner` *or* `editor` for the rest; `workflow_triggers`'
insert/update/delete require `owner` outright. Critically, `workflow_runs` and `step_runs` have **no**
insert/update/delete permission for the `user` role at all — they can only be written by the backend
(via its own direct Postgres connection, which bypasses Hasura permissions entirely), which is what stops
a client from forging its own "completed" run or its own approval by calling a mutation directly.

**Concrete example — denied:** an authenticated user from Organization B queries
`workflows_by_pk(id: <Organization A's workflow id>)`. The permission filter on `workflows` requires the
row's `org_id` to have a `members` entry matching the caller's user ID — Organization B's user has no such
membership row for Organization A, so Hasura's filter excludes the row and the query returns `null`, not
an error and not data.

**Concrete example — allowed:** the same query, run by a member of Organization A, returns the workflow —
the filter's relationship traversal finds their `org_members` row.

### Layer 2 — Sensitive operations, via backend Action handlers

**Where:** `backend/src/actions/*.ts`, using `backend/src/security/authorize.ts`.
**What it protects:** the operations too consequential or stateful to express as a plain permission filter
— starting a workflow run, approving a paused step, and looking up a user by email to add them as a
member.
**How:** `triggerWorkflowRun` re-derives the workflow's organization from the database, checks the caller's
membership + role (`owner` or `editor`), checks the organization's quota, and only then creates a
`workflow_runs` row and begins executing. `approveStep` re-derives the organization from the step run,
requires the caller be an `owner` specifically, and verifies the target step is actually a currently-paused
`approval_gate` before recording the approval and resuming execution. `lookupUserByEmail` requires `owner`
and only exposes minimal fields (id, display name, email, already-member flag).

**Why both layers are needed:** Layer 1 alone can express "who can see/insert this row," but it can't
express "check a live quota counter, then atomically create a run row, then actually execute a multi-step
program with retries and I/O" — that's imperative logic requiring a real transaction and real code, not a
declarative filter. Layer 2 alone would leave every other table (workflows, members, steps, triggers)
unprotected for plain reads/writes — you'd have to reimplement Layer 1's row-scoping logic by hand for
every single query. Using both keeps ordinary CRUD declarative and fast, while keeping the few genuinely
stateful/sensitive operations in real, testable server code.

**Concrete example:** a user in Organization B captures Organization A's `workflow_id` (e.g., from a
Network tab) and calls `triggerWorkflowRun(workflow_id: <A's id>)` directly via GraphiQL, bypassing the UI
entirely. `requireWorkflowOrgRole` in `authorize.ts` looks up `org_members` for that user against
Organization A's ID, finds no row, and throws a 403 — the request never reaches the point of even checking
quota or creating a run.

---

## Approval-Gate Pause / Resume

Implemented in `backend/src/workflow-engine/executor.ts` (`runWorkflowSteps`) and
`backend/src/actions/approveStep.ts`.

1. A workflow starts executing — either via `triggerWorkflowRun` (manual) or `triggerFromWebhook`
   (webhook/scheduled). Both call the same `runWorkflowSteps(client, { fromPosition: 1, ... })`.
2. The executor loads `workflow_steps` ordered by `position` and processes them one at a time, inserting a
   `step_runs` row per step and committing status changes immediately (not inside one long transaction) —
   this is what lets the frontend's GraphQL subscription see progress *while* the run is still going.
3. When the executor reaches a step of type `approval_gate`, it does **not** continue automatically. It
   sets that step's `step_runs.status = 'paused'` and the parent `workflow_runs.status = 'paused'`, then
   **returns** — the executor function itself exits; there is no thread/process left blocked waiting.
4. This paused state is fully persisted in Postgres (`workflow_runs.status`, `step_runs.status`) — nothing
   is held in memory. The frontend's live subscription to `step_runs`/`workflow_runs` picks up the paused
   state and renders an **Approve** button (visible only to organization owners, per the UI's role check).
5. An owner clicks **Approve**, which calls the `approveStep` Hasura Action with the paused step run's ID.
6. `approveStep` re-derives the organization from the step run, requires the caller be an `owner`, and
   verifies the target `step_runs` row is currently `status = 'paused'` and its step type is genuinely
   `approval_gate` — rejecting stale or already-processed approvals. It then records `approved_by` /
   `approved_at`, sets that step's status to `completed`, and sets the run's status back to `running`.
7. `approveStep` then calls `runWorkflowSteps` again — but with `fromPosition = (gate's position) + 1`. The
   executor re-reads the full step list and skips every step before that position; it does not re-execute
   the gate itself or anything earlier. Execution continues from exactly where it left off.
8. If there are no further steps requiring a pause, the run proceeds to completion and increments the
   organization's `quota_used`.

The pause/resume mechanism has no separate "job queue" or scheduler — it's just two calls to the same
stateless function, `runWorkflowSteps`, driven by whichever `fromPosition` matches a fresh run (`1`) versus
a resume (`gate position + 1`), with all state living in `workflow_runs`/`step_runs` between the two calls.

---

## Project Structure

```text
AI-Agent-Workflow-Builder/
├── frontend/                 Next.js App Router application
│   ├── app/                  Pages: login, workflows (+ run screen), usage, members
│   ├── components/           Shared UI (nav, backdrop effects, run-screen pieces)
│   ├── graphql/               Query/mutation/subscription documents
│   └── lib/                  Nhost client, session/org React contexts, GraphQL + live-query helpers
├── backend/                  Express app: Actions, workflow engine, webhooks
│   └── src/
│       ├── actions/           triggerWorkflowRun, approveStep, lookupUserByEmail (Layer 2 authorization)
│       ├── security/           authorize.ts (org membership + role checks), errors.ts
│       ├── workflow-engine/    executor.ts + steps/{llmCall,httpRequest,dbWrite,notify,conditionalBranch}.ts
│       ├── webhooks/           workflow webhook trigger + notify Event Trigger handler
│       └── scripts/seed.ts     creates the demo organizations/users (see Local Demo Accounts)
├── hasura/                   Local-dev Hasura project (source of truth for schema/metadata)
│   ├── migrations/            SQL schema
│   └── metadata/               Relationships, permissions, Actions, Event Trigger
├── nhost/                    Production Nhost Cloud project config (config, migrations, metadata mirror)
├── functions/                 Placeholder for Nhost Functions — currently empty, no functions defined
├── docker-compose.yml         Local Postgres + Hasura + Hasura Auth + Mailhog
├── .env.example                Template for all three required .env files
└── README.md
```

---

## Running the Application

Three terminals, in order, from the repo root (after completing [Getting Started](#getting-started-local-development) steps 1–5):

**Terminal 1 — local backend stack (already started in step 4, listed here for completeness):**
```bash
docker compose up -d
```

**Terminal 2 — backend:**
```bash
npm run dev:backend
```

**Terminal 3 — frontend:**
```bash
npm run dev:frontend
```

Open **http://localhost:3000**.

---

## Testing

No automated test suite exists in this repository — verified against `frontend/package.json`,
`backend/package.json`, and `functions/package.json` (the latter's `"test"` script is npm's default
placeholder that exits with an error, not a real test).

**Available checks:**

```bash
npm run build --workspace backend    # TypeScript compile check (tsc)
npm run lint --workspace frontend    # Next.js/ESLint
```

**Manual verification checklist** (all flows below actually exist in the app):

- [ ] Sign up a new account
- [ ] Log in
- [ ] Confirm "You do not belong to any organization yet" for a brand-new user
- [ ] As an owner, add the new user via Members → Add Member with a role
- [ ] Confirm the new user now sees the organization after refresh/re-login
- [ ] Create a workflow with several step types
- [ ] Manually run a workflow, watch live progress on the run screen
- [ ] Include an `approval_gate` step, confirm the run pauses and shows Approve (owner only)
- [ ] Approve the step, confirm the run resumes from the next step (not from the start)
- [ ] Add a webhook trigger, `curl -X POST` it, confirm a run starts without touching the Run button
- [ ] As a `viewer`, confirm the Run button is disabled/hidden
- [ ] As a member of a different organization, confirm another org's workflow URL returns "not found"

---

## Reviewer Quick Start

1. Clone the repo and `npm install` (see [Getting Started](#getting-started-local-development)).
2. Copy `.env.example` to the three required locations.
3. `docker compose up -d`, then apply migrations + metadata (`hasura migrate apply` / `hasura metadata
   apply`).
4. `npm run dev:backend` and `npm run dev:frontend` in separate terminals.
5. `npm run seed --workspace backend`.
6. Open http://localhost:3000, sign in with `owner-a@example.com` / `Password123!` (see
   [Local Demo Accounts](#local-demo-accounts)).
7. Create a workflow, add an `approval_gate` step, run it, approve it, confirm it resumes correctly.
8. Sign in as `owner-b@example.com` and confirm Organization A's data is completely inaccessible.

Alternatively, skip local setup entirely and use the **[Live Demo](#live-demo-1)**.

---

## API / External Services

| Service | Purpose | Env var | Required? | Behavior if absent |
|---|---|---|---|---|
| Groq (LLM) | Powers the `llm_call` step | `LLM_API_KEY` | No | Returns a disclosed stub response (`{"stub": true, ...}`); rest of the workflow still runs |
| SMTP (Mailhog locally / Gmail in production) | Delivers `notify`-step emails to the org owner | `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` | Yes for the notify feature | Locally, Mailhog requires no credentials and works out of the box; see the [Live Demo](#live-demo-1) note for the production caveat |

No external API key is required to run the current local demo end-to-end (the LLM step degrades to a
disclosed stub, and Mailhog needs no external account).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `docker compose up -d` services don't start / port conflicts | Another process is already using `55432`/`8081`/`4000`/`8025`/`1025`. Change the host-side port in `docker-compose.yml` and the matching `.env` value. |
| `hasura migrate apply` fails with a connection error | Confirm `docker compose ps` shows `postgres` as `healthy` before running migrations — the container needs a moment to initialize. |
| Frontend can't reach Hasura / GraphQL requests fail | Check `NEXT_PUBLIC_NHOST_GRAPHQL_URL` in `frontend/.env.local` — this is read directly (not derived from subdomain/region) by `frontend/lib/graphql.ts` and `frontend/lib/useLiveQuery.ts`. |
| Sign-in works but every page shows no data / "not found" | The JWT is valid but the user has no `org_members` row yet — expected for a brand-new signup; see [User & Organization Onboarding](#user--organization-onboarding). |
| `field 'X' not found` GraphQL errors | Metadata wasn't applied, or is stale — re-run `hasura metadata apply --project hasura`. |
| "You do not belong to any organization yet" never goes away after being added | The frontend caches org membership on load — refresh or re-login after being added as a member. |
| Approval step appears stuck on "Paused" after clicking Approve | Confirm you're logged in as an `owner` of that organization — `approveStep` requires `owner` specifically; `editor`/`viewer` cannot approve. |
| `llm_call` step output has `"stub": true` | `LLM_API_KEY` isn't set — expected behavior, not a bug (see [API / External Services](#api--external-services)). |
| Notify step's email never arrives locally | Check Mailhog's web UI at http://localhost:8025 — locally, emails are caught there, not sent to a real inbox. |
| Notify step's email never arrives in production | Known limitation — see the note under [Live Demo](#live-demo-1). |
| `npm run seed` fails with an auth error | Confirm `AUTH_URL` in `backend/.env` points at a running Hasura Auth instance (`http://localhost:4000` locally) and that the stack is up. |

---

## Security Notes

- `.env`, `.env.local`, and `.secrets` must never be committed — only `.env.example` (no real values) is
  tracked, and the rest are covered by `.gitignore`.
- Production secrets (Hasura admin secret, JWT signing keys, action/event secrets, database passwords,
  SMTP credentials, LLM API keys) must never be pasted into this README or any other tracked file.
- The **local demo credentials** in this README (`Password123!` for the seeded accounts) are for local
  development only and are intentionally simple/shared — never reuse them, or any pattern like them, for a
  real account.
- Hasura's admin secret is never sent to the browser — the frontend only ever authenticates as the single
  `user` role via a signed JWT; admin-level access exists only server-side (CLI/console for
  migrations/metadata, and internally between Hasura/Hasura Auth).
- `workflow_runs`/`step_runs` are writable only by the backend's own direct Postgres connection — there is
  no Hasura mutation permission that lets a client forge a completed run or a self-approval.

---

## Assignment Design Notes

### 1. Schema reasoning

The schema separates three concerns that are easy to conflate: **configuration**, **execution state**, and
**output/side-effect data**.

- `organizations` / `org_members` model multi-tenancy and access control independently of everything else
  — every other table traces back to one of these for its permission scope.
- `workflows` / `workflow_steps` / `workflow_triggers` are pure **configuration** — what a workflow is,
  never how any particular run of it went. They're mutated by users through ordinary CRUD, protected by
  Layer 1 permissions.
- `workflow_runs` / `step_runs` are **execution state** — one row per attempt, append-mostly, written
  exclusively by the backend engine, never by a client mutation. Splitting `step_runs` out from
  `workflow_runs` (rather than one wide row per run) is what lets the run screen subscribe to
  fine-grained, per-step progress instead of one opaque "running" blob, and is what makes resuming from a
  specific step ID meaningful.
- `workflow_records` (arbitrary `db_write` output) and `notifications` (the `notify` step's outbox) are
  **side-effect data** produced by execution, kept separate from `step_runs` itself so that a step's own
  execution record stays a fixed shape regardless of what a particular step type produces.

This separation is also why quota is tracked on `organizations.quota_used` and only incremented on a
successful `workflow_runs` completion, rather than on `workflow_steps` insert — quota should reflect actual
usage, not configuration size.

### 2. Two permission layers

**Layer 1 (Hasura row-level permissions)** protects ordinary reads/writes on configuration tables by
traversing relationships back to `org_members` and filtering on the caller's `X-Hasura-User-Id` for every
query, and additionally checking `role` for sensitive mutations (e.g., only `owner` can insert a `notify`
step). It's declarative, applies uniformly, and is what makes cross-organization ID guessing fail closed
(a query for someone else's row returns nothing, not an error).

**Layer 2 (backend Action handlers)** protects the handful of operations that are stateful or consequential
enough to need real code: starting a run (quota check + row creation + kicking off execution) and approving
a paused step (re-verifying the step is genuinely paused before mutating it). These can't be expressed as a
declarative filter because they involve a sequence of checks and a side effect, not just "is this row
visible."

Both layers are necessary together: Layer 1 alone can't express "check quota then execute," and Layer 2
alone would leave every other table's plain CRUD unprotected unless its logic were duplicated by hand for
every query.

### 3. Approval-gate pause/resume

The executor (`runWorkflowSteps`) is a single stateless function used for both a fresh run and a resume,
distinguished only by a `fromPosition` parameter. Reaching an `approval_gate` step sets
`workflow_runs.status`/`step_runs.status` to `paused` in Postgres and returns — no in-memory job survives
between pause and resume. `approveStep` validates the approval (owner role + step genuinely paused +
correct type), records it, and re-invokes the same executor with `fromPosition = gate position + 1`, so
execution continues from exactly the right point without ever re-running earlier steps or restarting the
workflow.

---

## Recording / Final Task Walkthrough

Suggested flow for a demo recording, matching the actual UI (`frontend/app/(app)/workflows/[id]/`):

1. **Sign in** as an organization owner (demo or your own seeded account).
2. **Create a workflow** and add steps including at least one `approval_gate`.
3. **Click "Run Workflow"** — you're taken to the run screen, which updates live via GraphQL subscription
   as each step completes.
4. **Show the run reaching the approval gate** — the run/step status shows **Paused**, and an **Approve**
   button appears (owner-only).
5. **Click Approve.**
6. **Show the run resuming** from the step *after* the gate (not from the start) and completing.
7. **Show the final result** — e.g., the run's status as `completed`, and, if a `db_write` step was
   included, the resulting `workflow_records` row.

(Optional, if time allows) Also demonstrate: a webhook-triggered run starting without touching the Run
button, and a second organization's account confirming it cannot see the first organization's workflow.
