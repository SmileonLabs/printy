import "server-only";

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

let pool: Pool | undefined;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  return databaseUrl;
}

export function getDbPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
    });
  }

  return pool;
}

export function queryDb<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
  return getDbPool().query<T>(text, values);
}

export async function withDbClient<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getDbPool().connect();

  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function closeDbPool() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}
