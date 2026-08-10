import { STATUS_ICON, type StepDisplayStatus } from "@/lib/runStatus";

export function StatusIcon({ status, size = "md" }: { status: StepDisplayStatus; size?: "md" | "lg" }) {
  return (
    <span
      className={`status-icon status-icon-${status} status-icon-${size}`}
      aria-label={status}
      role="img"
    >
      {STATUS_ICON[status]}
    </span>
  );
}
