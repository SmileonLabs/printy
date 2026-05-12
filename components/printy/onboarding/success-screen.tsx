"use client";

import { resolveLogoFromState } from "@/components/printy/logo/logo-state";
import { AppButton, ProgressHeader, Screen } from "@/components/ui";
import { LogoMark } from "@/components/ui/logo";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { usePrintyStore } from "@/store/use-printy-store";

export function SuccessScreen() {
  const enterDashboard = usePrintyStore((state) => state.enterDashboard);
  const setStep = usePrintyStore((state) => state.setStep);
  const brandName = usePrintyStore((state) => state.brandDraft.name);
  const logo = usePrintyStore((state) => resolveLogoFromState(state, state.selectedLogoId));
  const lastOrder = usePrintyStore((state) => state.orders.find((order) => order.id === state.lastOrderId));

  return (
    <Screen
      footer={
        <div className="grid gap-3">
          <AppButton onClick={enterDashboard}>내 브랜드로 이동</AppButton>
          <AppButton variant="secondary" onClick={() => setStep("orderOptions")}>
            명함 다시 주문
          </AppButton>
        </div>
      }
    >
      <div className="grid min-h-full place-items-center py-10 text-center">
        <div>
          <div className="mx-auto mb-8 grid h-32 w-32 place-items-center rounded-full bg-surface-blue shadow-soft">
            <LogoMark logo={logo} size="lg" />
          </div>
          <ProgressHeader eyebrow="주문 완료" title="주문이 완료되었습니다" description={`${brandName} 브랜드 파일과 첫 명함 주문이 저장됐어요. 이제 브랜드 탭에서 로고, 구성원, 홍보물을 이어서 관리할 수 있어요.`} step={stepNumbers.success} total={onboardingTotalSteps} />
          {lastOrder ? <p className="mx-auto mt-4 w-fit rounded-md bg-surface-blue px-4 py-2 text-sm font-black text-primary-strong">주문번호 {lastOrder.orderNumber}</p> : null}
        </div>
      </div>
    </Screen>
  );
}
