import { finishOAuthCallback } from "@/lib/server/auth/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return finishOAuthCallback(request, {
    provider: "kakao",
    clientId: process.env.KAKAO_CLIENT_ID,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
    redirectUri: process.env.KAKAO_REDIRECT_URI,
    requestUrl: request.url,
  });
}
