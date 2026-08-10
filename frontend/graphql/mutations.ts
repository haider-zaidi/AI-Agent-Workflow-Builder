export const CREATE_WORKFLOW = /* GraphQL */ `
  mutation CreateWorkflow($orgId: uuid!, $name: String!, $description: String) {
    insert_workflows_one(object: { org_id: $orgId, name: $name, description: $description }) {
      id
    }
  }
`;

export const UPDATE_WORKFLOW = /* GraphQL */ `
  mutation UpdateWorkflow($id: uuid!, $name: String!, $description: String) {
    update_workflows_by_pk(pk_columns: { id: $id }, _set: { name: $name, description: $description }) {
      id
    }
  }
`;

export const DELETE_WORKFLOW = /* GraphQL */ `
  mutation DeleteWorkflow($id: uuid!) {
    delete_workflows_by_pk(id: $id) {
      id
    }
  }
`;

export const ADD_STEP = /* GraphQL */ `
  mutation AddStep($workflowId: uuid!, $position: Int!, $type: String!, $config: jsonb!) {
    insert_workflow_steps_one(
      object: { workflow_id: $workflowId, position: $position, type: $type, config: $config }
    ) {
      id
    }
  }
`;

export const UPDATE_STEP = /* GraphQL */ `
  mutation UpdateStep($id: uuid!, $position: Int!, $config: jsonb!) {
    update_workflow_steps_by_pk(pk_columns: { id: $id }, _set: { position: $position, config: $config }) {
      id
    }
  }
`;

export const DELETE_STEP = /* GraphQL */ `
  mutation DeleteStep($id: uuid!) {
    delete_workflow_steps_by_pk(id: $id) {
      id
    }
  }
`;

export const ADD_TRIGGER = /* GraphQL */ `
  mutation AddTrigger($workflowId: uuid!, $type: String!, $config: jsonb!) {
    insert_workflow_triggers_one(object: { workflow_id: $workflowId, type: $type, config: $config }) {
      id
      type
      token
    }
  }
`;

export const DELETE_TRIGGER = /* GraphQL */ `
  mutation DeleteTrigger($id: uuid!) {
    delete_workflow_triggers_by_pk(id: $id) {
      id
    }
  }
`;

export const ADD_MEMBER = /* GraphQL */ `
  mutation AddMember($orgId: uuid!, $userId: uuid!, $role: String!) {
    insert_org_members_one(object: { org_id: $orgId, user_id: $userId, role: $role }) {
      id
    }
  }
`;

export const UPDATE_MEMBER_ROLE = /* GraphQL */ `
  mutation UpdateMemberRole($id: uuid!, $role: String!) {
    update_org_members_by_pk(pk_columns: { id: $id }, _set: { role: $role }) {
      id
    }
  }
`;

export const DELETE_MEMBER = /* GraphQL */ `
  mutation DeleteMember($id: uuid!) {
    delete_org_members_by_pk(id: $id) {
      id
    }
  }
`;

export const TRIGGER_WORKFLOW_RUN = /* GraphQL */ `
  mutation TriggerWorkflowRun($workflowId: uuid!) {
    triggerWorkflowRun(input: { workflow_id: $workflowId }) {
      workflow_run_id
      status
    }
  }
`;

export const LOOKUP_USER_BY_EMAIL = /* GraphQL */ `
  mutation LookupUserByEmail($orgId: uuid!, $email: String!) {
    lookupUserByEmail(input: { org_id: $orgId, email: $email }) {
      user_id
      display_name
      email
      already_member
    }
  }
`;

export const APPROVE_STEP = /* GraphQL */ `
  mutation ApproveStep($stepRunId: uuid!) {
    approveStep(input: { step_run_id: $stepRunId }) {
      step_run_id
      status
      workflow_run_status
    }
  }
`;
