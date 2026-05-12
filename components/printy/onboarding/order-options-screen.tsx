"use client";

import { HomeExitAction } from "@/components/printy/onboarding/home-exit-action";
import { Selector } from "@/components/printy/onboarding/selectors";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { AppButton, ProgressHeader, Screen, SoftCard } from "@/components/ui";
import { papers, quantities } from "@/lib/mock-data";
import { formatPrice, getOrderPriceAmount } from "@/store/printy-store-order";
import { usePrintyStore } from "@/store/use-printy-store";

export function OrderOptionsScreen() {
  const { orderOptions, selectedBusinessCardMemberIds, isAuthenticated, updateOrderOption, setStep } = usePrintyStore();
  const memberCount = Math.max(1, selectedBusinessCardMemberIds.length);
  const unitPrice = getOrderPriceAmount(orderOptions);
  const totalQuantity = Number(orderOptions.quantity) * memberCount;
  const handleNext = () => {
    if (isAuthenticated) {
      setStep("checkout");
      return;
    }

    setStep("login", "checkout");
  };

  return (
    <Screen footer={<AppButton onClick={handleNext}>다음으로</AppButton>}>
      <ProgressHeader eyebrow="주문 옵션" title="필요한 수량과 용지를 고르세요" description="Printy 추천 옵션을 기본으로 선택했어요. 클릭 몇 번으로 바로 주문할 수 있어요." step={stepNumbers.orderOptions} total={onboardingTotalSteps} action={<HomeExitAction />} />
      <div className="grid gap-5">
        <Selector title="수량" options={quantities} selected={orderOptions.quantity} onSelect={(value) => updateOrderOption("quantity", value)} />
        <Selector title="용지" options={papers} selected={orderOptions.paper} onSelect={(value) => updateOrderOption("paper", value)} />
        <SoftCard className="flex items-center justify-between bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
          <div>
            <p className="text-xs font-black text-primary-strong">예상 가격</p>
            <p className="mt-1 text-sm font-bold text-muted">팀원 {memberCount}명 · 각 {orderOptions.quantity}매 · 총 {Number.isFinite(totalQuantity) ? totalQuantity : orderOptions.quantity}매</p>
          </div>
          <p className="text-2xl font-black tracking-[-0.04em] text-ink">{formatPrice(unitPrice * memberCount)}</p>
        </SoftCard>
      </div>
    </Screen>
  );
}
