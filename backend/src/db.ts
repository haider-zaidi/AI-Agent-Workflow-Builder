import pg from "pg";
import { env } from "./env.js";

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
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
