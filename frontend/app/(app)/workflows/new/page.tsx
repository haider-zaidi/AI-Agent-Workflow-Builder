"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/org";
import { gqlRequest } from "@/lib/graphql";
import { CREATE_WORKFLOW } from "@/graphql/mutations";

export default function NewWorkflowPage() {
  const { currentOrgId } = useOrg();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentOrgId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await gqlRequest<{ insert_workflows_one: { id: string } }>(CREATE_WORKFLOW, {
        orgId: currentOrgId,
        name,
        description: description || null,
      });
      router.push(`/workflows/${result.insert_workflows_one.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 480 }}>
      <h1>Create Workflow</h1>
      <form className="card stack" onSubmit={handleSubmit}>
        <label>
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Description
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Creating..." : "Create"}
        </button>
      </form>
    </div>
  );
}
