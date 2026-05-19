"use client";

import { useEffect } from "react";
import { onboardingTotalSteps, stepNumbers } from "@/components/printy/shared/onboarding-progress";
import { AppButton, ProgressHeader, Screen, SoftCard } from "@/components/ui";
import type { Member, PaymentMethod } from "@/lib/types";
import { formatPrice, getOrderPriceAmount } from "@/store/printy-store-order";
import { usePrintyStore } from "@/store/use-printy-store";

export function CheckoutScreen() {
  const { brands, selectedBrandId, brandDraft, memberDraft, selectedBusinessCardMemberIds, orderOptions, selectedPaymentMethod, shippingInfo, selectPaymentMethod, updateShippingInfo, completeCheckout } = usePrintyStore();
  const brand = brands.find((item) => item.id === selectedBrandId);
  const selectedMembers = selectedBusinessCardMemberIds.map((memberId) => brand?.members.find((member) => member.id === memberId)).filter((member): member is Member => Boolean(member));
  const members = selectedMembers.length > 0 ? selectedMembers : [memberDraft];
  const paymentMethods: PaymentMethod[] = ["간편결제", "카드", "계좌이체"];
  const unitPrice = getOrderPriceAmount(orderOptions);
  const primaryMember = members[0] ?? memberDraft;
  const canCompleteCheckout = shippingInfo.recipientName.trim().length > 0 && shippingInfo.recipientPhone.trim().length > 0 && shippingInfo.address.trim().length > 0;
  const rows: Array<[string, string]> = [
    ["상품", `${brandDraft.name} 명함`],
    ["제작 대상", `${members.length}명`],
    ["수량", `각 ${orderOptions.quantity}매 · 총 ${Number(orderOptions.quantity) * members.length}매`],
    ["용지", orderOptions.paper],
    ["결제", selectedPaymentMethod],
    ["가격", formatPrice(unitPrice * members.length)],
  ];

  useEffect(() => {
    if (shippingInfo.recipientName || shippingInfo.recipientPhone || shippingInfo.address) {
      return;
    }

    updateShippingInfo("recipientName", primaryMember.name);
    updateShippingInfo("recipientPhone", primaryMember.phone || primaryMember.mainPhone);
    updateShippingInfo("address", primaryMember.address);
  }, [primaryMember.address, primaryMember.mainPhone, primaryMember.name, primaryMember.phone, shippingInfo.address, shippingInfo.recipientName, shippingInfo.recipientPhone, updateShippingInfo]);

  return (
    <Screen footer={<AppButton disabled={!canCompleteCheckout} onClick={completeCheckout}>결제하기</AppButton>}>
      <ProgressHeader eyebrow="결제 확인" title="마지막으로 주문 내용을 확인해요" description="명함 정보에 입력한 주소를 기본 배송지로 가져왔어요. 필요하면 수정해 주세요." step={stepNumbers.checkout} total={onboardingTotalSteps} />
      <div className="grid gap-4">
        {members.map((member) => (
          <SoftCard key={member.id || member.name}>
            <p className="text-sm font-black text-ink">{member.name} 명함</p>
            <p className="mt-2 text-xs font-bold leading-5 text-muted">AI 명함 목업에서 만든 인쇄용 PDF를 기준으로 주문해요.</p>
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
        <p className="mt-1 text-xs font-bold leading-5 text-muted">받는 분, 연락처, 주소는 필수예요.</p>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs font-black text-soft">
            받는 분
            <input className="rounded-md border border-line bg-white px-3 py-3 text-sm font-bold text-ink outline-none focus:border-primary" value={shippingInfo.recipientName} placeholder="받는 분 이름" onChange={(event) => updateShippingInfo("recipientName", event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-black text-soft">
            연락처
            <input className="rounded-md border border-line bg-white px-3 py-3 text-sm font-bold text-ink outline-none focus:border-primary" value={shippingInfo.recipientPhone} placeholder="010-0000-0000" onChange={(event) => updateShippingInfo("recipientPhone", event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-black text-soft">
            배송 주소
            <textarea className="min-h-20 rounded-md border border-line bg-white px-3 py-3 text-sm font-bold leading-6 text-ink outline-none focus:border-primary" value={shippingInfo.address} placeholder="배송 받을 주소" onChange={(event) => updateShippingInfo("address", event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-black text-soft">
            배송 메모
            <input className="rounded-md border border-line bg-white px-3 py-3 text-sm font-bold text-ink outline-none focus:border-primary" value={shippingInfo.memo} placeholder="문 앞에 놓아주세요 등" onChange={(event) => updateShippingInfo("memo", event.target.value)} />
          </label>
        </div>
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
