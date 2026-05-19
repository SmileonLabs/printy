"use client";

import { useEffect, useState } from "react";
import { resolveLogoFromState } from "@/components/printy/logo/logo-state";
import { AppButton, ProgressHeader, Screen, SoftCard } from "@/components/ui";
import { LogoMark } from "@/components/ui/logo";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import type { BankAccountSettings } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readBankAccount(value: unknown): BankAccountSettings | undefined {
  if (!isRecord(value) || !isRecord(value.bankAccount)) {
    return undefined;
  }

  const bankAccount = value.bankAccount;

  if (typeof bankAccount.bankName !== "string" || typeof bankAccount.accountNumber !== "string" || typeof bankAccount.accountHolder !== "string" || typeof bankAccount.memo !== "string") {
    return undefined;
  }

  return {
    bankName: bankAccount.bankName,
    accountNumber: bankAccount.accountNumber,
    accountHolder: bankAccount.accountHolder,
    memo: bankAccount.memo,
    updatedAt: typeof bankAccount.updatedAt === "string" ? bankAccount.updatedAt : undefined,
  };
}

export function SuccessScreen() {
  const [bankAccount, setBankAccount] = useState<BankAccountSettings>();
  const enterDashboard = usePrintyStore((state) => state.enterDashboard);
  const setStep = usePrintyStore((state) => state.setStep);
  const brandName = usePrintyStore((state) => state.brandDraft.name);
  const logo = usePrintyStore((state) => resolveLogoFromState(state, state.selectedLogoId));
  const lastOrder = usePrintyStore((state) => state.orders.find((order) => order.id === state.lastOrderId));
  const hasBankAccount = Boolean(bankAccount?.bankName && bankAccount.accountNumber && bankAccount.accountHolder);
  const visibleBankAccount = hasBankAccount ? bankAccount : undefined;

  useEffect(() => {
    let cancelled = false;

    fetch("/api/payment/bank-account", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((data: unknown) => {
        if (!cancelled) {
          setBankAccount(readBankAccount(data));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

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
          <ProgressHeader eyebrow="주문 접수" title="주문이 접수되었습니다" description={`${brandName} 브랜드 파일과 첫 명함 주문이 저장됐어요. 입금 확인 후 주문 완료 상태로 변경됩니다.`} step={stepNumbers.success} total={onboardingTotalSteps} />
          {lastOrder ? <p className="mx-auto mt-4 w-fit rounded-md bg-surface-blue px-4 py-2 text-sm font-black text-primary-strong">주문번호 {lastOrder.orderNumber}</p> : null}
          {visibleBankAccount ? (
            <SoftCard className="mx-auto mt-5 max-w-sm bg-white text-left">
              <p className="text-sm font-black text-ink">입금 계좌</p>
              <div className="mt-3 grid gap-2 text-sm font-bold leading-6 text-muted">
                <p>{visibleBankAccount.bankName} {visibleBankAccount.accountNumber}</p>
                <p>예금주 {visibleBankAccount.accountHolder}</p>
                {visibleBankAccount.memo ? <p>{visibleBankAccount.memo}</p> : null}
              </div>
            </SoftCard>
          ) : null}
        </div>
      </div>
    </Screen>
  );
}
