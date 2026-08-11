import pg from "pg";
import { env } from "./env.js";

// Managed Postgres providers (Nhost Cloud included) require SSL on public
// connections and don't advertise it via the connection string itself,
// which can surface as a confusing "no authentication method is found"
// error instead of a clear SSL-required one. Local dev's docker-compose
// Postgres has no SSL support at all, so only enable it for non-local hosts.
const isLocalHost = /localhost|127\.0\.0\.1/.test(env.databaseUrl);

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
});

/**
 * Structural type satisfied by both `pool` (autocommit, one connection per
 * query) and a checked-out `PoolClient` (for an explicit transaction).
 * Workflow step execution intentionally uses `pool` directly rather than a
 * single wrapping transaction: each step_runs insert/update must commit
 * immediately so the GraphQL subscription driving the live run screen can
 * see it, instead of only appearing once the whole run finishes.
 */
export interface Queryable {
  query<T extends pg.QueryResultRow = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<pg.QueryResult<T>>;
}

export type Client = pg.PoolClient;

export async function withTransaction<T>(
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
