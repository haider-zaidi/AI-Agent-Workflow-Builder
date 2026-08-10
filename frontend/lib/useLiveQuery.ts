"use client";

import { useEffect, useState } from "react";
import { createClient } from "graphql-ws";
import { nhost } from "./nhost";

const httpEndpoint = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL ?? "http://localhost:8081/v1/graphql";
const wsEndpoint = httpEndpoint.replace(/^http/, "ws");

/**
 * Subscribes to a GraphQL subscription for as long as the component is
 * mounted, re-subscribing whenever `variables` changes. This is what backs
 * the live run screen (spec section 27/29) - step_runs rows update in
 * Postgres, Hasura pushes the new set over this socket, and React re-renders
 * with no page refresh involved.
 */
export function useLiveQuery<T>(
  query: string,
  variables: Record<string, unknown>,
  enabled = true
): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const variablesKey = JSON.stringify(variables);

  useEffect(() => {
    if (!enabled) return;

    const session = nhost.auth.getSession();
    if (!session?.accessToken) return;

    const client = createClient({
      url: wsEndpoint,
      connectionParams: () => ({
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }),
    });

    const unsubscribe = client.subscribe<T>(
      { query, variables },
      {
        next: (result) => {
          if (result.errors?.length) {
            setError(result.errors.map((e) => e.message).join(", "));
            return;
          }
          setError(null);
          setData((result.data as T) ?? null);
        },
        error: (err) => setError(err instanceof Error ? err.message : String(err)),
        complete: () => {},
      }
    );

    return () => {
      unsubscribe();
      client.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, variablesKey, enabled]);

  return { data, error };
}
