"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLiveQuery } from "@/lib/useLiveQuery";
import { STEP_RUNS_SUBSCRIPTION, WORKFLOW_RUN_SUBSCRIPTION } from "@/graphql/subscriptions";
import { WORKFLOW_DETAIL } from "@/graphql/queries";
import { gqlRequest } from "@/lib/graphql";
import { APPROVE_STEP } from "@/graphql/mutations";
import { useOrg } from "@/lib/org";
import type { RunStatus, StepRun, WorkflowStepDef } from "@/lib/types";
import { deriveStepDisplayStatus } from "@/lib/runStatus";
import { RunStatusHero } from "@/components/run/RunStatusHero";
import { StepCard } from "@/components/run/StepCard";

interface WorkflowRun {
  id: string;
  status: RunStatus;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export default function RunScreenPage() {
  const params = useParams<{ id: string; runId: string }>();
  const { role } = useOrg();
  const [approving, setApproving] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<{ stepRunId: string; message: string } | null>(null);

  // The step *definitions* (position/type/config) don't change while a run
  // is in flight, so a one-time fetch is enough - reusing the existing
  // WORKFLOW_DETAIL query. This is what lets steps that haven't started yet
  // render as "queued": they have no step_runs row at all to subscribe to.
  const [stepDefs, setStepDefs] = useState<WorkflowStepDef[]>([]);
  useEffect(() => {
    gqlRequest<{ workflows_by_pk: { steps: WorkflowStepDef[] } | null }>(WORKFLOW_DETAIL, {
      id: params.id,
    }).then((data) => setStepDefs(data.workflows_by_pk?.steps ?? []));
  }, [params.id]);

  const { data: stepRunsData, error: stepRunsError } = useLiveQuery<{ step_runs: StepRun[] }>(
    STEP_RUNS_SUBSCRIPTION,
    { runId: params.runId }
  );
  const { data: runData } = useLiveQuery<{ workflow_runs_by_pk: WorkflowRun | null }>(
    WORKFLOW_RUN_SUBSCRIPTION,
    { runId: params.runId }
  );

  const run = runData?.workflow_runs_by_pk;
  const stepRunsByStepId = new Map((stepRunsData?.step_runs ?? []).map((sr) => [sr.workflow_step.id, sr]));
  const rows = stepDefs.map((step) => ({ step, stepRun: stepRunsByStepId.get(step.id) }));
  const upNextIndex = rows.findIndex((r) => deriveStepDisplayStatus(r.stepRun) === "queued");

  async function handleApprove(stepRunId: string) {
    setApproving(stepRunId);
    setApproveError(null);
    try {
      await gqlRequest(APPROVE_STEP, { stepRunId });
    } catch (err) {
      setApproveError({
        stepRunId,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setApproving(null);
    }
  }

  return (
    <div className="stack">
      <RunStatusHero runId={params.runId} status={run?.status} error={run?.error} />

      {stepRunsError && <p className="error-text">{stepRunsError}</p>}

      <div className="pipeline">
        {rows.map(({ step, stepRun }, index) => (
          <div className="pipeline-row" key={step.id}>
            <StepCard
              step={step}
              stepRun={stepRun}
              isUpNext={index === upNextIndex}
              role={role}
              onApprove={handleApprove}
              approving={approving === stepRun?.id}
              approveError={approveError && approveError.stepRunId === stepRun?.id ? approveError.message : null}
            />
            {index < rows.length - 1 && (
              <div
                className={`pipeline-connector pipeline-connector-${deriveStepDisplayStatus(stepRun)}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
