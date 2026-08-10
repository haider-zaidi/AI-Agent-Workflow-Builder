import { GraphQLClient } from "graphql-request";
import { nhost } from "./nhost";

const endpoint = process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL ?? "http://localhost:8081/v1/graphql";

export async function gqlRequest<T, V extends object = object>(
  document: string,
  variables?: V
): Promise<T> {
  const session = nhost.auth.getSession();
  const client = new GraphQLClient(endpoint, {
    headers: session?.accessToken
      ? { Authorization: `Bearer ${session.accessToken}` }
      : {},
  });
  return client.request<T>(document, variables as Record<string, unknown> | undefined);
}
