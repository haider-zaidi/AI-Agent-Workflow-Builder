import { NhostClient } from "@nhost/nhost-js";

// Either point at a real Nhost subdomain/region (cloud project) or supply
// explicit local service URLs (docker-compose stack) - see .env.example.
const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
const region = process.env.NEXT_PUBLIC_NHOST_REGION;

// This app only uses auth + graphql (no file uploads, no serverless
// functions), but the SDK's constructor still requires all four URLs in the
// non-subdomain branch, so harmless placeholders are fine for the two unused
// ones when their env vars aren't set.
export const nhost = subdomain
  ? new NhostClient({ subdomain, region })
  : new NhostClient({
      authUrl: process.env.NEXT_PUBLIC_NHOST_AUTH_URL ?? "http://localhost:4000/v1",
      graphqlUrl: process.env.NEXT_PUBLIC_NHOST_GRAPHQL_URL ?? "http://localhost:8081/v1/graphql",
      storageUrl: process.env.NEXT_PUBLIC_NHOST_STORAGE_URL ?? "http://localhost:8000/v1",
      functionsUrl: process.env.NEXT_PUBLIC_NHOST_FUNCTIONS_URL ?? "http://localhost:8081/v1/functions",
    });
