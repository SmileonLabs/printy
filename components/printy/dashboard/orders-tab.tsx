"use client";

import { useState } from "react";
import { EmptyOrders } from "@/components/printy/dashboard/home-tab";
import { AppButton, ProgressHeader, SoftCard } from "@/components/ui";
import { isUserCancellableOrderStatus } from "@/lib/order-status";
import type { OrderRecord } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

function OrderDetailCard({ order }: { order: OrderRecord }) {
  const brand = usePrintyStore((state) => state.brands.find((item) => item.id === order.brandId));
  const draft = usePrintyStore((state) => state.businessCardDrafts.find((item) => item.id === order.cardDraftId));
  const template = usePrintyStore((state) => state.templates.find((item) => item.id === order.templateId));
  const openBrandDetail = usePrintyStore((state) => state.openBrandDetail);
  const cancelOrder = usePrintyStore((state) => state.cancelOrder);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const shippingInfo = order.shippingInfo;
  const rows = [
    ["브랜드", brand?.name ?? draft?.brandName ?? "삭제된 브랜드"],
    ["구성원", draft?.member.name ?? "-"],
    ["수량", `${order.quantity}매`],
    ["용지", order.paper],
    ["결제", order.paymentMethod],
    ["템플릿", template?.title ?? "기본 명함"],
    ["배송", shippingInfo ? `${shippingInfo.recipientName} · ${shippingInfo.recipientPhone}` : "배송 정보 없음"],
  ];

  const handleConfirmCancel = () => {
    cancelOrder(order.id);
    setIsCancelDialogOpen(false);
  };

  return (
    <SoftCard className="bg-white">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-base font-black tracking-[-0.03em] text-ink">{order.title}</h2>
            <span className="rounded-md bg-primary-soft px-2 py-1 text-[10px] font-black text-primary-strong">{order.statusLabel}</span>
          </div>
          <p className="text-xs font-bold text-muted">{order.orderNumber} · {order.createdAt}</p>
        </div>
        <p className="shrink-0 text-sm font-black text-ink">{order.price}</p>
      </div>
      <div className="grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-md bg-surface-blue px-3 py-2">
            <span className="text-[11px] font-black text-soft">{label}</span>
            <span className="text-xs font-black text-ink">{value}</span>
          </div>
        ))}
      </div>
      {shippingInfo?.address ? <p className="mt-3 rounded-md bg-surface-blue px-3 py-2 text-xs font-bold leading-5 text-muted">{shippingInfo.address}{shippingInfo.memo ? ` · ${shippingInfo.memo}` : ""}</p> : null}
      {isUserCancellableOrderStatus(order.status) ? (
        <AppButton className="mt-4 py-3 text-sm" variant="ghost" onClick={() => setIsCancelDialogOpen(true)}>
          주문 취소
        </AppButton>
      ) : null}
      {brand ? (
        <AppButton className="mt-3 py-3 text-sm" variant="secondary" onClick={() => openBrandDetail(brand.id)}>
          브랜드에서 확인
        </AppButton>
      ) : null}
      {isCancelDialogOpen ? <CancelOrderDialog orderNumber={order.orderNumber} onCancel={() => setIsCancelDialogOpen(false)} onConfirm={handleConfirmCancel} /> : null}
    </SoftCard>
  );
}

function CancelOrderDialog({ orderNumber, onCancel, onConfirm }: { orderNumber: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/45 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title">
      <div className="w-full rounded-t-[28px] bg-surface p-4 shadow-floating">
        <p className="text-xs font-black text-danger">주문 취소</p>
        <h2 id="cancel-order-title" className="mt-1 text-xl font-black tracking-[-0.04em] text-ink">주문을 취소할까요?</h2>
        <p className="mt-3 text-sm font-bold leading-6 text-muted">{orderNumber} 주문은 취소 후 입금 대기 상태로 되돌릴 수 없어요.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <AppButton variant="secondary" onClick={onCancel}>취소</AppButton>
          <AppButton onClick={onConfirm}>확인</AppButton>
        </div>
      </div>
    </div>
  );
}

export function OrdersTab() {
  const orders = usePrintyStore((state) => state.orders);

  return (
    <div>
      <ProgressHeader eyebrow="주문" title="주문내역" description="입금 대기, 주문 완료, 취소 상태를 계정의 브랜드와 명함 시안에 연결해서 보여줘요." />
      <div className="grid gap-3">
        {orders.length > 0 ? orders.map((order) => <OrderDetailCard key={order.id} order={order} />) : <EmptyOrders />}
      </div>
    </div>
  );
}
