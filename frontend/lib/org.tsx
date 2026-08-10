"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { gqlRequest } from "./graphql";
import { MY_ORGANIZATIONS } from "@/graphql/queries";
import { useSession } from "./session";
import type { Role } from "./types";

interface OrgOption {
  id: string;
  name: string;
  quota_allowed: number;
  quota_used: number;
  role: Role;
}

interface OrgState {
  isLoading: boolean;
  orgs: OrgOption[];
  currentOrgId: string | null;
  currentOrg: OrgOption | null;
  role: Role | null;
  setCurrentOrgId: (id: string) => void;
  refresh: () => void;
}

const OrgContext = createContext<OrgState>({
  isLoading: true,
  orgs: [],
  currentOrgId: null,
  currentOrg: null,
  role: null,
  setCurrentOrgId: () => {},
  refresh: () => {},
});

interface OrganizationsQueryResult {
  organizations: {
    id: string;
    name: string;
    quota_allowed: number;
    quota_used: number;
    members: { role: Role }[];
  }[];
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const { userId, isAuthenticated } = useSession();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem("currentOrgId", id);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setOrgs([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    gqlRequest<OrganizationsQueryResult>(MY_ORGANIZATIONS, { userId })
      .then((data) => {
        if (cancelled) return;
        const mapped = data.organizations
          .filter((o) => o.members.length > 0)
          .map((o) => ({
            id: o.id,
            name: o.name,
            quota_allowed: o.quota_allowed,
            quota_used: o.quota_used,
            role: o.members[0].role,
          }));
        setOrgs(mapped);
        const stored = typeof window !== "undefined" ? window.localStorage.getItem("currentOrgId") : null;
        const initial = mapped.find((o) => o.id === stored)?.id ?? mapped[0]?.id ?? null;
        setCurrentOrgIdState(initial);
      })
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId, version]);

  const currentOrg = orgs.find((o) => o.id === currentOrgId) ?? null;

  return (
    <OrgContext.Provider
      value={{
        isLoading,
        orgs,
        currentOrgId,
        currentOrg,
        role: currentOrg?.role ?? null,
        setCurrentOrgId,
        refresh: () => setVersion((v) => v + 1),
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}
