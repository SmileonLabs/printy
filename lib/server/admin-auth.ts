import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { normalizeContact } from "@/lib/contact";

export const adminSessionCookieName = "printy-admin-session";

const sessionMaxAgeSeconds = 8 * 60 * 60;
const signatureSeparator = ".";

type AdminSessionPayload = {
  contact: string;
  issuedAt: number;
  expiresAt: number;
};

function readConfiguredContacts() {
  const configuredContacts = process.env.PRINTY_ADMIN_CONTACTS ?? "";

  return configuredContacts
    .split(/[\n,]/)
    .map((contact) => normalizeContact(contact))
    .filter((contact, index, contacts) => contact.length > 0 && contacts.indexOf(contact) === index);
}

function readConfiguredToken() {
  return process.env.PRINTY_ADMIN_TOKEN ?? "";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string, token: string) {
  return createHmac("sha256", token).update(encodedPayload).digest("base64url");
}

function constantTimeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isAdminSessionPayload(value: unknown): value is AdminSessionPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.contact === "string" && typeof record.issuedAt === "number" && Number.isFinite(record.issuedAt) && typeof record.expiresAt === "number" && Number.isFinite(record.expiresAt);
}

export function isAllowedAdminContact(contact: string) {
  const normalizedContact = normalizeContact(contact);

  return normalizedContact.length > 0 && readConfiguredContacts().includes(normalizedContact);
}

export function isValidAdminToken(token: string) {
  const configuredToken = readConfiguredToken();

  return configuredToken.length > 0 && token.length > 0 && constantTimeEquals(token, configuredToken);
}

export function createAdminSessionCookie(contact: string) {
  const configuredToken = readConfiguredToken();
  const normalizedContact = normalizeContact(contact);
  const issuedAt = Date.now();
  const payload: AdminSessionPayload = {
    contact: normalizedContact,
    issuedAt,
    expiresAt: issuedAt + sessionMaxAgeSeconds * 1000,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, configuredToken);

  return `${encodedPayload}${signatureSeparator}${signature}`;
}

export function verifyAdminSessionCookie(cookieValue: string | undefined) {
  const configuredToken = readConfiguredToken();

  if (!cookieValue || configuredToken.length === 0) {
    return undefined;
  }

  const [encodedPayload, signature, extra] = cookieValue.split(signatureSeparator);

  if (!encodedPayload || !signature || extra !== undefined) {
    return undefined;
  }

  const expectedSignature = signPayload(encodedPayload, configuredToken);

  if (!constantTimeEquals(signature, expectedSignature)) {
    return undefined;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    if (!isAdminSessionPayload(payload) || payload.expiresAt <= Date.now() || !isAllowedAdminContact(payload.contact)) {
      return undefined;
    }

    return payload;
  } catch {
    return undefined;
  }
}

export function getAdminSession(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const sessionCookie = cookies.find((cookie) => cookie.startsWith(`${adminSessionCookieName}=`));
  const cookieValue = sessionCookie?.slice(adminSessionCookieName.length + 1);

  return verifyAdminSessionCookie(cookieValue);
}

export function isAdminRequestAuthenticated(request: Request) {
  return getAdminSession(request) !== undefined;
}

export function setAdminSessionCookie(response: NextResponse, contact: string) {
  response.cookies.set(adminSessionCookieName, createAdminSessionCookie(contact), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/admin",
    maxAge: sessionMaxAgeSeconds,
  });

  return response;
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(adminSessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/admin",
    maxAge: 0,
  });

  return response;
}
