import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import nextEnv from "@next/env";
import { Client } from "pg";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const directoriesByBucket = new Map([
  ["admin-business-card-backgrounds", path.join(process.cwd(), "public", "uploads", "admin", "business-card-backgrounds")],
  ["generated-logos", path.join(process.cwd(), "data", "uploads", "generated-logos")],
  ["logo-reference-images", path.join(process.cwd(), "data", "uploads", "logo-reference-images")],
]);

function isSafeObjectKey(objectKey) {
  return typeof objectKey === "string" && objectKey.length > 0 && !objectKey.includes("/") && !objectKey.includes("\\") && !objectKey.includes("..");
}

function isMissingFileError(error) {
  return error && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

async function readLocalUpload(bucket, objectKey) {
  const directory = directoriesByBucket.get(bucket);

  if (!directory || !isSafeObjectKey(objectKey)) {
    return undefined;
  }

  try {
    return await fs.readFile(path.join(directory, objectKey));
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }

    throw error;
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[printy-db] DATABASE_URL is required to backfill uploaded file blobs.");
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();

  const result = await client.query(
    `
      select id, bucket, object_key
      from uploaded_files
      where bucket = any($1::text[])
      order by created_at asc
    `,
    [[...directoriesByBucket.keys()]],
  );
  let storedCount = 0;
  let skippedCount = 0;

  await client.query("begin");

  try {
    for (const file of result.rows) {
      const bytes = await readLocalUpload(file.bucket, file.object_key);

      if (!bytes) {
        skippedCount += 1;
        continue;
      }

      await client.query(
        `
          insert into uploaded_file_blobs (uploaded_file_id, bytes)
          values ($1, $2)
          on conflict (uploaded_file_id)
          do update set bytes = excluded.bytes, updated_at = now()
        `,
        [file.id, bytes],
      );
      storedCount += 1;
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  console.log(`[printy-db] stored ${storedCount} uploaded file blobs; skipped ${skippedCount}.`);
} finally {
  await client.end().catch(() => undefined);
}
