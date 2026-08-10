"use client";

import Link from "next/link";
import { ArrowRight, Clock, Plus, Workflow as WorkflowIcon } from "lucide-react";
import { useOrg } from "@/lib/org";
import { useLiveQuery } from "@/lib/useLiveQuery";
import { WORKFLOWS_LIST_SUBSCRIPTION } from "@/graphql/subscriptions";
import { Button } from "@/components/ui/button";

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export default function WorkflowsListPage() {
  const { currentOrgId, role, isLoading } = useOrg();
  const { data, error } = useLiveQuery<{ workflows: Workflow[] }>(
    WORKFLOWS_LIST_SUBSCRIPTION,
    { orgId: currentOrgId },
    Boolean(currentOrgId)
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading organizations...</p>;
  }
  if (!currentOrgId) {
    return <p className="text-sm text-muted-foreground">You do not belong to any organization yet.</p>;
  }

  const canCreate = role === "owner" || role === "editor";
  const workflows = data?.workflows ?? [];

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Workflows</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {workflows.length} workflow{workflows.length === 1 ? "" : "s"} in this organization
          </p>
        </div>
        {canCreate && (
          <Link href="/workflows/new">
            <Button className="rounded-xl px-5 font-semibold">
              <Plus className="h-4 w-4" />
              Create Workflow
            </Button>
          </Link>
        )}
      </div>

      {error && (
        <p className="mt-6 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {workflows.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
            <WorkflowIcon className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-foreground">No workflows yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {canCreate
              ? "Create your first workflow to start chaining LLM calls, HTTP requests, and approval gates."
              : "An owner or editor hasn't created a workflow in this organization yet."}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {workflows.map((wf) => (
            <Link key={wf.id} href={`/workflows/${wf.id}`} className="group block no-underline">
              <div className="fx-card-hover h-full rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 ring-1 ring-white/[0.04] backdrop-blur-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
                    <WorkflowIcon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                </div>
                <h2 className="mt-4 truncate text-base font-semibold text-foreground">{wf.name}</h2>
                {wf.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{wf.description}</p>
                )}
                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(wf.created_at).toLocaleString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
