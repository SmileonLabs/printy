"use client";

import { useEffect, useState, type FormEvent } from "react";
import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { hasBrandWorkspaceData, type BrandWorkspace } from "@/lib/brand-workspace";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { AppButton, ProgressHeader, Screen, SoftCard, TextField } from "@/components/ui";
import { usePrintyStore } from "@/store/use-printy-store";

type SessionApiResponse = {
  authenticated: boolean;
  session?: {
    user?: {
      id?: string;
      name?: string;
      contact?: string;
    };
    authenticatedAt?: string;
  };
  reason?: string;
};

function isSessionApiResponse(value: unknown): value is SessionApiResponse {
  return typeof value === "object" && value !== null && "authenticated" in value && typeof value.authenticated === "boolean";
}

function readCurrentWorkspace(): BrandWorkspace {
  const state = usePrintyStore.getState();

  return {
    brands: state.brands,
    brandAssets: state.brandAssets,
    savedGeneratedLogoOptions: state.savedGeneratedLogoOptions,
    businessCardDrafts: state.businessCardDrafts,
    printProductDrafts: state.printProductDrafts,
    orders: state.orders,
  };
}

export function LoginScreen() {
  const login = usePrintyStore((state) => state.login);
  const loginRedirectTarget = usePrintyStore((state) => state.loginRedirectTarget);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [claimLogoShareToken, setClaimLogoShareToken] = useState("");
  const redirectTarget = loginRedirectTarget ?? "dashboard";
  const isCheckoutLogin = redirectTarget === "checkout";
  const isShareClaimLogin = claimLogoShareToken.length > 0;
  const normalizedUserId = userId.trim().toLowerCase();
  const canSubmit = /^[a-z0-9][a-z0-9._-]{2,39}$/.test(normalizedUserId) && password.length >= 8 && status !== "loading";
  const helperText = isShareClaimLogin
    ? "공유 브랜드는 실제 소셜 계정으로만 소유권을 확정할 수 있어요."
    : status === "error"
      ? message
      : canSubmit
        ? authMode === "signup"
          ? "새 아이디로 계정을 만들어요. 이미 가입한 아이디라면 로그인으로 전환해 주세요."
          : "이미 가입한 아이디와 비밀번호로 로그인해요. 새 계정은 가입하기로 전환해 주세요."
        : "아이디는 영문/숫자 3자 이상, 비밀번호는 8자 이상 입력해 주세요.";
  const oauthClaimQuery = claimLogoShareToken ? `&claimLogoShare=${encodeURIComponent(claimLogoShareToken)}` : "";

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("claimLogoShare")?.trim() ?? "";

    setClaimLogoShareToken(/^[A-Za-z0-9_-]{24,80}$/.test(token) ? token : "");
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const workspace = readCurrentWorkspace();
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: normalizedUserId, password, mode: authMode, workspace: hasBrandWorkspaceData(workspace) ? workspace : undefined }),
      });
      const payload: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        const reason = isSessionApiResponse(payload) && payload.reason ? payload.reason : "로그인을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

        throw new Error(reason);
      }

      const session = isSessionApiResponse(payload) ? payload.session : undefined;

      login({ id: session?.user?.id, name: session?.user?.name ?? normalizedUserId, contact: session?.user?.contact ?? normalizedUserId, authenticatedAt: session?.authenticatedAt }, redirectTarget);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "로그인을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <Screen>
      <ProgressHeader eyebrow="계정 로그인" title={isShareClaimLogin ? "공유 브랜드를 내 계정에 추가해요" : isCheckoutLogin ? "주문을 저장할 계정을 만들어요" : "브랜드를 관리하세요"} description={isShareClaimLogin ? "가입하거나 로그인하면 공유받은 브랜드만 해당 계정에 추가됩니다." : isCheckoutLogin ? "아이디와 비밀번호로 가입하거나 기존 계정에 로그인해요." : "저장한 로고와 브랜드를 My Brand에서 바로 확인할 수 있어요."} step={stepNumbers.login} total={onboardingTotalSteps} action={<HomeExitAction />} />
      <form className="grid gap-4 pt-2" onSubmit={handleSubmit}>
        {isShareClaimLogin ? null : (
          <>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-blue p-1">
              <button className={`rounded-md px-3 py-2 text-sm font-black transition ${authMode === "login" ? "bg-white text-primary-strong shadow-soft" : "text-muted"}`} type="button" onClick={() => setAuthMode("login")}>
                로그인
              </button>
              <button className={`rounded-md px-3 py-2 text-sm font-black transition ${authMode === "signup" ? "bg-white text-primary-strong shadow-soft" : "text-muted"}`} type="button" onClick={() => setAuthMode("signup")}>
                가입하기
              </button>
            </div>
            <TextField label="아이디" placeholder="예: smileonlabs" value={userId} onChange={setUserId} />
            <TextField label="비밀번호" placeholder="8자 이상 입력" type="password" value={password} onChange={setPassword} />
          </>
        )}
        <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
          <p className="text-xs font-black text-primary-strong">{isShareClaimLogin ? "소셜 계정 필요" : "아이디 계정"}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-muted">{helperText}</p>
        </SoftCard>
        {isShareClaimLogin ? null : (
          <AppButton type="submit" disabled={!canSubmit} className="disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
            {status === "loading" ? "확인 중" : authMode === "signup" ? "가입하기" : "로그인"}
          </AppButton>
        )}
        <div className="grid gap-3">
          <a className="block rounded-md bg-ink px-5 py-4 text-center text-base font-extrabold text-white shadow-soft transition duration-200 hover:-translate-y-0.5" href={`/api/auth/google/start?redirect=${redirectTarget}${oauthClaimQuery}`}>
            Google로 계속하기
          </a>
          <a className="block rounded-md bg-[#fee500] px-5 py-4 text-center text-base font-extrabold text-[#191919] shadow-soft transition duration-200 hover:-translate-y-0.5" href={`/api/auth/kakao/start?redirect=${redirectTarget}${oauthClaimQuery}`}>
            Kakao로 계속하기
          </a>
        </div>
      </form>
    </Screen>
  );
}
