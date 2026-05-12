import "server-only";

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createDbSession, setSessionCookie, upsertOAuthUser, type OAuthProvider } from "@/lib/server/auth/session";

type OAuthProfile = {
  provider: OAuthProvider;
  providerId: string;
  name: string;
  email?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
};

type GoogleProfileResponse = {
  sub?: string;
  name?: string;
  email?: string;
};

type KakaoTokenResponse = {
  access_token?: string;
};

type KakaoProfileResponse = {
  id?: number | string;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
    };
  };
  properties?: {
    nickname?: string;
  };
};

export type OAuthStartConfig = {
  provider: OAuthProvider;
  clientId?: string;
  redirectUri?: string;
  authorizeUrl: string;
  scope: string;
  redirectTarget: string;
};

export type OAuthCallbackConfig = {
  provider: OAuthProvider;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  requestUrl: string;
};

const oauthStateCookieName = "printy_oauth_state";
const oauthRedirectCookieName = "printy_oauth_redirect";
const oauthStateDurationSeconds = 10 * 60;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && process.env.PRINTY_ALLOW_INSECURE_COOKIES !== "1",
    path: "/",
    maxAge,
  };
}

function createState() {
  return crypto.randomBytes(24).toString("base64url");
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? null;
}

function isLocalDevelopmentHost(host: string) {
  const hostname = new URL(`http://${host}`).hostname;

  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

function appOrigin(request: Request, requestUrl: string) {
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const host = forwardedHost ?? firstHeaderValue(request.headers.get("host"));

  if (!host) {
    return new URL(requestUrl).origin;
  }

  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const protocol = forwardedProto ?? (isLocalDevelopmentHost(host) ? "http" : "https");

  return `${protocol}://${host}`;
}

function appRedirectUrl(request: Request, requestUrl: string, status: "success" | "error", redirectTarget: string) {
  const url = new URL("/", appOrigin(request, requestUrl));
  url.searchParams.set("auth", status);
  url.searchParams.set("target", redirectTarget === "checkout" ? "checkout" : "dashboard");

  return url;
}

function readRedirectTarget(value: string | null) {
  return value === "checkout" ? "checkout" : "dashboard";
}

function hasOAuthConfig(config: { clientId?: string; redirectUri?: string }): config is { clientId: string; redirectUri: string } {
  return Boolean(config.clientId && config.redirectUri);
}

export function startOAuth(request: Request, config: OAuthStartConfig) {
  if (!hasOAuthConfig(config)) {
    return NextResponse.json({ reason: "OAuth 설정을 확인해 주세요." }, { status: 503 });
  }

  const requestUrl = new URL(request.url);
  const state = createState();
  const redirectTarget = readRedirectTarget(requestUrl.searchParams.get("redirect"));
  const authorizeUrl = new URL(config.authorizeUrl);

  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", config.scope);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(`${oauthStateCookieName}_${config.provider}`, state, cookieOptions(oauthStateDurationSeconds));
  response.cookies.set(`${oauthRedirectCookieName}_${config.provider}`, redirectTarget, cookieOptions(oauthStateDurationSeconds));

  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const value: unknown = await response.json().catch(() => undefined);

  if (!response.ok || !isRecord(value)) {
    throw new Error("OAuth upstream request failed.");
  }

  return value as T;
}

async function fetchGoogleProfile(config: OAuthCallbackConfig, code: string): Promise<OAuthProfile> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId ?? "",
      client_secret: config.clientSecret ?? "",
      redirect_uri: config.redirectUri ?? "",
      code,
    }),
  });
  const token = await readJsonResponse<GoogleTokenResponse>(tokenResponse);

  if (!token.access_token) {
    throw new Error("Google access token was missing.");
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await readJsonResponse<GoogleProfileResponse>(profileResponse);

  if (!profile.sub) {
    throw new Error("Google profile id was missing.");
  }

  return { provider: "google", providerId: profile.sub, name: profile.name ?? profile.email ?? "Google user", email: profile.email };
}

async function fetchKakaoProfile(config: OAuthCallbackConfig, code: string): Promise<OAuthProfile> {
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId ?? "",
    redirect_uri: config.redirectUri ?? "",
    code,
  });

  if (config.clientSecret) {
    tokenBody.set("client_secret", config.clientSecret);
  }

  const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  const token = await readJsonResponse<KakaoTokenResponse>(tokenResponse);

  if (!token.access_token) {
    throw new Error("Kakao access token was missing.");
  }

  const profileResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await readJsonResponse<KakaoProfileResponse>(profileResponse);
  const providerId = profile.id?.toString();

  if (!providerId) {
    throw new Error("Kakao profile id was missing.");
  }

  const email = profile.kakao_account?.email;
  const name = profile.kakao_account?.profile?.nickname ?? profile.properties?.nickname ?? email ?? "Kakao user";

  return { provider: "kakao", providerId, name, email };
}

export async function finishOAuthCallback(request: Request, config: OAuthCallbackConfig) {
  if (!hasOAuthConfig(config)) {
    return NextResponse.json({ reason: "OAuth 설정을 확인해 주세요." }, { status: 503 });
  }

  const requestUrl = new URL(config.requestUrl);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const stateCookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${oauthStateCookieName}_${config.provider}=`))?.split("=")[1];
  const redirectCookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${oauthRedirectCookieName}_${config.provider}=`))?.split("=")[1];
  const redirectTarget = readRedirectTarget(redirectCookie ?? null);

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return NextResponse.redirect(appRedirectUrl(request, config.requestUrl, "error", redirectTarget));
  }

  try {
    const profile = config.provider === "google" ? await fetchGoogleProfile(config, code) : await fetchKakaoProfile(config, code);
    const user = await upsertOAuthUser(profile);
    const dbSession = await createDbSession(user.id, config.provider);
    const response = NextResponse.redirect(appRedirectUrl(request, config.requestUrl, "success", redirectTarget));

    response.cookies.set(`${oauthStateCookieName}_${config.provider}`, "", { ...cookieOptions(0), maxAge: 0 });
    response.cookies.set(`${oauthRedirectCookieName}_${config.provider}`, "", { ...cookieOptions(0), maxAge: 0 });

    return setSessionCookie(response, dbSession.token, dbSession.expiresAt, request);
  } catch {
    return NextResponse.redirect(appRedirectUrl(request, config.requestUrl, "error", redirectTarget));
  }
}
