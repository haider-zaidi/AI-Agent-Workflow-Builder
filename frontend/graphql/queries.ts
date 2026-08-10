export const MY_ORGANIZATIONS = /* GraphQL */ `
  query MyOrganizations($userId: uuid!) {
    organizations {
      id
      name
      quota_allowed
      quota_used
      members(where: { user_id: { _eq: $userId } }) {
        role
      }
    }
  }
`;

export const WORKFLOWS_LIST = /* GraphQL */ `
  query WorkflowsList($orgId: uuid!) {
    workflows(where: { org_id: { _eq: $orgId } }, order_by: { created_at: desc }) {
      id
      name
      description
      created_at
    }
  }
`;

export const WORKFLOW_DETAIL = /* GraphQL */ `
  query WorkflowDetail($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      org_id
      name
      description
      steps(order_by: { position: asc }) {
        id
        position
        type
        config
      }
      triggers {
        id
        type
        config
        token
      }
    }
  }
`;

export const WORKFLOW_RUNS_LIST = /* GraphQL */ `
  query WorkflowRunsList($workflowId: uuid!) {
    workflow_runs(where: { workflow_id: { _eq: $workflowId } }, order_by: { created_at: desc }) {
      id
      status
      trigger_type
      started_at
      completed_at
      error
      created_at
    }
  }
`;

export const ORG_MEMBERS = /* GraphQL */ `
  query OrgMembers($orgId: uuid!) {
    org_members(where: { org_id: { _eq: $orgId } }, order_by: { created_at: asc }) {
      id
      user_id
      role
      user {
        displayName
        email
      }
    }
  }
`;

export const ORG_USAGE = /* GraphQL */ `
  query OrgUsage($orgId: uuid!) {
    organization_usage(where: { org_id: { _eq: $orgId } }) {
      org_id
      quota_allowed
      quota_used
      runs_this_month
      runs_total
    }
  }
`;
