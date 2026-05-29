import { NextResponse } from "next/server";
import { getCurrentDbSession } from "@/lib/server/auth/session";
import { queryDb } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PayloadRow = {
  id?: string;
  signature?: string;
  payload?: unknown;
  mockups?: unknown;
};

type ImageUrlRecord = {
  url: string;
  kind: "image" | "cleanImage";
  source: "business_card_drafts" | "ai_business_card_mockups";
  draftId?: string;
  mockupId?: string;
  signature?: string;
  title?: string;
  brandName?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeText(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function brandMatches(recordBrandName: string | undefined, requestedBrandName: string | undefined) {
  return !requestedBrandName || normalizeText(recordBrandName) === normalizeText(requestedBrandName);
}

function brandNameFromSignature(signature: string | undefined) {
  if (!signature || signature.startsWith("sha256:")) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(signature);

    return isRecord(parsed) ? readText(parsed.brandName) : undefined;
  } catch {
    return undefined;
  }
}

function brandNameFromMockup(mockup: Record<string, unknown>) {
  return isRecord(mockup.lookup) ? readText(mockup.lookup.brandName) : undefined;
}

function pushMockupUrls(records: ImageUrlRecord[], input: { mockup: unknown; source: ImageUrlRecord["source"]; requestedBrandName?: string; draftId?: string; signature?: string; fallbackBrandName?: string }) {
  if (!isRecord(input.mockup)) {
    return;
  }

  const brandName = brandNameFromMockup(input.mockup) ?? input.fallbackBrandName ?? brandNameFromSignature(input.signature);

  if (!brandMatches(brandName, input.requestedBrandName)) {
    return;
  }

  const mockupId = readText(input.mockup.id);
  const title = readText(input.mockup.title);
  const imageUrl = readText(input.mockup.imageUrl);
  const cleanImageUrl = readText(input.mockup.cleanImageUrl);

  if (imageUrl) {
    records.push({ url: imageUrl, kind: "image", source: input.source, draftId: input.draftId, mockupId, signature: input.signature, title, brandName });
  }

  if (cleanImageUrl && cleanImageUrl !== imageUrl) {
    records.push({ url: cleanImageUrl, kind: "cleanImage", source: input.source, draftId: input.draftId, mockupId, signature: input.signature, title, brandName });
  }
}

function dedupeImageUrls(records: ImageUrlRecord[]) {
  const seen = new Set<string>();

  return records.filter((record) => {
    const key = `${record.kind}:${record.url}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function GET(request: Request) {
  const session = await getCurrentDbSession();

  if (!session) {
    return NextResponse.json({ reason: "로그인이 필요해요." }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedBrandName = readText(url.searchParams.get("brandName"));
  const records: ImageUrlRecord[] = [];

  const [draftResult, mockupResult] = await Promise.all([
    queryDb<PayloadRow>("select id, payload from business_card_drafts where user_id = $1 order by updated_at desc, created_at desc", [session.user.id]),
    queryDb<PayloadRow>("select signature, mockups from ai_business_card_mockups where user_id = $1 order by updated_at desc, created_at desc", [session.user.id]),
  ]);

  for (const row of draftResult.rows) {
    if (!isRecord(row.payload)) {
      continue;
    }

    const brandName = readText(row.payload.brandName);

    if (!brandMatches(brandName, requestedBrandName)) {
      continue;
    }

    pushMockupUrls(records, { mockup: row.payload.completedMockup, source: "business_card_drafts", requestedBrandName, draftId: row.id, signature: readText(row.payload.completedMockupSignature), fallbackBrandName: brandName });
  }

  for (const row of mockupResult.rows) {
    const mockups = Array.isArray(row.mockups) ? row.mockups : [];
    const signature = readText(row.signature);

    for (const mockup of mockups) {
      pushMockupUrls(records, { mockup, source: "ai_business_card_mockups", requestedBrandName, signature });
    }
  }

  const imageUrls = dedupeImageUrls(records);

  return NextResponse.json({ brandName: requestedBrandName, count: imageUrls.length, imageUrls });
}
