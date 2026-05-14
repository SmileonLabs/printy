"use client";

import { useEffect, useState, type FormEvent } from "react";
import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
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

export function LoginScreen() {
  const login = usePrintyStore((state) => state.login);
  const loginRedirectTarget = usePrintyStore((state) => state.loginRedirectTarget);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [claimLogoShareToken, setClaimLogoShareToken] = useState("");
  const redirectTarget = loginRedirectTarget ?? "dashboard";
  const isCheckoutLogin = redirectTarget === "checkout";
  const isShareClaimLogin = claimLogoShareToken.length > 0;
  const canSubmit = name.trim().length > 0 && contact.trim().length > 0 && status !== "loading";
  const helperText = status === "error" ? message : canSubmit ? "입력한 정보는 서버 계정에 안전하게 저장됩니다." : "이름과 연락처를 모두 입력하면 계속할 수 있어요.";
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
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact }),
      });
      const payload: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        const reason = isSessionApiResponse(payload) && payload.reason ? payload.reason : "로그인을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

        throw new Error(reason);
      }

      const session = isSessionApiResponse(payload) ? payload.session : undefined;

      login({ id: session?.user?.id, name: session?.user?.name ?? name, contact: session?.user?.contact ?? contact, authenticatedAt: session?.authenticatedAt }, redirectTarget);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "로그인을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <Screen>
      <ProgressHeader eyebrow="간편 가입" title={isShareClaimLogin ? "공유 로고를 내 브랜드로 가져와요" : isCheckoutLogin ? "주문을 저장할 계정을 만들어요" : "브랜드 저장을 마무리해요"} description={isShareClaimLogin ? "가입하면 공유 페이지는 잠기고, 이 로고가 가입한 계정의 브랜드로 저장됩니다." : isCheckoutLogin ? "처음이면 자동 가입되고, 이미 가입한 정보면 바로 로그인됩니다." : "저장한 로고와 브랜드를 My Brand에서 바로 확인할 수 있어요."} step={stepNumbers.login} total={onboardingTotalSteps} action={<HomeExitAction />} />
      <form className="grid gap-4 pt-2" onSubmit={handleSubmit}>
        <TextField label="이름" placeholder="김하린" value={name} onChange={setName} />
        <TextField label="휴대폰 또는 이메일" placeholder="010-0000-0000 또는 hello@printy.kr" value={contact} onChange={setContact} />
        <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
          <p className="text-xs font-black text-primary-strong">간편 계정</p>
          <p className="mt-2 text-sm font-bold leading-6 text-muted">{helperText}</p>
        </SoftCard>
        <AppButton type="submit" disabled={!canSubmit} className="disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
          {status === "loading" ? "저장 중" : "간편 가입 / 로그인"}
        </AppButton>
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
