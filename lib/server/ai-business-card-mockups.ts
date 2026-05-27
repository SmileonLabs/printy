import "server-only";

import { createHash } from "crypto";
import type { AiBusinessCardMockup } from "@/lib/types";
import { queryDb } from "@/lib/server/db";

type AiBusinessCardMockupRow = {
  signature?: string;
  mockups: unknown;
  updated_at?: Date | string;
};

type UploadedBrandAssetRow = {
  id: string;
  public_url: string;
  created_at: Date | string;
};

type AiBusinessCardMockupLookupRecord = {
  brandName?: string;
  logoId?: string;
  memberName?: string;
  memberPhone?: string;
};

type AiBusinessCardMockupWithLookup = AiBusinessCardMockup & {
  lookup?: AiBusinessCardMockupLookupRecord;
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

function normalizeIndexedSignature(value: string) {
  const signature = value.trim();

  if (signature.length <= 512) {
    return signature;
  }

  return `sha256:${createHash("sha256").update(signature).digest("hex")}`;
}

export function readAiBusinessCardMockups(value: unknown): AiBusinessCardMockup[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const mockups = value.filter(isAiBusinessCardMockup);

  return mockups.length === value.length ? mockups : undefined;
}

export async function loadAiBusinessCardMockups(userId: string, signature: string) {
  const indexedSignature = normalizeIndexedSignature(signature);
  const result = await queryDb<AiBusinessCardMockupRow>(
    `
      select mockups
      from ai_business_card_mockups
      where user_id = $1 and signature = $2
      limit 1
    `,
    [userId, indexedSignature],
  );

  return readAiBusinessCardMockups(result.rows[0]?.mockups) ?? [];
}

export async function recoverLatestAiBusinessCardMockup(userId: string, signature: string) {
  const indexedSignature = normalizeIndexedSignature(signature);
  const emptyResult = await queryDb<AiBusinessCardMockupRow>(
    `
      select signature, mockups, updated_at
      from ai_business_card_mockups
      where user_id = $1
        and signature = $2
        and jsonb_typeof(mockups) = 'array'
        and jsonb_array_length(mockups) = 0
        and updated_at > now() - interval '6 hours'
      order by updated_at desc
      limit 1
    `,
    [userId, indexedSignature],
  );
  const emptyRow = emptyResult.rows[0];

  if (!emptyRow?.updated_at) {
    return [];
  }

  const assetResult = await queryDb<UploadedBrandAssetRow>(
    `
      select id, public_url, created_at
      from uploaded_files
      where bucket = 'brand-assets'
        and purpose = 'brand-asset'
        and content_type = 'image/png'
        and created_at between $1::timestamptz - interval '45 minutes' and $1::timestamptz + interval '5 minutes'
      order by created_at desc
      limit 1
    `,
    [emptyRow.updated_at],
  );
  const asset = assetResult.rows[0];

  if (!asset?.public_url) {
    return [];
  }

  const recoveredMockups: AiBusinessCardMockup[] = [{
    id: `ai-business-card-recovered-${asset.id}`,
    imageUrl: asset.public_url,
    cleanImageUrl: asset.public_url,
    title: "복구된 명함 목업",
  }];

  return saveAiBusinessCardMockups(userId, indexedSignature, recoveredMockups);
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

function lookupFromSavedSignature(signature: string): AiBusinessCardMockupLookupRecord | undefined {
  const parsed = readSavedSignature(signature);

  if (!parsed) {
    return undefined;
  }

  const member = isRecord(parsed.member) ? parsed.member : undefined;

  return {
    brandName: typeof parsed.brandName === "string" ? parsed.brandName : undefined,
    logoId: typeof parsed.logoId === "string" ? parsed.logoId : undefined,
    memberName: typeof member?.name === "string" ? member.name : undefined,
    memberPhone: typeof member?.phone === "string" ? member.phone : undefined,
  };
}

function lookupFromSavedMockups(value: unknown): AiBusinessCardMockupLookupRecord | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  for (const item of value) {
    if (!isRecord(item) || !isRecord(item.lookup)) {
      continue;
    }

    return {
      brandName: typeof item.lookup.brandName === "string" ? item.lookup.brandName : undefined,
      logoId: typeof item.lookup.logoId === "string" ? item.lookup.logoId : undefined,
      memberName: typeof item.lookup.memberName === "string" ? item.lookup.memberName : undefined,
      memberPhone: typeof item.lookup.memberPhone === "string" ? item.lookup.memberPhone : undefined,
    };
  }

  return undefined;
}

function savedLookupMatchesLookup(savedLookup: AiBusinessCardMockupLookupRecord | undefined, lookup: AiBusinessCardMockupLookup) {
  if (!savedLookup) {
    return false;
  }

  const brandNameMatches = !lookup.brandName || normalizeLookupValue(savedLookup.brandName) === normalizeLookupValue(lookup.brandName);
  const logoMatches = !lookup.logoId || savedLookup.logoId === lookup.logoId;
  const memberNameMatches = !lookup.memberName || normalizeLookupValue(savedLookup.memberName) === normalizeLookupValue(lookup.memberName);
  const memberPhoneMatches = !lookup.memberPhone || normalizeLookupValue(savedLookup.memberPhone) === normalizeLookupValue(lookup.memberPhone);

  return brandNameMatches && logoMatches && memberNameMatches && memberPhoneMatches;
}

export async function loadAiBusinessCardMockupsByLookup(userId: string, lookup: AiBusinessCardMockupLookup) {
  return (await loadAiBusinessCardMockupMatchByLookup(userId, lookup))?.mockups ?? [];
}

export async function loadAiBusinessCardMockupMatchByLookup(userId: string, lookup: AiBusinessCardMockupLookup) {
  if (!lookup.brandName && !lookup.logoId && !lookup.memberName && !lookup.memberPhone) {
    return undefined;
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
    if (savedLookupMatchesLookup((row.signature ? lookupFromSavedSignature(row.signature) : undefined) ?? lookupFromSavedMockups(row.mockups), lookup)) {
      const mockups = readAiBusinessCardMockups(row.mockups);

      if (mockups && mockups.length > 0) {
        return { signature: row.signature, mockups };
      }
    }
  }

  return undefined;
}

export async function saveAiBusinessCardMockups(userId: string, signature: string, mockups: AiBusinessCardMockup[]) {
  const normalizedMockups = readAiBusinessCardMockups(mockups);
  const indexedSignature = normalizeIndexedSignature(signature);

  if (!indexedSignature || !normalizedMockups || normalizedMockups.length === 0) {
    throw new Error("Invalid AI business card mockup payload.");
  }

  const lookup = lookupFromSavedSignature(signature);
  const limitedMockups: AiBusinessCardMockupWithLookup[] = normalizedMockups.slice(0, 20).map((mockup) => (lookup ? { ...mockup, lookup } : mockup));

  await queryDb(
    `
      insert into ai_business_card_mockups (user_id, signature, mockups)
      values ($1, $2, $3::jsonb)
      on conflict (user_id, signature)
      do update set
        mockups = excluded.mockups,
        updated_at = now()
    `,
    [userId, indexedSignature, JSON.stringify(limitedMockups)],
  );

  return limitedMockups;
}
