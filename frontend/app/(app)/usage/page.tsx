"use client";

import { useEffect, useState } from "react";
import { useOrg } from "@/lib/org";
import { gqlRequest } from "@/lib/graphql";
import { ORG_USAGE } from "@/graphql/queries";

interface Usage {
  org_id: string;
  quota_allowed: number;
  quota_used: number;
  runs_this_month: number;
  runs_total: number;
}

export default function UsagePage() {
  const { currentOrgId, currentOrg } = useOrg();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrgId) return;
    gqlRequest<{ organization_usage: Usage[] }>(ORG_USAGE, { orgId: currentOrgId })
      .then((data) => setUsage(data.organization_usage[0] ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [currentOrgId]);

  if (!currentOrgId) return null;

  const percent = usage ? Math.min(100, Math.round((usage.quota_used / usage.quota_allowed) * 100)) : 0;

  return (
    <div className="stack">
      <h1>Usage</h1>
      {error && <p className="error-text">{error}</p>}
      {usage && (
        <div className="card stack">
          <p>
            {usage.quota_used} / {usage.quota_allowed} workflow runs ({percent}%)
          </p>
          <div className="quota-bar">
            <div style={{ width: `${percent}%` }} />
          </div>
          <p className="muted">Runs this month: {usage.runs_this_month}</p>
          <p className="muted">Runs total: {usage.runs_total}</p>
          <p className="muted">Organization: {currentOrg?.name}</p>
        </div>
      )}
    </div>
  );
}
