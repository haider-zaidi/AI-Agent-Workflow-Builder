"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useOrg } from "@/lib/org";
import { gqlRequest } from "@/lib/graphql";
import { WORKFLOW_DETAIL, WORKFLOW_RUNS_LIST } from "@/graphql/queries";
import {
  ADD_STEP,
  ADD_TRIGGER,
  DELETE_STEP,
  DELETE_TRIGGER,
  TRIGGER_WORKFLOW_RUN,
  UPDATE_STEP,
} from "@/graphql/mutations";
import type { StepType } from "@/lib/types";
import { STEP_TYPE_LABELS } from "@/lib/types";

interface Step {
  id: string;
  position: number;
  type: StepType;
  config: Record<string, unknown>;
}

interface Trigger {
  id: string;
  type: string;
  config: Record<string, unknown>;
  token: string;
}

interface Run {
  id: string;
  status: string;
  trigger_type: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  created_at: string;
}

const STEP_TYPES: StepType[] = [
  "llm_call",
  "http_request",
  "conditional_branch",
  "approval_gate",
  "db_write",
  "notify",
];

const DEFAULT_CONFIG: Record<StepType, string> = {
  llm_call: `{\n  "prompt": "Classify this feedback as positive or negative: {{step_1.output}}"\n}`,
  http_request: `{\n  "method": "GET",\n  "url": "https://api.github.com"\n}`,
  db_write: `{\n  "data": { "customer": "Haider", "note": "from workflow" }\n}`,
  notify: `{\n  "message": "Workflow needs attention"\n}`,
  conditional_branch: `{\n  "source_step_position": 1,\n  "operator": "contains",\n  "value": "negative",\n  "skip_steps_if_false": 1\n}`,
  approval_gate: `{}`,
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4001";

export default function WorkflowBuilderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { role } = useOrg();

  const [name, setName] = useState("");
  const [description, setDescription] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newStepType, setNewStepType] = useState<StepType>("llm_call");
  const [newStepConfig, setNewStepConfig] = useState(DEFAULT_CONFIG.llm_call);
  const [running, setRunning] = useState(false);

  const canEdit = role === "owner" || role === "editor";
  const canAddSensitive = role === "owner";
  const canManageTriggers = role === "owner";

  const refetch = useCallback(async () => {
    setError(null);
    try {
      const [wfResult, runsResult] = await Promise.all([
        gqlRequest<{
          workflows_by_pk: {
            id: string;
            name: string;
            description: string | null;
            steps: Step[];
            triggers: Trigger[];
          } | null;
        }>(WORKFLOW_DETAIL, { id: params.id }),
        gqlRequest<{ workflow_runs: Run[] }>(WORKFLOW_RUNS_LIST, { workflowId: params.id }),
      ]);
      if (!wfResult.workflows_by_pk) {
        setError("Workflow not found, or you do not have access to it.");
        return;
      }
      setName(wfResult.workflows_by_pk.name);
      setDescription(wfResult.workflows_by_pk.description);
      setSteps(wfResult.workflows_by_pk.steps);
      setTriggers(wfResult.workflows_by_pk.triggers);
      setRuns(runsResult.workflow_runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function handleAddStep() {
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(newStepConfig);
    } catch {
      setError("Step config must be valid JSON");
      return;
    }
    const nextPosition = (steps.at(-1)?.position ?? 0) + 1;
    try {
      await gqlRequest(ADD_STEP, {
        workflowId: params.id,
        position: nextPosition,
        type: newStepType,
        config: parsedConfig,
      });
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteStep(id: string) {
    try {
      await gqlRequest(DELETE_STEP, { id });
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleMove(step: Step, direction: -1 | 1) {
    const ordered = [...steps].sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((s) => s.id === step.id);
    const swapWith = ordered[index + direction];
    if (!swapWith) return;
    try {
      await gqlRequest(UPDATE_STEP, { id: step.id, position: swapWith.position, config: step.config });
      await gqlRequest(UPDATE_STEP, { id: swapWith.id, position: step.position, config: swapWith.config });
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleAddTrigger(type: "webhook" | "scheduled") {
    try {
      await gqlRequest(ADD_TRIGGER, { workflowId: params.id, type, config: {} });
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteTrigger(id: string) {
    try {
      await gqlRequest(DELETE_TRIGGER, { id });
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const result = await gqlRequest<{ triggerWorkflowRun: { workflow_run_id: string; status: string } }>(
        TRIGGER_WORKFLOW_RUN,
        { workflowId: params.id }
      );
      router.push(`/workflows/${params.id}/runs/${result.triggerWorkflowRun.workflow_run_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <p className="muted">Loading workflow...</p>;
  if (error && steps.length === 0 && !name) return <p className="error-text">{error}</p>;

  return (
    <div className="stack">
      <div className="row">
        <div>
          <h1>{name}</h1>
          {description && <p className="muted">{description}</p>}
        </div>
        <button className="primary" onClick={handleRun} disabled={running || role === "viewer"}>
          {running ? "Starting..." : "Run Workflow"}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card stack">
        <h3>Steps</h3>
        {steps.length === 0 && <p className="muted">No steps yet.</p>}
        {steps
          .sort((a, b) => a.position - b.position)
          .map((step, idx) => (
            <div key={step.id} className="row" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <strong>
                  {step.position}. {STEP_TYPE_LABELS[step.type]}
                </strong>
                <pre style={{ fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(step.config, null, 2)}
                </pre>
              </div>
              {canEdit && (
                <div className="stack" style={{ minWidth: 90 }}>
                  <button onClick={() => handleMove(step, -1)} disabled={idx === 0}>
                    Up
                  </button>
                  <button onClick={() => handleMove(step, 1)} disabled={idx === steps.length - 1}>
                    Down
                  </button>
                  <button className="danger" onClick={() => handleDeleteStep(step.id)}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}

        {canEdit && (
          <div className="stack" style={{ borderTop: "1px solid var(--panel-border)", paddingTop: "0.75rem" }}>
            <label>
              Step type
              <select
                value={newStepType}
                onChange={(e) => {
                  const type = e.target.value as StepType;
                  setNewStepType(type);
                  setNewStepConfig(DEFAULT_CONFIG[type]);
                }}
              >
                {STEP_TYPES.map((type) => (
                  <option
                    key={type}
                    value={type}
                    disabled={!canAddSensitive && (type === "db_write" || type === "notify")}
                  >
                    {STEP_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Config (JSON)
              <textarea
                rows={4}
                value={newStepConfig}
                onChange={(e) => setNewStepConfig(e.target.value)}
              />
            </label>
            <button onClick={handleAddStep}>Add Step</button>
          </div>
        )}
      </div>

      <div className="card stack">
        <h3>Triggers</h3>
        <p className="muted">Manual triggering is always available via the Run button above.</p>

        <div className="stack">
          <strong style={{ fontSize: "0.85rem" }}>Webhook</strong>
          <p className="muted">POST to this URL from any external system to start a run.</p>
          {triggers
            .filter((t) => t.type === "webhook")
            .map((t) => (
              <div key={t.id} className="row">
                <code style={{ fontSize: "0.8rem" }}>
                  POST {backendUrl}/webhooks/{t.token}
                </code>
                {canManageTriggers && (
                  <button className="danger" onClick={() => handleDeleteTrigger(t.id)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          {canManageTriggers && triggers.every((t) => t.type !== "webhook") && (
            <button onClick={() => handleAddTrigger("webhook")}>Add Webhook Trigger</button>
          )}
        </div>

        <div className="stack">
          <strong style={{ fontSize: "0.85rem" }}>Scheduled</strong>
          <p className="muted">
            Point an external scheduler (e.g. cron-job.org) at this URL with method POST and your
            desired schedule - each call starts a run automatically, no button click needed.
          </p>
          {triggers
            .filter((t) => t.type === "scheduled")
            .map((t) => (
              <div key={t.id} className="row">
                <code style={{ fontSize: "0.8rem" }}>
                  POST {backendUrl}/webhooks/{t.token}
                </code>
                {canManageTriggers && (
                  <button className="danger" onClick={() => handleDeleteTrigger(t.id)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          {canManageTriggers && triggers.every((t) => t.type !== "scheduled") && (
            <button onClick={() => handleAddTrigger("scheduled")}>Add Scheduled Trigger</button>
          )}
        </div>

        {!canManageTriggers && (
          <p className="muted">Only an organization owner can manage triggers.</p>
        )}
      </div>

      <div className="card stack">
        <h3>Run History</h3>
        {runs.length === 0 && <p className="muted">No runs yet.</p>}
        <table>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>
                  <Link href={`/workflows/${params.id}/runs/${run.id}`}>{run.id.slice(0, 8)}</Link>
                </td>
                <td>
                  <span className={`pill ${run.status}`}>{run.status}</span>
                </td>
                <td className="muted">{run.trigger_type}</td>
                <td className="muted">{new Date(run.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
