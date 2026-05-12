import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

const bucket = "admin-business-card-backgrounds";
const purpose = "business-card-background";
const uploadDirectory = path.join(process.cwd(), "public", "uploads", "admin", "business-card-backgrounds");
const publicUploadPathPrefix = "/uploads/admin/business-card-backgrounds/";
const backgroundContentTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function objectKeyFromPublicUrl(publicUrl) {
  if (typeof publicUrl !== "string" || !publicUrl.startsWith(publicUploadPathPrefix)) {
    return undefined;
  }

  const objectKey = publicUrl.slice(publicUploadPathPrefix.length);

  return objectKey.length > 0 && !objectKey.includes("/") && !objectKey.includes("\\") && !objectKey.includes("..") ? objectKey : undefined;
}

function readPositiveSize(value) {
  const size = typeof value === "number" ? value : Number(value);

  return Number.isFinite(size) && size > 0 ? size : undefined;
}

function isMissingFileError(error) {
  return error && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

async function fileExists(objectKey) {
  try {
    const stats = await fs.stat(path.join(uploadDirectory, objectKey));

    return stats.isFile();
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }

    throw error;
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[printy-db] DATABASE_URL is required to backfill uploaded file metadata.");
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();

  const result = await client.query(`
    select id, image_url, content_type, size, created_at, updated_at
    from business_card_backgrounds
    order by created_at asc
  `);
  let registeredCount = 0;
  let skippedCount = 0;

  await client.query("begin");

  try {
    for (const background of result.rows) {
      const objectKey = objectKeyFromPublicUrl(background.image_url);
      const size = readPositiveSize(background.size);

      if (!objectKey || !backgroundContentTypes.has(background.content_type) || size === undefined || !(await fileExists(objectKey))) {
        skippedCount += 1;
        continue;
      }

      const uploadedFileId = `uploaded-file-backfill-${background.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

      const uploadResult = await client.query(
        `
          insert into uploaded_files (id, bucket, object_key, public_url, content_type, size, purpose, created_at, updated_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz)
          on conflict (bucket, object_key)
          do update set
            public_url = excluded.public_url,
            content_type = excluded.content_type,
            size = excluded.size,
            purpose = excluded.purpose,
            updated_at = greatest(uploaded_files.updated_at, excluded.updated_at)
          returning id
        `,
        [uploadedFileId, bucket, objectKey, background.image_url, background.content_type, size, purpose, background.created_at, background.updated_at],
      );

      await client.query("update business_card_backgrounds set uploaded_file_id = $2 where id = $1", [background.id, uploadResult.rows[0].id]);
      registeredCount += 1;
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  console.log(`[printy-db] registered ${registeredCount} uploaded business-card background files; skipped ${skippedCount}.`);
} finally {
  await client.end().catch(() => undefined);
}
