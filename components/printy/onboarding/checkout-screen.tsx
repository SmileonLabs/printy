"use client";

import { resolveLogoFromState } from "@/components/printy/logo/logo-state";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { BusinessCardPreview } from "@/components/printy/templates/business-card-preview";
import { AppButton, ProgressHeader, Screen, SoftCard } from "@/components/ui";
import { resolveBusinessCardTemplate } from "@/lib/business-card-templates";
import type { Member, PaymentMethod } from "@/lib/types";
import { formatPrice, getOrderPriceAmount } from "@/store/printy-store-order";
import { usePrintyStore } from "@/store/use-printy-store";

export function CheckoutScreen() {
  const { brands, selectedBrandId, brandDraft, memberDraft, selectedBusinessCardMemberIds, selectedLogoId, orderOptions, selectedPaymentMethod, selectPaymentMethod, completeCheckout, businessCardDrafts, activeBusinessCardDraftId, selectedTemplateId } = usePrintyStore();
  const logo = usePrintyStore((state) => resolveLogoFromState(state, selectedLogoId));
  const activeDraft = businessCardDrafts.find((draft) => draft.id === activeBusinessCardDraftId);
  const template = usePrintyStore((state) => resolveBusinessCardTemplate(state.templates, activeDraft?.templateId ?? selectedTemplateId));
  const brand = brands.find((item) => item.id === selectedBrandId);
  const selectedMembers = selectedBusinessCardMemberIds.map((memberId) => brand?.members.find((member) => member.id === memberId)).filter((member): member is Member => Boolean(member));
  const members = selectedMembers.length > 0 ? selectedMembers : [memberDraft];
  const paymentMethods: PaymentMethod[] = ["간편결제", "카드", "계좌이체"];
  const unitPrice = getOrderPriceAmount(orderOptions);
  const rows: Array<[string, string]> = [
    ["상품", `${brandDraft.name} 명함`],
    ["템플릿", template?.title ?? "기본 명함"],
    ["제작 대상", `${members.length}명`],
    ["수량", `각 ${orderOptions.quantity}매 · 총 ${Number(orderOptions.quantity) * members.length}매`],
    ["용지", orderOptions.paper],
    ["결제", selectedPaymentMethod],
    ["가격", formatPrice(unitPrice * members.length)],
  ];

  return (
    <Screen footer={<AppButton onClick={completeCheckout}>결제하기</AppButton>}>
      <ProgressHeader eyebrow="결제 확인" title="마지막으로 주문 내용을 확인해요" description="결제와 배송은 데모 상태로 처리돼요. 완료하면 브랜드 대시보드가 열립니다." step={stepNumbers.checkout} total={onboardingTotalSteps} />
      <div className="grid gap-4">
        {members.map((member) => (
          <SoftCard key={member.id || member.name}>
            <p className="mb-3 text-sm font-black text-ink">{member.name} 명함</p>
            <div className="grid gap-3">
              <BusinessCardPreview brandName={brandDraft.name} category={brandDraft.category} member={member} logo={logo} options={orderOptions} template={template} side="front" />
              {template?.layout ? <BusinessCardPreview brandName={brandDraft.name} category={brandDraft.category} member={member} logo={logo} options={orderOptions} template={template} side="back" /> : null}
            </div>
          </SoftCard>
        ))}
      </div>
      <SoftCard className="mt-5">
        <p className="mb-2 text-sm font-black text-ink">주문 요약</p>
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-line py-3 last:border-b-0">
            <span className="text-sm font-bold text-muted">{label}</span>
            <span className="text-sm font-black text-ink">{value}</span>
          </div>
        ))}
      </SoftCard>
      <SoftCard className="mt-4">
        <p className="text-sm font-black text-ink">배송 정보</p>
        <p className="mt-3 text-sm font-bold leading-6 text-muted">{members[0]?.address ?? memberDraft.address}<br />받는 분 {members[0]?.name ?? memberDraft.name} · {members[0]?.phone ?? memberDraft.phone}</p>
      </SoftCard>
      <SoftCard className="mt-4">
        <p className="mb-3 text-sm font-black text-ink">결제 수단</p>
        <div className="grid grid-cols-3 gap-2">
          {paymentMethods.map((method) => (
            <button key={method} className={`rounded-md px-3 py-3 text-xs font-black transition ${selectedPaymentMethod === method ? "bg-primary text-white shadow-soft" : "bg-surface-blue text-primary-strong"}`} type="button" onClick={() => selectPaymentMethod(method)}>
              {method}
            </button>
          ))}
        </div>
      </SoftCard>
    </Screen>
  );
}
