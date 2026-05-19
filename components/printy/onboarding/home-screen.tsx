"use client";

import { AppButton, Screen } from "@/components/ui";
import { usePrintyStore } from "@/store/use-printy-store";

export function HomeScreen() {
  const setStep = usePrintyStore((state) => state.setStep);
  const startNewBrand = usePrintyStore((state) => state.startNewBrand);
  const startUploadedLogoForNewBrand = usePrintyStore((state) => state.startUploadedLogoForNewBrand);

  return (
    <Screen
      footer={
        <div className="grid gap-4">
          <AppButton onClick={startNewBrand}>아직 로고가 없어요</AppButton>
          <AppButton variant="secondary" onClick={startUploadedLogoForNewBrand}>로고가 있어요</AppButton>
          <div className="flex items-center justify-center gap-2 text-sm font-bold text-muted">
            <span>이전 주문을 이어가나요?</span>
            <button className="rounded-md px-2 py-1 font-black text-primary-strong transition hover:bg-surface-blue" type="button" onClick={() => setStep("login")}>
              로그인
            </button>
          </div>
        </div>
      }
    >
      <div className="relative -mx-5 -mb-6 -mt-2 flex min-h-[calc(100%+2rem)] flex-col justify-between overflow-hidden bg-[url('/bg.png')] bg-cover bg-center px-5 pb-11 pt-4">
        <div className="absolute inset-0 bg-white/38" aria-hidden="true" />
        <section className="relative animate-float-in pt-2">
          <p className="mb-4 text-xs font-black text-primary-strong">로고부터 인쇄물 제작, 주문까지</p>
          <h1 className="text-[clamp(2.25rem,10.5vw,3rem)] font-black leading-tight tracking-[-0.03em] text-ink">내 브랜드를 바로</h1>
          <h1 className="text-[clamp(2.25rem,10.5vw,3rem)] font-black leading-tight tracking-[-0.03em] text-ink">인쇄물로 만들어요</h1>
          <p className="mt-5 max-w-sm text-sm font-semibold leading-6 text-muted">브랜드 이름과 업종을 고르고, 원하는 디자인을 친구에게 말하듯 편하게 설명해 주세요. 자유롭게 적으면 원하시는 인쇄물 형태로 주문까지 이어져요.</p>
        </section>
      </div>
    </Screen>
  );
}
