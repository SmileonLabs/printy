import { startOAuth } from "@/lib/server/auth/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return startOAuth(request, {
    provider: "kakao",
    clientId: process.env.KAKAO_CLIENT_ID,
    redirectUri: process.env.KAKAO_REDIRECT_URI,
    authorizeUrl: "https://kauth.kakao.com/oauth/authorize",
    scope: "profile_nickname account_email",
    redirectTarget: "dashboard",
  });
}
