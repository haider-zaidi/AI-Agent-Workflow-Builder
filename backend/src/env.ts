import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4001),
  databaseUrl: required(
    "DATABASE_URL",
    "postgres://postgres:postgres@localhost:55432/postgres"
  ),
  hasuraGraphqlUrl: required(
    "HASURA_GRAPHQL_URL",
    "http://localhost:8081/v1/graphql"
  ),
  hasuraAdminSecret: required("HASURA_GRAPHQL_ADMIN_SECRET", "devsecret"),
  hasuraActionSecret: required("HASURA_ACTION_SECRET", "devsecret-action"),
  hasuraEventSecret: required("HASURA_EVENT_SECRET", "devsecret-event"),

  llmProvider: process.env.LLM_PROVIDER ?? "groq",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "llama-3.1-8b-instant",

  // Notify step delivery (backend/src/webhooks/notifyEvent.ts). Defaults match
  // the local Mailhog container in docker-compose.yml (no auth needed) so
  // notify steps work out of the box in dev; point these at a real SMTP
  // provider (Gmail, SendGrid, etc.) in production.
  smtpHost: process.env.SMTP_HOST ?? "localhost",
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),
  smtpSecure: (process.env.SMTP_SECURE ?? "false") === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "AI Agent Workflow Builder <notifications@ai-workflow-builder.local>",

  httpRequestTimeoutMs: Number(process.env.HTTP_REQUEST_TIMEOUT_MS ?? 15000),
};
