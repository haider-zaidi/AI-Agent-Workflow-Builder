"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/runStatus";

/**
 * Ticks a "time elapsed so far" display for a step that's still running.
 * This never changes what status is shown - status still comes entirely
 * from step_runs via the subscription - it only re-renders the clock
 * against the real `startedAt` timestamp the backend already recorded.
 */
export function LiveDuration({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = now - new Date(startedAt).getTime();
  return <span>{formatDuration(Math.max(0, elapsed))}</span>;
}
