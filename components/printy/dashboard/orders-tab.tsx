"use client";

import { EmptyOrders } from "@/components/printy/dashboard/home-tab";
import { AppButton, ProgressHeader, SoftCard } from "@/components/ui";
import type { OrderRecord } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

function OrderDetailCard({ order }: { order: OrderRecord }) {
  const brand = usePrintyStore((state) => state.brands.find((item) => item.id === order.brandId));
  const draft = usePrintyStore((state) => state.businessCardDrafts.find((item) => item.id === order.cardDraftId));
  const template = usePrintyStore((state) => state.templates.find((item) => item.id === order.templateId));
  const openBrandDetail = usePrintyStore((state) => state.openBrandDetail);
  const rows = [
    ["브랜드", brand?.name ?? draft?.brandName ?? "삭제된 브랜드"],
    ["구성원", draft?.member.name ?? "-"],
    ["수량", `${order.quantity}매`],
    ["용지", order.paper],
    ["결제", order.paymentMethod],
    ["템플릿", template?.title ?? "기본 명함"],
  ];

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
      {brand ? (
        <AppButton className="mt-4 py-3 text-sm" variant="secondary" onClick={() => openBrandDetail(brand.id)}>
          브랜드에서 확인
        </AppButton>
      ) : null}
    </SoftCard>
  );
}

export function OrdersTab() {
  const orders = usePrintyStore((state) => state.orders);

  return (
    <div>
      <ProgressHeader eyebrow="주문" title="주문내역" description="결제 완료된 주문을 계정의 브랜드, 구성원, 명함 시안과 연결해서 보여줘요." />
      <div className="grid gap-3">
        {orders.length > 0 ? orders.map((order) => <OrderDetailCard key={order.id} order={order} />) : <EmptyOrders />}
      </div>
    </div>
  );
}
