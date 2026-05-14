import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { queryDb } from "@/lib/server/db";

export type PublicSessionUser = {
  id: string;
  name: string;
  contact: string;
  email?: string;
};

export type PublicSession = {
  user: PublicSessionUser;
  authenticatedAt: string;
};

export type OAuthProvider = "google" | "kakao";

type UserRow = {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  password_hash?: string | null;
};

type SessionRow = UserRow & {
  created_at: Date;
};

const sessionCookieName = "printy_session";
const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;
const localPasswordHashPrefix = "scrypt";

function normalizeLocalUserId(value: string) {
  return value.trim().toLowerCase();
}

function isValidLocalUserId(value: string) {
  return /^[a-z0-9][a-z0-9._-]{2,39}$/.test(value);
}

function hashLocalPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(password, salt, 64).toString("base64url");

  return `${localPasswordHashPrefix}:${salt}:${hash}`;
}

function verifyLocalPassword(password: string, storedHash: string) {
  const [prefix, salt, hash] = storedHash.split(":");

  if (prefix !== localPasswordHashPrefix || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = crypto.scryptSync(password, salt, expected.length);

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function isLocalHttpRequest(request?: Request) {
  if (!request) {
    return false;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.toLowerCase();
  const host = request.headers.get("host")?.toLowerCase() ?? "";

  return forwardedProto === "http" || host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("0.0.0.0");
}

function cookieOptions(expires: Date, request?: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && process.env.PRINTY_ALLOW_INSECURE_COOKIES !== "1" && !isLocalHttpRequest(request),
    path: "/",
    expires,
  };
}

function toPublicSession(row: SessionRow): PublicSession {
  const contact = row.contact ?? row.email ?? "";

  return {
    user: {
      id: row.id,
      name: row.name,
      contact,
      email: row.email ?? undefined,
    },
    authenticatedAt: row.created_at.toISOString(),
  };
}

export function readLocalLoginInput(value: unknown): { userId: string; password: string } | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const userId = typeof record.userId === "string" ? normalizeLocalUserId(record.userId) : "";
  const password = typeof record.password === "string" ? record.password : "";

  if (!isValidLocalUserId(userId) || password.length < 8 || password.length > 100) {
    return undefined;
  }

  return { userId, password };
}

export async function findOrCreateLocalPasswordUser(input: { userId: string; password: string }) {
  const existingUser = await queryDb<UserRow>(
    `
      select id, name, contact, email, password_hash
      from users
      where contact = $1
      limit 1
    `,
    [input.userId],
  );
  const existing = existingUser.rows[0];

  if (existing) {
    if (!existing.password_hash || !verifyLocalPassword(input.password, existing.password_hash)) {
      return undefined;
    }

    return existing;
  }

  const result = await queryDb<UserRow>(
    `
      insert into users (name, contact, password_hash)
      values ($1, $2, $3)
      returning id, name, contact, email
    `,
    [input.userId, input.userId, hashLocalPassword(input.password)],
  );

  return result.rows[0];
}

export async function upsertOAuthUser(input: { provider: OAuthProvider; providerId: string; name: string; email?: string }) {
  const providerColumn = input.provider === "google" ? "google_provider_id" : "kakao_provider_id";
  const providerId = input.providerId.trim();
  const name = input.name.trim() || input.email || `${input.provider} user`;
  const email = input.email?.trim().toLowerCase() || null;

  if (!providerId) {
    throw new Error("OAuth provider id is required.");
  }

  if (email) {
    const linkedByEmail = await queryDb<UserRow>(
      `
        update users
        set name = $1,
          ${providerColumn} = coalesce(${providerColumn}, $2),
          email = coalesce(email, $3),
          updated_at = now()
        where lower(email) = lower($3)
        returning id, name, contact, email
      `,
      [name, providerId, email],
    );

    if (linkedByEmail.rows[0]) {
      return linkedByEmail.rows[0];
    }
  }

  const result = await queryDb<UserRow>(
    `
      insert into users (name, email, ${providerColumn})
      values ($1, $2, $3)
      on conflict (${providerColumn})
      do update set
        name = excluded.name,
        email = coalesce(users.email, excluded.email),
        updated_at = now()
      returning id, name, contact, email
    `,
    [name, email, providerId],
  );

  return result.rows[0];
}

export async function createDbSession(userId: string, provider = "local") {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + sessionDurationMs);

  await queryDb(
    `
      insert into auth_sessions (user_id, session_token_hash, provider, expires_at)
      values ($1, $2, $3, $4)
    `,
    [userId, tokenHash, provider, expiresAt],
  );

  return { token, expiresAt };
}

export async function getCurrentDbSession(): Promise<PublicSession | undefined> {
  const token = (await cookies()).get(sessionCookieName)?.value;

  if (!token) {
    return undefined;
  }

  const result = await queryDb<SessionRow>(
    `
      update auth_sessions
      set last_seen_at = now()
      where session_token_hash = $1
        and revoked_at is null
        and expires_at > now()
      returning created_at,
        (select id from users where users.id = auth_sessions.user_id) as id,
        (select name from users where users.id = auth_sessions.user_id) as name,
        (select contact from users where users.id = auth_sessions.user_id) as contact,
        (select email from users where users.id = auth_sessions.user_id) as email
    `,
    [hashSessionToken(token)],
  );
  const row = result.rows[0];

  return row ? toPublicSession(row) : undefined;
}

export async function revokeCurrentDbSession() {
  const token = (await cookies()).get(sessionCookieName)?.value;

  if (!token) {
    return;
  }

  await queryDb("update auth_sessions set revoked_at = now() where session_token_hash = $1 and revoked_at is null", [hashSessionToken(token)]);
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date, request?: Request) {
  response.cookies.set(sessionCookieName, token, cookieOptions(expiresAt, request));

  return response;
}

export function clearSessionCookie(response: NextResponse, request?: Request) {
  response.cookies.set(sessionCookieName, "", { ...cookieOptions(new Date(0), request), maxAge: 0 });

  return response;
}
