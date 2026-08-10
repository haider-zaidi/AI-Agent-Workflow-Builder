# AI Agent Workflow Builder

## Full-Stack Assignment Specification

This document is the complete specification for the project that needs to be built.

The goal is to build a simple **AI Agent Workflow Builder**, similar in concept to a small, purpose-built version of n8n, where users can create workflows by connecting different types of steps and then execute those workflows.

The application must support organizations, users with different roles, workflow creation, workflow execution, AI calls, external API calls, conditional logic, approval gates, real-time execution updates, quotas, multiple trigger types, and strict organization-level security.

The application must be functional end-to-end. A working and secure implementation is more important than a highly polished or complicated UI.

---

# 1. Project Goal

Build a web application where a user can:

1. Log in.
2. Belong to an organization.
3. Create workflows inside that organization.
4. Add different types of steps to a workflow.
5. Reorder workflow steps.
6. Add triggers to workflows.
7. Run a workflow manually.
8. Start a workflow through a webhook.
9. Execute AI and external API steps.
10. Make decisions using conditional branches.
11. Pause execution at an approval gate.
12. Allow an authorized user to approve the workflow.
13. Resume the workflow after approval.
14. See every step's status live without refreshing the page.
15. See organization usage/quota.
16. Prevent users from accessing data belonging to another organization.

The most important requirement is **security and end-to-end functionality**.

---

# 2. Technology Stack

The required stack is:

## Frontend

* Next.js
* React
* GraphQL client
* Nhost authentication
* GraphQL subscriptions for real-time updates

## Backend / Infrastructure

* Nhost
* Hasura GraphQL Engine
* PostgreSQL
* Hasura Actions
* Hasura Event Triggers
* Scheduled function / cron mechanism

## AI

Use a real LLM API with a free tier if possible.

Possible providers:

* Groq
* Google Gemini
* OpenRouter

If a real API cannot be used, a clearly disclosed stub with an artificial delay may be used, but a real LLM API is preferred.

## Backend language

Node.js / TypeScript is preferred for the workflow execution logic and Hasura Actions.

---

# 3. High-Level Architecture

The application should conceptually work like this:

```text
                    USER
                     |
                     v
              +--------------+
              |   Next.js    |
              |   Frontend   |
              +------+-------+
                     |
                  GraphQL
                     |
                     v
              +--------------+
              |    Hasura    |
              | GraphQL API  |
              +------+-------+
                     |
          +----------+----------+
          |                     |
          v                     v
    PostgreSQL            Hasura Actions
                                |
                         +------+------+
                         |             |
                         v             v
                        LLM        External APIs
```

Nhost provides the main backend infrastructure including authentication, PostgreSQL, Hasura and functions.

---

# 4. Organizations

The application is multi-tenant.

There can be multiple organizations.

For example:

```text
Organization A
Organization B
```

Users belong to organizations through the `org_members` table.

A user must only be able to access data belonging to organizations they are actually a member of.

---

# 5. User Roles

Each organization member has one of three roles:

```text
owner
editor
viewer
```

## Owner

Owner has full control.

The owner can:

* View workflows
* Create workflows
* Edit workflows
* Delete workflows
* Add/edit/remove workflow steps
* Add/edit/remove triggers
* Manage organization members
* Trigger workflows
* Approve approval-gate steps
* Add sensitive steps

Sensitive operations include:

* `db_write`
* `notify`
* webhook triggers

---

## Editor

Editor can:

* View workflows
* Create workflows
* Edit workflows
* Add/edit normal workflow steps
* Trigger workflows
* Participate in workflow execution

Editor cannot:

* Manage organization members
* Perform owner-only organization operations
* Add owner-only sensitive workflow steps such as:

  * `db_write`
  * `notify`
  * webhook trigger

---

## Viewer

Viewer is read-only.

Viewer can:

* View organization workflows
* View workflow steps
* View workflow runs/status

Viewer cannot:

* Create workflows
* Edit workflows
* Delete workflows
* Add steps
* Add triggers
* Trigger workflows
* Approve workflow steps
* Manage members

The Run button should not be shown to viewers in the frontend, but hiding the button is NOT a security mechanism. Backend/Hasura authorization must also reject unauthorized requests.

---

# 6. Cross-Organization Security

This is one of the most important requirements.

Role checking alone is NOT enough.

For every relevant operation, the application must verify both:

1. The user belongs to the organization.
2. The user's role allows the requested operation.

For example:

```text
Organization A

Haider = owner
Ali = editor
Ahmed = viewer


Organization B

Rahul = owner
```

Haider must never be able to access Organization B's workflows.

Even if Haider manually knows or guesses a workflow ID belonging to Organization B, access must still be denied.

Example:

```text
Haider
    |
    | workflow_id = ID belonging to Org B
    v
Backend
    |
    v
ACCESS DENIED
```

This must work for:

* Reading workflows
* Reading workflow steps
* Reading runs
* Triggering workflows
* Approving steps
* Editing workflows
* Creating sensitive steps
* Any other organization-specific operation

There must be no ID-based access vulnerability.

---

# 7. Two Permission Layers

The project must implement two separate permission layers.

## Layer 1: Organization + Role Authorization

This determines:

> "Can this user access or perform this operation within this organization?"

The system must verify the user's membership using `org_members`.

Conceptually:

```text
Current User
     |
     v
org_members
     |
     v
Does this user belong to this workflow's organization?
     |
     +---- NO ---> DENY
     |
     +---- YES
             |
             v
          Check role
```

Hasura permissions should enforce organization-level data isolation.

---

## Layer 2: Step-Level Authorization

This determines:

> "Even if the user belongs to this organization, are they specifically allowed to perform this operation?"

Examples:

```text
Editor + LLM step       = allowed

Editor + HTTP step      = allowed

Editor + Conditional    = allowed

Editor + DB Write       = denied

Editor + Notify         = denied

Editor + Webhook        = denied

Owner + DB Write        = allowed

Owner + Notify          = allowed

Owner + Webhook         = allowed
```

Sensitive step restrictions must be enforced in backend business logic / Action handlers and not only by hiding frontend UI elements.

---

# 8. Database Schema

The minimum required data model is:

```text
organizations
org_members
workflows
workflow_steps
workflow_triggers
workflow_runs
step_runs
```

---

# 9. organizations Table

Represents an organization/company/team.

Suggested fields:

```text
id
name
quota_allowed
quota_used
created_at
updated_at
```

Example:

```text
Organization A

quota_allowed = 100
quota_used = 25
```

The quota should be checked before starting a workflow.

---

# 10. org_members Table

Connects users to organizations.

Suggested fields:

```text
id
org_id
user_id
role
created_at
```

Role must be one of:

```text
owner
editor
viewer
```

Relationship:

```text
Organization
    |
    +---- Members
```

---

# 11. workflows Table

Represents a workflow belonging to an organization.

Suggested fields:

```text
id
org_id
name
description
created_at
updated_at
```

Relationship:

```text
Organization
    |
    +---- Workflows
```

A workflow must always belong to exactly one organization.

---

# 12. workflow_steps Table

Stores the steps/nodes of a workflow.

Suggested fields:

```text
id
workflow_id
position
type
config
created_at
updated_at
```

`config` can be PostgreSQL JSONB.

Supported step types:

```text
llm_call
http_request
db_write
notify
conditional_branch
approval_gate
```

The `position` field determines execution order.

Example:

```text
1 -> llm_call
2 -> http_request
3 -> conditional_branch
4 -> approval_gate
5 -> db_write
```

---

# 13. workflow_triggers Table

Stores how a workflow can be started.

Suggested fields:

```text
id
workflow_id
type
config
created_at
```

Supported trigger types:

```text
manual
webhook
scheduled
database_event
```

At minimum, the application must have:

* Manual trigger
* One working non-manual trigger

The final demonstration should use:

* Manual
* Webhook

---

# 14. workflow_runs Table

Every workflow execution creates one workflow run.

Suggested fields:

```text
id
workflow_id
status
started_at
completed_at
error
created_at
```

Supported statuses:

```text
pending
running
paused
completed
failed
```

The `paused` status is mandatory because of the approval gate.

Example:

```text
Workflow Run #123

status = paused
```

---

# 15. step_runs Table

Stores the execution status of every individual workflow step.

Suggested fields:

```text
id
workflow_run_id
workflow_step_id
status
input
output
error
attempt_count
approved_by
approved_at
started_at
completed_at
created_at
```

This table is also the main source for real-time workflow progress.

Example:

```text
LLM             completed
HTTP            completed
Conditional     completed
Approval Gate   paused
DB Write        pending
```

---

# 16. Database Relationships

The relationships must be:

```text
organizations
      |
      +---- org_members
      |
      +---- workflows
               |
               +---- workflow_steps
               |
               +---- workflow_triggers
               |
               +---- workflow_runs
                         |
                         +---- step_runs
```

Hasura relationships must be configured for these relationships.

---

# 17. Workflow Step Types

The application must support at least the following six step types.

---

## 17.1 llm_call

This step sends a prompt to a real LLM API and stores the result.

Example:

```text
Input:
"Analyze this customer complaint and classify it as positive or negative."

LLM:
"negative"
```

The LLM response must be stored in the corresponding `step_run.output`.

The implementation should use a real LLM API whenever possible.

---

## 17.2 http_request

This step makes a request to an external API.

It should support at least:

```text
GET
POST
```

and should be configurable through JSON.

Example:

```json
{
  "method": "GET",
  "url": "https://api.example.com/data"
}
```

The response should be stored in the step run.

The step must support retry on failure.

---

## 17.3 db_write

This step saves workflow output into application-owned PostgreSQL tables.

Example:

```text
Customer:
Haider

Analysis:
Negative
```

The data can then be saved into a suitable table.

Only an organization owner may add this step.

---

## 17.4 notify

This step sends a notification.

It can be implemented using:

* Slack
* Email

The assignment specifies that notification should be implemented as an Event Trigger.

Only an organization owner may add this step.

---

## 17.5 conditional_branch

This is an IF/ELSE step.

It should evaluate the output of a previous step.

Example:

```text
LLM output:
"negative"

Condition:

IF output contains "negative"
    |
    +---- TRUE ---> Approval Gate
    |
    +---- FALSE --> Continue normally
```

The final demonstration must show a conditional branch whose behavior changes based on the LLM output.

---

## 17.6 approval_gate

This step pauses workflow execution.

Example:

```text
LLM              completed
HTTP             completed
Conditional      completed
Approval Gate    PAUSED
DB Write         pending
```

When the workflow reaches an approval gate:

```text
workflow_run.status = paused

step_run.status = paused
```

Execution must stop at this point.

The workflow must NOT be marked as failed.

It must be resumable.

---

# 18. Approval Flow

A separate Hasura Action must be implemented:

```text
approveStep
```

The action should receive the relevant `step_run_id`.

The backend must verify:

1. The step run exists.
2. It belongs to a valid workflow run.
3. The workflow belongs to an organization.
4. The current user belongs to that organization.
5. The user's role is authorized to approve.
6. The step is actually an `approval_gate`.
7. The workflow is currently paused at that approval gate.

If authorization succeeds:

```text
approved_by = current_user_id
approved_at = current_timestamp
step_run.status = completed
```

Then the workflow must resume from the next step.

The workflow must NOT start from the beginning again.

Correct behavior:

```text
LLM
  ↓
HTTP
  ↓
Conditional
  ↓
Approval Gate
  ↓
PAUSED
  ↓
Approve
  ↓
Resume from next step
  ↓
DB Write
  ↓
Completed
```

---

# 19. Main Hasura Action

The most important backend operation is:

```text
triggerWorkflowRun(workflow_id)
```

This is the main workflow execution entry point.

The frontend Run button should call this Action.

The Action must perform the following sequence.

---

## Step 1: Identify Current User

Get the authenticated user's ID from the request/auth context.

---

## Step 2: Find Workflow

Find the workflow using the supplied `workflow_id`.

---

## Step 3: Find Organization

Determine which organization owns the workflow.

---

## Step 4: Check Organization Membership

Check `org_members`.

The current user must belong to the workflow's organization.

If not:

```text
DENIED
```

---

## Step 5: Check Role

The user must be:

```text
owner
OR
editor
```

Viewer must not be allowed to trigger a workflow.

---

## Step 6: Check Quota

Before starting the workflow, check:

```text
quota_used < quota_allowed
```

If quota is exhausted:

```text
Workflow must not start.
```

Return an appropriate error.

---

## Step 7: Create workflow_run

Create:

```text
workflow_run.status = running
```

---

## Step 8: Execute Steps in Order

Read workflow steps ordered by `position`.

Execute them one by one.

For each step:

1. Create `step_run`.
2. Set status to `running`.
3. Execute the step.
4. Store input/output/error.
5. Update status.
6. Continue to the next step.

---

# 20. Step Execution

The workflow executor should conceptually behave like:

```text
for each step:

    create step_run

    set step_run = running

    execute step

    if successful:
        set step_run = completed
        continue

    if failed:
        retry if retryable
        otherwise fail workflow
```

---

# 21. Retry Requirement

At minimum, `llm_call` and `http_request` must retry once when an external request fails.

Example:

```text
Attempt 1
    |
    +---- FAILED
             |
             v
Attempt 2
    |
    +---- SUCCESS
```

The `attempt_count` must be stored in `step_runs`.

Example:

```text
attempt_count = 2
```

If the retry also fails:

```text
step_run.status = failed
workflow_run.status = failed
```

The error should be stored.

---

# 22. Workflow Status

The workflow run should move through statuses such as:

```text
pending
   ↓
running
   ↓
completed
```

or:

```text
pending
   ↓
running
   ↓
paused
   ↓
running
   ↓
completed
```

or:

```text
pending
   ↓
running
   ↓
failed
```

---

# 23. Manual Trigger

The frontend must have a Run button.

Example:

```text
[ RUN WORKFLOW ]
```

Clicking it should call:

```text
triggerWorkflowRun(workflow_id)
```

Only owners and editors should be allowed to perform this operation.

Viewers must not be able to trigger workflows.

---

# 24. Webhook Trigger

At least one non-manual trigger must actually work.

Implement a webhook trigger.

External systems should be able to send a request to a webhook endpoint, which starts the workflow.

Conceptually:

```text
External Application
        |
        | HTTP POST
        v
Webhook / Hasura Action
        |
        v
Workflow Run
        |
        v
Workflow starts
```

This must be demonstrated during the final walkthrough.

---

# 25. Scheduled Trigger

A scheduled trigger is optional for the final minimum implementation but the architecture should allow it.

Example:

```text
Every day at 10:00 AM
        |
        v
Workflow starts automatically
```

This can be implemented using a scheduled function/cron mechanism.

---

# 26. Database Event Trigger

A database event trigger is also an available trigger type.

Example:

```text
New row inserted
       |
       v
Hasura Event Trigger
       |
       v
Start workflow
```

This can be implemented if time permits.

The minimum final scenario requires a manual trigger plus one working non-manual trigger.

---

# 27. Real-Time GraphQL Subscription

The frontend must display live step-by-step progress.

Use a GraphQL subscription on `step_runs`.

The subscription should be filtered by:

```text
workflow_run_id
```

Conceptually:

```graphql
subscription StepRunUpdates($runId: uuid!) {
  step_runs(
    where: {
      workflow_run_id: {
        _eq: $runId
      }
    }
  ) {
    id
    status
    input
    output
    error
    attempt_count
    approved_by
    approved_at
  }
}
```

The exact query can be adapted to the final schema.

The frontend must update automatically when step statuses change.

No manual page refresh should be required.

---

# 28. Frontend Requirements

The frontend does not need to look exactly like n8n.

A simple, clean and functional UI is preferred over spending too much time on visual design.

The frontend should contain at least:

## Authentication

* Login
* Logout
* User session

---

## Organization Context

Display the current organization.

Example:

```text
Organization: Org A
```

The current user's role should be known.

---

## Workflow List

Example:

```text
My Workflows

Customer Complaint
Email Generator
Support Workflow

[Create Workflow]
```

---

## Workflow Builder

Allow the user to:

* Create a workflow
* Give it a name
* Add steps
* Select step type
* Configure a step
* Reorder steps
* Remove steps
* Add triggers
* Save workflow

A simple vertical step builder is acceptable.

A complex drag-and-drop canvas is not required unless time permits.

Example:

```text
LLM Call
   ↓
HTTP Request
   ↓
Conditional Branch
   ↓
Approval Gate
   ↓
DB Write
```

---

# 29. Run Screen

After starting a workflow, show live progress.

Example:

```text
Customer Complaint Workflow

LLM Call
    Completed

HTTP Request
    Completed

Conditional Branch
    Negative → Approval path

Approval Gate
    Waiting for approval

    [Approve]

DB Write
    Waiting
```

After approval:

```text
Approval Gate
    Approved

DB Write
    Completed

Workflow
    Completed
```

---

# 30. Approval UI

When an approval gate is paused, show a clear approval interface.

Example:

```text
Approval Required

This workflow is waiting for approval.

[ APPROVE ]
```

Only an authorized user should be able to approve.

Viewers must not be able to approve.

---

# 31. Usage / Quota UI

Show the organization's usage.

Example:

```text
Usage

25 / 100 workflow runs

25%
```

The exact design is flexible.

---

# 32. Hasura Aggregation

The application must implement at least one aggregation.

The simplest option is organization-level usage.

For example:

```text
Organization A

Workflow runs this month = 25
```

This can be implemented using a PostgreSQL view or another appropriate Hasura-supported aggregation approach.

---

# 33. Final End-to-End Scenario

The final application must demonstrate this exact scenario.

This is the most important part of the assignment.

---

## Step 1: Create Two Organizations

Create:

```text
Organization A
Organization B
```

Example members:

```text
Organization A
----------------
User A = owner
User B = editor
User C = viewer

Organization B
----------------
User D = owner
```

---

## Step 2: Create Workflow in Organization A

Create a workflow containing at least:

```text
LLM Call
HTTP Request
Conditional Branch
Approval Gate
```

Optionally also include:

```text
DB Write
Notify
```

Recommended final workflow:

```text
LLM Call
    ↓
HTTP Request
    ↓
Conditional Branch
    ↓
Approval Gate
    ↓
DB Write
```

---

## Step 3: LLM Must Influence Conditional Branch

The LLM should produce an output that affects the conditional branch.

Example:

```text
Input:
"The customer says delivery was extremely late."

LLM:
"negative"
```

Conditional:

```text
IF LLM output == negative

    YES
     ↓
Approval Gate

ELSE

    Other path
```

This proves that workflow steps can pass information between each other.

---

## Step 4: Start Manually

Log in as an authorized Organization A user.

Click:

```text
Run Workflow
```

The workflow should start.

---

## Step 5: Show Live Progress

The UI should update without refresh:

```text
LLM              Completed
HTTP             Completed
Conditional      Completed
Approval Gate    Paused
DB Write         Pending
```

---

## Step 6: Approve

As an authorized Organization A user:

```text
Click Approve
```

Then:

```text
Approval Gate    Completed
DB Write         Running
DB Write         Completed
Workflow         Completed
```

---

## Step 7: Start Using Webhook

Use the webhook endpoint.

For example:

```text
POST <workflow-webhook-url>
```

The workflow should start without clicking the Run button.

This proves that a second trigger actually works.

---

## Step 8: Test Organization Isolation

Now log in as a user belonging only to Organization B.

Try to:

### View Organization A workflow

```text
DENIED
```

### Access Organization A workflow using its ID directly

```text
DENIED
```

### Trigger Organization A workflow

```text
DENIED
```

### Approve Organization A workflow

```text
DENIED
```

This must work even when the Organization A workflow ID is manually supplied.

This proves that cross-organization isolation is actually secure.

---

# 34. Important Security Rule

Do NOT rely only on frontend restrictions.

For example, this is NOT enough:

```javascript
if (role !== "owner") {
   hideDbWriteButton();
}
```

A malicious user could still manually send a request.

The backend must enforce authorization.

Correct:

```text
Frontend
   |
   v
Backend / Hasura Action
   |
   +--> Is user authenticated?
   |
   +--> Is user a member of this organization?
   |
   +--> What is the user's role?
   |
   +--> Is this operation allowed for that role?
   |
   +--> Is this a sensitive step?
   |
   v
Allow / Deny
```

---

# 35. Action Authorization

The main Actions should perform business-level security checks.

Required Actions:

```text
triggerWorkflowRun
approveStep
```

Additional Actions/endpoints may be created where appropriate.

---

# 36. triggerWorkflowRun Authorization

Before executing:

```text
1. Authenticate user.
2. Find workflow.
3. Find workflow organization.
4. Check org_members.
5. Verify user belongs to the organization.
6. Verify role is owner or editor.
7. Check quota.
8. Create workflow run.
9. Execute workflow.
```

If any security check fails, do not execute the workflow.

---

# 37. approveStep Authorization

Before approving:

```text
1. Authenticate user.
2. Find step run.
3. Find workflow run.
4. Find workflow.
5. Find organization.
6. Check org_members.
7. Verify user belongs to organization.
8. Verify user has an allowed role.
9. Verify step is an approval_gate.
10. Verify workflow is paused.
11. Record approval.
12. Resume workflow.
```

---

# 38. Important: Approval Must Resume

Do not restart the workflow from the beginning.

Wrong:

```text
Approve
   ↓
Run entire workflow again
```

Correct:

```text
LLM
 ↓
HTTP
 ↓
Conditional
 ↓
Approval
 ↓
PAUSED
 ↓
APPROVE
 ↓
Resume from next step
 ↓
DB Write
 ↓
Completed
```

---

# 39. Error Handling

External calls can fail.

The system should:

* Store errors.
* Update step status.
* Retry LLM/HTTP calls at least once.
* Mark workflow failed if retries are exhausted.
* Keep useful error information in `step_runs.error`.

Example:

```text
HTTP Request

Attempt 1 → Failed
Attempt 2 → Failed

Step = failed
Workflow = failed
```

---

# 40. Quota Handling

Before starting a workflow:

```text
quota_used < quota_allowed
```

If:

```text
quota_used >= quota_allowed
```

do not start the workflow.

After successful workflow completion, increment usage.

Example:

```text
Before:
25 / 100

Workflow completed

After:
26 / 100
```

The implementation should define quota consistently, preferably as workflow runs per organization per period.

---

# 41. Code Quality Requirements

The project should prioritize:

* Clear code
* Simple architecture
* Reusable workflow execution logic
* Proper error handling
* Type safety where possible
* Environment variables for secrets
* No hardcoded API keys
* No sensitive credentials committed to Git
* Clear separation between frontend and backend
* Clear authorization logic

Do not over-engineer the project.

A simple working implementation is better than a complex incomplete implementation.

---

# 42. Environment Variables

Never commit real API keys.

Provide an `.env.example`.

Example:

```env
NHOST_BACKEND_URL=
NHOST_GRAPHQL_URL=
NHOST_AUTH_URL=

LLM_API_KEY=

SLACK_WEBHOOK_URL=
```

Only include variables that are actually required by the implementation.

---

# 43. Suggested Project Structure

A possible structure is:

```text
ai-agent-workflow-builder/
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── graphql/
│   ├── hooks/
│   ├── lib/
│   └── ...
│
├── backend/
│   ├── actions/
│   │   ├── triggerWorkflowRun/
│   │   └── approveStep/
│   │
│   ├── workflow-engine/
│   │   ├── executor.ts
│   │   ├── llm.ts
│   │   ├── http.ts
│   │   ├── conditional.ts
│   │   ├── approval.ts
│   │   └── db.ts
│   │
│   └── ...
│
├── hasura/
│   ├── migrations/
│   └── metadata/
│
├── README.md
├── .env.example
└── package.json
```

The exact structure can be changed if a better structure is appropriate.

---

# 44. Hasura Metadata and Migrations

The repository must contain:

* PostgreSQL migrations
* Hasura metadata
* Table relationships
* Permissions
* Actions configuration where applicable
* Event Trigger configuration where applicable

The project should be reproducible from the repository as much as possible.

---

# 45. README Requirements

The final README should explain:

1. What the project does.
2. Architecture.
3. Technologies used.
4. Local setup.
5. Nhost setup.
6. Environment variables.
7. Database migrations.
8. Hasura metadata.
9. How to configure the LLM API.
10. How to run the frontend.
11. How to run backend functions/actions.
12. How to configure the webhook.
13. How authentication works.
14. Organization roles.
15. Permission model.
16. How workflow execution works.
17. How approval pause/resume works.
18. How to test cross-organization security.
19. How to run the final demonstration.

---

# 46. One-Page Technical Write-Up

A separate short write-up should explain:

## Schema Reasoning

Explain:

```text
Organization
    ↓
Members
    ↓
Workflows
    ↓
Steps / Triggers
    ↓
Runs
    ↓
Step Runs
```

Explain why each entity exists.

## Permission Model

Explain the two layers:

### Layer 1

Organization membership + role enforced through Hasura permissions.

### Layer 2

Sensitive workflow operations and approval authorization enforced through backend Action handlers.

## Approval Gate

Explain:

```text
Workflow running
      ↓
Approval gate reached
      ↓
Workflow paused
      ↓
Authorized user approves
      ↓
Workflow resumes
      ↓
Next step executes
```

---

# 47. Deployment

The final project must have a live hosted frontend.

Preferred:

```text
Next.js → Vercel
```

Backend/infrastructure:

```text
Nhost
Hasura
PostgreSQL
Functions / Actions
```

The final submission must include:

```text
GitHub Repository URL

Hosted Next.js Application URL
```

The hosted application must actually work.

---

# 48. Demo Recording

A short recording is strongly recommended.

The recording should show the complete final scenario.

Recommended sequence:

```text
1. Login as Organization A user.

2. Show Organization A workflow.

3. Show workflow steps.

4. Run workflow manually.

5. Show live step updates.

6. Workflow reaches approval gate.

7. Show paused state.

8. Approve the workflow.

9. Show workflow resuming and completing.

10. Trigger the same workflow through webhook.

11. Show that it starts without clicking Run.

12. Login as Organization B user.

13. Try to access Organization A workflow.

14. Try direct workflow ID access.

15. Try triggering Organization A workflow.

16. Try approving Organization A workflow.

17. Show that all unauthorized attempts are denied.
```

---

# 49. Final Acceptance Criteria

The project should be considered complete only when all of the following work:

### Organizations

* [ ] Two separate organizations exist.
* [ ] Each organization has separate users.
* [ ] Users have owner/editor/viewer roles.

### Workflow

* [ ] Workflow can be created.
* [ ] Workflow belongs to an organization.
* [ ] Steps can be added.
* [ ] Steps can be reordered.
* [ ] Triggers can be attached.

### Step Types

* [ ] `llm_call`
* [ ] `http_request`
* [ ] `db_write`
* [ ] `notify`
* [ ] `conditional_branch`
* [ ] `approval_gate`

### Execution

* [ ] Workflow can be manually started.
* [ ] Workflow can be started by webhook.
* [ ] LLM makes a real API call.
* [ ] HTTP step makes an external API call.
* [ ] Conditional branch works.
* [ ] LLM output can affect the conditional branch.
* [ ] Retry works at least once for LLM/HTTP failures.
* [ ] Workflow can pause.
* [ ] Workflow can resume.
* [ ] Workflow can complete.
* [ ] Workflow can fail correctly.

### Approval

* [ ] Approval gate pauses workflow.
* [ ] Paused state is stored.
* [ ] Approver authorization is checked in backend.
* [ ] Approval records `approved_by`.
* [ ] Approval records `approved_at`.
* [ ] Workflow resumes from the next step.

### Real-Time

* [ ] Step status is visible live.
* [ ] GraphQL subscription is used.
* [ ] No page refresh is required.
* [ ] Paused state is visible live.

### Security

* [ ] Users can only access their organization's data.
* [ ] Direct ID guessing cannot bypass organization isolation.
* [ ] Viewers cannot trigger workflows.
* [ ] Viewers cannot approve.
* [ ] Editors cannot manage members.
* [ ] Editors cannot add owner-only sensitive steps.
* [ ] Only owners can add `db_write`.
* [ ] Only owners can add `notify`.
* [ ] Only owners can add webhook triggers.
* [ ] Action handlers enforce sensitive business rules.
* [ ] Frontend-only security is not relied upon.

### Quota

* [ ] Organization has a quota.
* [ ] Usage is displayed.
* [ ] Quota is checked before workflow execution.
* [ ] Workflow cannot start when quota is exhausted.
* [ ] Usage increments after successful completion.
* [ ] Organization-level usage aggregation exists.

### Deployment

* [ ] Application is deployed.
* [ ] Hosted URL works.
* [ ] GitHub repository exists.
* [ ] README exists.
* [ ] Hasura migrations exist.
* [ ] Hasura metadata exists.
* [ ] Environment variable example exists.
* [ ] Demo recording is available.

---

# 50. Important Development Priority

Do not spend most of the time making the UI beautiful.

The priority should be:

```text
1. Database schema
2. Authentication
3. Organization isolation
4. Hasura permissions
5. Workflow execution
6. Actions
7. Approval pause/resume
8. Real-time subscriptions
9. Manual + webhook triggers
10. Retry and quota
11. Frontend usability
12. UI polish
```

A simple UI with a fully working backend is much better than a beautiful UI with broken security or workflow execution.

---

# 51. Simplified Mental Model

The entire project can be understood as:

```text
USER
  |
  v
LOGIN
  |
  v
ORGANIZATION
  |
  v
CREATE WORKFLOW
  |
  v
ADD STEPS
  |
  +---- AI
  |
  +---- HTTP
  |
  +---- CONDITION
  |
  +---- APPROVAL
  |
  +---- DB
  |
  v
RUN
  |
  v
WORKFLOW ENGINE
  |
  +---- Step 1
  |
  +---- Step 2
  |
  +---- Step 3
  |
  +---- Approval
           |
           v
        PAUSED
           |
           v
        APPROVE
           |
           v
        RESUME
           |
           v
        COMPLETE
```

At the same time:

```text
User
  |
  v
Is user in this organization?
  |
  +---- NO ---> DENY
  |
  +---- YES
          |
          v
       Check role
          |
          v
       Check operation
          |
          +---- Not allowed ---> DENY
          |
          +---- Allowed -------> CONTINUE
```

---

# 52. Core Principle

The application should not be treated as just a workflow UI.

The main purpose of the assignment is to demonstrate:

```text
Multi-tenant application
+
Secure authorization
+
Workflow execution
+
Real external integrations
+
Pause/resume execution
+
Real-time updates
```

The final live scenario must prove that all of these components work together.

The most important property is:

> A user from Organization B must never be able to see, trigger, modify, or approve anything belonging to Organization A, even when directly providing an Organization A ID.

The second most important property is:

> The workflow must actually execute end-to-end, including real LLM/API calls, conditional logic, approval pause/resume, live subscriptions, and a non-manual trigger.

---

# 53. Definition of Done

The project is DONE when a reviewer can open the deployed application and observe:

```text
Organization A
      |
      v
Create workflow
      |
      v
LLM
      ↓
HTTP
      ↓
Conditional
      ↓
Approval
      ↓
DB
```

Then:

```text
Run manually
      ↓
Live updates
      ↓
Pause
      ↓
Approve
      ↓
Resume
      ↓
Complete
```

Then:

```text
Webhook
   ↓
Workflow starts automatically
```

And finally:

```text
Organization B user
       ↓
Try Org A workflow
       ↓
ACCESS DENIED
```

If all of this works reliably, the core assignment requirements are satisfied.
