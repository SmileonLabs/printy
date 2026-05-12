import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

let pool: Pool | undefined;

function readRuntimeEnv(name: string) {
  const processValue = process.env[name];

  if (processValue) {
    return processValue;
  }

  try {
    const cloudflareEnv = getCloudflareContext({ async: false }).env as Record<string, string | undefined>;

    return cloudflareEnv[name];
  } catch {
    return undefined;
  }
}

function readCloudflareBinding<T>(name: string): T | undefined {
  try {
    const cloudflareEnv = getCloudflareContext({ async: false }).env as Record<string, T | undefined>;

    return cloudflareEnv[name];
  } catch {
    return undefined;
  }
}

function isCloudflareWorkerRuntime() {
  return readRuntimeEnv("PRINTY_RUNTIME") === "cloudflare-worker";
}

function getSslConfig() {
  if (readRuntimeEnv("PGSSLMODE") !== "require") {
    return undefined;
  }

  return isCloudflareWorkerRuntime() ? true : { rejectUnauthorized: false };
}

function getDatabaseUrl() {
  const hyperdrive = isCloudflareWorkerRuntime() ? readCloudflareBinding<{ connectionString?: string }>("HYPERDRIVE") : undefined;
  const hyperdriveUrl = hyperdrive?.connectionString;

  if (hyperdriveUrl) {
    return hyperdriveUrl;
  }

  const databaseUrl = readRuntimeEnv("DATABASE_URL");

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  return databaseUrl;
}

export function getDbPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: getSslConfig(),
    });
  }

  return pool;
}

function createDbPool() {
  return new Pool({
    connectionString: getDatabaseUrl(),
    ssl: getSslConfig(),
    max: 1,
  });
}

export async function queryDb<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
  if (isCloudflareWorkerRuntime()) {
    const requestPool = createDbPool();

    try {
      return await requestPool.query<T>(text, values);
    } finally {
      await requestPool.end().catch(() => undefined);
    }
  }

  return getDbPool().query<T>(text, values);
}

export async function withDbClient<T>(callback: (client: PoolClient) => Promise<T>) {
  const requestPool = isCloudflareWorkerRuntime() ? createDbPool() : undefined;
  const client = await (requestPool ?? getDbPool()).connect();

  try {
    return await callback(client);
  } finally {
    client.release();
    await requestPool?.end().catch(() => undefined);
  }
}

export async function closeDbPool() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}
