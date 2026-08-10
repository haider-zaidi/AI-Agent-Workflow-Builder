import { StatusIcon } from "./StatusIcon";
import { deriveOverallStatus, STATUS_LABEL } from "@/lib/runStatus";
import type { RunStatus } from "@/lib/types";

export function RunStatusHero({
  runId,
  status,
  error,
}: {
  runId: string;
  status: RunStatus | undefined;
  error: string | null | undefined;
}) {
  const displayStatus = deriveOverallStatus(status);
  const subtitle = displayStatus === "paused" ? "Awaiting approval" : null;

  return (
    <div className={`run-hero run-hero-${displayStatus}`}>
      <p className="muted run-hero-eyebrow">Workflow Run</p>
      <h1 className="run-hero-id">Run #{runId.slice(0, 8)}</h1>
      <div className="run-hero-status">
        <StatusIcon status={displayStatus} size="lg" />
        <span>
          {STATUS_LABEL[displayStatus].toUpperCase()}
          {subtitle && <span className="run-hero-subtitle"> — {subtitle}</span>}
        </span>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
