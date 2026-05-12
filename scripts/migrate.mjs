import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import nextEnv from "@next/env";
import { Client } from "pg";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[printy-db] DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const migrationsDirectory = path.join(process.cwd(), "db", "migrations");
const client = new Client({
  connectionString: databaseUrl,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

async function listMigrationFiles() {
  const entries = await fs.readdir(migrationsDirectory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function ensureMigrationTable() {
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

async function hasMigration(version) {
  const result = await client.query("select 1 from schema_migrations where version = $1", [version]);

  return result.rowCount > 0;
}

async function applyMigration(fileName) {
  if (await hasMigration(fileName)) {
    console.log(`[printy-db] migration already applied: ${fileName}`);
    return;
  }

  const sql = await fs.readFile(path.join(migrationsDirectory, fileName), "utf8");

  await client.query("begin");

  try {
    await client.query(sql);
    await client.query("insert into schema_migrations (version) values ($1)", [fileName]);
    await client.query("commit");
    console.log(`[printy-db] applied migration: ${fileName}`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

try {
  await client.connect();
  await ensureMigrationTable();

  for (const fileName of await listMigrationFiles()) {
    await applyMigration(fileName);
  }

  console.log("[printy-db] migrations complete");
} finally {
  await client.end().catch(() => undefined);
}
