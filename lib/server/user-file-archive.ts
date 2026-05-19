import "server-only";

import crypto from "node:crypto";
import { queryDb, withDbClient } from "@/lib/server/db";
import { readUserArchiveFileBytes, saveUserArchiveFileBytes } from "@/lib/server/storage";

export type UserFileArchiveUser = {
  id: string;
  name: string;
  contact: string;
  email: string;
};

export type UserFileArchiveFile = {
  id: string;
  userId: string;
  originalName: string;
  displayName: string;
  note: string;
  contentType: string;
  size: number;
  createdAt: string;
};

type UserRow = {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
};

type ArchiveFileRow = {
  id: string;
  user_id: string;
  original_name: string;
  display_name: string;
  note: string;
  content_type: string;
  size: string | number;
  created_at: Date;
};

type DownloadRow = ArchiveFileRow & {
  uploaded_file_id: string;
};

const maxArchiveUploadBytes = 50 * 1024 * 1024;

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function toArchiveFile(row: ArchiveFileRow): UserFileArchiveFile {
  return {
    id: row.id,
    userId: row.user_id,
    originalName: row.original_name,
    displayName: row.display_name,
    note: row.note,
    contentType: row.content_type,
    size: toNumber(row.size),
    createdAt: row.created_at.toISOString(),
  };
}

export async function listAdminFileArchiveUsers(): Promise<UserFileArchiveUser[]> {
  const result = await queryDb<UserRow>(
    `
      select id::text, name, contact, email
      from users
      order by updated_at desc, created_at desc
      limit 500
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    contact: row.contact ?? "",
    email: row.email ?? "",
  }));
}

export async function listAdminFileArchiveFiles(): Promise<UserFileArchiveFile[]> {
  const result = await queryDb<ArchiveFileRow>(
    `
      select id, user_id::text, original_name, display_name, note, content_type, size, created_at
      from user_file_archive_files
      order by created_at desc
      limit 500
    `,
  );

  return result.rows.map(toArchiveFile);
}

export async function listUserFileArchiveFiles(userId: string): Promise<UserFileArchiveFile[]> {
  const result = await queryDb<ArchiveFileRow>(
    `
      select id, user_id::text, original_name, display_name, note, content_type, size, created_at
      from user_file_archive_files
      where user_id = $1
      order by created_at desc
    `,
    [userId],
  );

  return result.rows.map(toArchiveFile);
}

export async function createUserFileArchiveFile(input: { userId: string; bytes: Uint8Array; contentType: string; originalName: string; displayName: string; note: string }): Promise<UserFileArchiveFile> {
  const originalName = input.originalName.trim();
  const displayName = input.displayName.trim() || originalName;
  const note = input.note.trim();

  if (!input.userId || input.bytes.byteLength <= 0 || input.bytes.byteLength > maxArchiveUploadBytes || !originalName || !displayName || displayName.length > 160 || note.length > 1000) {
    throw new Error("Invalid user archive file upload.");
  }

  return withDbClient(async (client) => {
    const userResult = await client.query<{ id: string }>("select id::text from users where id = $1 limit 1", [input.userId]);

    if (!userResult.rows[0]) {
      throw new Error("User not found.");
    }

    const stored = await saveUserArchiveFileBytes(input.bytes, input.contentType, originalName);
    const fileId = `user-archive-file-${crypto.randomUUID()}`;
    const result = await client.query<ArchiveFileRow>(
      `
        insert into user_file_archive_files (id, user_id, uploaded_file_id, original_name, display_name, note, content_type, size)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning id, user_id::text, original_name, display_name, note, content_type, size, created_at
      `,
      [fileId, input.userId, stored.id, originalName, displayName, note, stored.contentType, stored.size],
    );

    return toArchiveFile(result.rows[0]);
  });
}

export async function readUserFileArchiveDownload(userId: string, fileId: string): Promise<{ file: UserFileArchiveFile; bytes: Uint8Array } | undefined> {
  const result = await queryDb<DownloadRow>(
    `
      select id, user_id::text, uploaded_file_id, original_name, display_name, note, content_type, size, created_at
      from user_file_archive_files
      where user_id = $1 and id = $2
      limit 1
    `,
    [userId, fileId],
  );
  const row = result.rows[0];

  if (!row) {
    return undefined;
  }

  const stored = await readUserArchiveFileBytes(row.uploaded_file_id);

  return stored ? { file: toArchiveFile(row), bytes: stored.bytes } : undefined;
}

export function userArchiveContentDisposition(fileName: string) {
  const asciiFileName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-") || "printy-file";

  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
