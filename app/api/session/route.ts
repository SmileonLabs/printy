import { NextResponse } from "next/server";
import { readBrandWorkspace } from "@/lib/brand-workspace";
import { clearSessionCookie, createDbSession, createLocalPasswordUser, findLocalPasswordUser, getCurrentDbSession, readLocalLoginInput, revokeCurrentDbSession, setSessionCookie } from "@/lib/server/auth/session";
import { saveBrandWorkspace } from "@/lib/server/brand-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const invalidSessionRequestReason = "아이디는 영문/숫자 3-40자, 비밀번호는 8자 이상으로 입력해 주세요.";
const invalidCredentialReason = "아이디 또는 비밀번호가 올바르지 않아요.";
const duplicateUserReason = "이미 가입된 아이디예요. 로그인으로 진행해 주세요.";
const sessionUnavailableReason = "로그인 저장소를 사용할 수 없어요. 잠시 후 다시 시도해 주세요.";

export async function GET() {
  try {
    const session = await getCurrentDbSession();

    return NextResponse.json({ authenticated: Boolean(session), session });
  } catch {
    return NextResponse.json({ authenticated: false, reason: sessionUnavailableReason }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const input = readLocalLoginInput(body);
  const workspace = typeof body === "object" && body !== null && "workspace" in body ? readBrandWorkspace((body as { workspace?: unknown }).workspace) : undefined;

  if (!input) {
    return NextResponse.json({ authenticated: false, reason: invalidSessionRequestReason }, { status: 400 });
  }

  try {
    const user = input.mode === "signup" ? await createLocalPasswordUser(input) : await findLocalPasswordUser(input);

    if (!user) {
      return NextResponse.json({ authenticated: false, reason: input.mode === "signup" ? duplicateUserReason : invalidCredentialReason }, { status: input.mode === "signup" ? 409 : 401 });
    }

    const dbSession = await createDbSession(user.id);

    if (workspace) {
      await saveBrandWorkspace(user.id, workspace);
    }

    const response = NextResponse.json({
      authenticated: true,
      session: {
        user: {
          id: user.id,
          name: user.name,
          contact: user.contact ?? user.email ?? input.userId,
          email: user.email ?? undefined,
        },
        authenticatedAt: new Date().toISOString(),
      },
    });

    return setSessionCookie(response, dbSession.token, dbSession.expiresAt, request);
  } catch {
    return NextResponse.json({ authenticated: false, reason: sessionUnavailableReason }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    await revokeCurrentDbSession();
  } catch {
    // Clearing the browser cookie is still safe even if DB revocation failed.
  }

  return clearSessionCookie(NextResponse.json({ authenticated: false }), request);
}
