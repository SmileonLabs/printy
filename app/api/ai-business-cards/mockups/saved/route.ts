import { NextResponse } from "next/server";
import { getCurrentDbSession } from "@/lib/server/auth/session";
import { loadAiBusinessCardMockupMatchByLookup, loadAiBusinessCardMockups, readAiBusinessCardMockups, recoverLatestAiBusinessCardMockup, saveAiBusinessCardMockups } from "@/lib/server/ai-business-card-mockups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unauthorizedResponse = { reason: "로그인이 필요해요." };
const invalidResponse = { reason: "저장할 AI 명함 목업 정보가 올바르지 않아요." };
const unavailableResponse = { reason: "AI 명함 목업을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readSignature(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readOptionalSearchParam(url: URL, name: string) {
  const value = url.searchParams.get(name)?.trim();

  return value ? value : undefined;
}

export async function GET(request: Request) {
  try {
    const session = await getCurrentDbSession();

    if (!session) {
      return NextResponse.json(unauthorizedResponse, { status: 401 });
    }

    const url = new URL(request.url);
    const signature = readSignature(url.searchParams.get("signature"));

    const lookup = {
      brandName: readOptionalSearchParam(url, "brandName"),
      logoId: readOptionalSearchParam(url, "logoId"),
      memberName: readOptionalSearchParam(url, "memberName"),
      memberPhone: readOptionalSearchParam(url, "memberPhone"),
    };

    if (!signature && !lookup.brandName && !lookup.logoId && !lookup.memberName && !lookup.memberPhone) {
      return NextResponse.json(invalidResponse, { status: 400 });
    }

    const exactMockups = signature ? await loadAiBusinessCardMockups(session.user.id, signature) : [];

    if (exactMockups.length > 0) {
      return NextResponse.json({ mockups: exactMockups });
    }

    const recoveredMockups = signature ? await recoverLatestAiBusinessCardMockup(session.user.id, signature) : [];

    if (recoveredMockups.length > 0) {
      return NextResponse.json({ mockups: recoveredMockups, recovered: true });
    }

    const match = await loadAiBusinessCardMockupMatchByLookup(session.user.id, lookup);

    return NextResponse.json({ mockups: match?.mockups ?? [], signature: match?.signature });
  } catch {
    return NextResponse.json(unavailableResponse, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getCurrentDbSession();

    if (!session) {
      return NextResponse.json(unauthorizedResponse, { status: 401 });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const signature = isRecord(body) ? readSignature(body.signature) : undefined;
    const mockups = isRecord(body) ? readAiBusinessCardMockups(body.mockups) : undefined;

    if (!signature || !mockups) {
      return NextResponse.json(invalidResponse, { status: 400 });
    }

    return NextResponse.json({ mockups: await saveAiBusinessCardMockups(session.user.id, signature, mockups) });
  } catch {
    return NextResponse.json(unavailableResponse, { status: 503 });
  }
}
