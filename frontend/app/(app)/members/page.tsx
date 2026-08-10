"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useOrg } from "@/lib/org";
import { gqlRequest } from "@/lib/graphql";
import { ORG_MEMBERS } from "@/graphql/queries";
import { ADD_MEMBER, DELETE_MEMBER, LOOKUP_USER_BY_EMAIL, UPDATE_MEMBER_ROLE } from "@/graphql/mutations";
import type { Role } from "@/lib/types";

interface Member {
  id: string;
  user_id: string;
  role: Role;
  user: { displayName: string | null; email: string | null } | null;
}

interface LookupResult {
  user_id: string | null;
  display_name: string | null;
  email: string | null;
  already_member: boolean;
}

const ROLES: Role[] = ["owner", "editor", "viewer"];

export default function MembersPage() {
  const { currentOrgId, role } = useOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("viewer");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!currentOrgId) return;
    gqlRequest<{ org_members: Member[] }>(ORG_MEMBERS, { orgId: currentOrgId })
      .then((data) => setMembers(data.org_members))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [currentOrgId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    if (!currentOrgId) return;
    setAddBusy(true);
    setAddError(null);
    try {
      const lookup = await gqlRequest<{ lookupUserByEmail: LookupResult }>(LOOKUP_USER_BY_EMAIL, {
        orgId: currentOrgId,
        email: newEmail,
      });
      const found = lookup.lookupUserByEmail;
      if (!found.user_id) {
        setAddError(`No account found for ${newEmail}. They need to sign up first.`);
        return;
      }
      if (found.already_member) {
        setAddError(`${newEmail} is already a member of this organization.`);
        return;
      }
      await gqlRequest(ADD_MEMBER, { orgId: currentOrgId, userId: found.user_id, role: newRole });
      setNewEmail("");
      setNewRole("viewer");
      setShowAddForm(false);
      refetch();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddBusy(false);
    }
  }

  async function handleRoleChange(id: string, newRole: Role) {
    try {
      await gqlRequest(UPDATE_MEMBER_ROLE, { id, role: newRole });
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRemove(id: string) {
    try {
      await gqlRequest(DELETE_MEMBER, { id });
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (role !== "owner") {
    return <p className="muted">Only an organization owner can manage members.</p>;
  }

  return (
    <div className="stack">
      <div className="row">
        <h1>Members</h1>
        <button
          className="primary"
          onClick={() => {
            setShowAddForm(true);
            setAddError(null);
          }}
        >
          Add Member
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.user?.displayName ?? "—"}</td>
              <td>{m.user?.email ?? m.user_id.slice(0, 8)}</td>
              <td>
                <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button className="danger" onClick={() => handleRemove(m.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showAddForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setShowAddForm(false)}
        >
          <div
            className="card stack"
            style={{ width: "100%", maxWidth: 420, margin: "1rem" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Add Member</h3>
            <p className="muted">
              They must already have an account (sign up first) - this adds them to this organization.
            </p>
            <form className="stack" onSubmit={handleAddMember}>
              <label>
                Email
                <input
                  type="email"
                  required
                  autoFocus
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </label>
              <label>
                Role
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              {addError && <p className="error-text">{addError}</p>}
              <div className="row" style={{ justifyContent: "flex-start", gap: "0.5rem" }}>
                <button className="primary" type="submit" disabled={addBusy}>
                  {addBusy ? "Adding..." : "Add Member"}
                </button>
                <button
                  type="button"
                  disabled={addBusy}
                  onClick={() => {
                    setShowAddForm(false);
                    setAddError(null);
                    setNewEmail("");
                    setNewRole("viewer");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
