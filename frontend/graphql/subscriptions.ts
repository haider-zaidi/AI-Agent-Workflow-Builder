export const STEP_RUNS_SUBSCRIPTION = /* GraphQL */ `
  subscription StepRunUpdates($runId: uuid!) {
    step_runs(where: { workflow_run_id: { _eq: $runId } }, order_by: { workflow_step: { position: asc } }) {
      id
      status
      input
      output
      error
      attempt_count
      approved_by
      approved_at
      started_at
      completed_at
      workflow_step {
        id
        position
        type
      }
    }
  }
`;

export const WORKFLOW_RUN_SUBSCRIPTION = /* GraphQL */ `
  subscription WorkflowRunStatus($runId: uuid!) {
    workflow_runs_by_pk(id: $runId) {
      id
      status
      error
      started_at
      completed_at
    }
  }
`;

export const WORKFLOWS_LIST_SUBSCRIPTION = /* GraphQL */ `
  subscription WorkflowsListLive($orgId: uuid!) {
    workflows(where: { org_id: { _eq: $orgId } }, order_by: { created_at: desc }) {
      id
      name
      description
      created_at
    }
  }
`;
