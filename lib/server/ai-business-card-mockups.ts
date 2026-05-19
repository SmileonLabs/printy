import "server-only";

import type { AiBusinessCardMockup } from "@/lib/types";
import { queryDb } from "@/lib/server/db";

type AiBusinessCardMockupRow = {
  signature?: string;
  mockups: unknown;
};

export type AiBusinessCardMockupLookup = {
  brandName?: string;
  logoId?: string;
  memberName?: string;
  memberPhone?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAiBusinessCardMockup(value: unknown): value is AiBusinessCardMockup {
  return isRecord(value) && typeof value.id === "string" && typeof value.imageUrl === "string" && typeof value.cleanImageUrl === "string" && typeof value.title === "string";
}

export function readAiBusinessCardMockups(value: unknown): AiBusinessCardMockup[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const mockups = value.filter(isAiBusinessCardMockup);

  return mockups.length === value.length ? mockups : undefined;
}

export async function loadAiBusinessCardMockups(userId: string, signature: string) {
  const result = await queryDb<AiBusinessCardMockupRow>(
    `
      select mockups
      from ai_business_card_mockups
      where user_id = $1 and signature = $2
      limit 1
    `,
    [userId, signature],
  );

  return readAiBusinessCardMockups(result.rows[0]?.mockups) ?? [];
}

function readSavedSignature(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function normalizeLookupValue(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function savedSignatureMatchesLookup(signature: string, lookup: AiBusinessCardMockupLookup) {
  const parsed = readSavedSignature(signature);

  if (!parsed) {
    return false;
  }

  const member = isRecord(parsed.member) ? parsed.member : undefined;
  const brandNameMatches = !lookup.brandName || normalizeLookupValue(parsed.brandName as string | undefined) === normalizeLookupValue(lookup.brandName);
  const logoMatches = !lookup.logoId || parsed.logoId === lookup.logoId;
  const memberNameMatches = !lookup.memberName || normalizeLookupValue(member?.name as string | undefined) === normalizeLookupValue(lookup.memberName);
  const memberPhoneMatches = !lookup.memberPhone || normalizeLookupValue(member?.phone as string | undefined) === normalizeLookupValue(lookup.memberPhone);

  return brandNameMatches && logoMatches && memberNameMatches && memberPhoneMatches;
}

export async function loadAiBusinessCardMockupsByLookup(userId: string, lookup: AiBusinessCardMockupLookup) {
  if (!lookup.brandName && !lookup.logoId && !lookup.memberName && !lookup.memberPhone) {
    return [];
  }

  const result = await queryDb<AiBusinessCardMockupRow>(
    `
      select signature, mockups
      from ai_business_card_mockups
      where user_id = $1
      order by updated_at desc
      limit 50
    `,
    [userId],
  );

  for (const row of result.rows) {
    if (row.signature && savedSignatureMatchesLookup(row.signature, lookup)) {
      const mockups = readAiBusinessCardMockups(row.mockups);

      if (mockups) {
        return mockups;
      }
    }
  }

  return [];
}

export async function saveAiBusinessCardMockups(userId: string, signature: string, mockups: AiBusinessCardMockup[]) {
  const normalizedMockups = readAiBusinessCardMockups(mockups);

  if (!signature.trim() || !normalizedMockups) {
    throw new Error("Invalid AI business card mockup payload.");
  }

  const limitedMockups = normalizedMockups.slice(0, 20);

  await queryDb(
    `
      insert into ai_business_card_mockups (user_id, signature, mockups)
      values ($1, $2, $3::jsonb)
      on conflict (user_id, signature)
      do update set
        mockups = excluded.mockups,
        updated_at = now()
    `,
    [userId, signature, JSON.stringify(limitedMockups)],
  );

  return limitedMockups;
}
