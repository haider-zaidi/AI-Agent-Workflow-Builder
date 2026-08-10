"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { nhost } from "./nhost";

interface SessionState {
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  accessToken: string | null;
}

const SessionContext = createContext<SessionState>({
  isLoading: true,
  isAuthenticated: false,
  userId: null,
  email: null,
  accessToken: null,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    isLoading: true,
    isAuthenticated: false,
    userId: null,
    email: null,
    accessToken: null,
  });

  useEffect(() => {
    function syncFromSession() {
      const session = nhost.auth.getSession();
      setState({
        isLoading: false,
        isAuthenticated: Boolean(session),
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        accessToken: session?.accessToken ?? null,
      });
    }

    // On a fresh page load, getSession() can return null for a brief moment
    // before the SDK finishes restoring/refreshing the session from storage -
    // reading it synchronously here would flash "logged out" and bounce to
    // /login before immediately bouncing back. isAuthenticatedAsync() waits
    // for that initial network round-trip to actually finish first.
    nhost.auth.isAuthenticatedAsync().then(() => syncFromSession());
    const unsubscribe = nhost.auth.onAuthStateChanged(() => syncFromSession());
    return () => unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
