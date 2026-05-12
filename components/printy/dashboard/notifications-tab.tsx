"use client";

import { ProgressHeader, SoftCard } from "@/components/ui";
import { usePrintyStore } from "@/store/use-printy-store";

type ActivityNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  tone: "order" | "brand" | "draft";
};

function toneClass(tone: ActivityNotification["tone"]) {
  if (tone === "order") {
    return "bg-primary-soft text-primary-strong";
  }

  if (tone === "brand") {
    return "bg-success/10 text-success";
  }

  return "bg-surface-blue text-soft";
}

export function NotificationsTab() {
  const { brands, businessCardDrafts, orders } = usePrintyStore();
  const notifications: ActivityNotification[] = [
    ...orders.map((order) => ({
      id: `order-${order.id}`,
      title: "주문이 저장됐어요",
      message: `${order.title} 주문이 ${order.statusLabel} 상태로 저장됐어요.`,
      createdAt: order.createdAt,
      tone: "order" as const,
    })),
    ...brands.map((brand) => ({
      id: `brand-${brand.id}`,
      title: "브랜드가 준비됐어요",
      message: `${brand.name} 브랜드에 로고 ${brand.logoIds.length}개와 구성원 ${brand.members.length}명이 연결되어 있어요.`,
      createdAt: brand.createdAt,
      tone: "brand" as const,
    })),
    ...businessCardDrafts.map((draft) => ({
      id: `draft-${draft.id}`,
      title: "명함 시안이 저장됐어요",
      message: `${draft.member.name}님의 ${draft.brandName} 명함 시안을 이어서 주문할 수 있어요.`,
      createdAt: draft.createdAt,
      tone: "draft" as const,
    })),
  ];

  return (
    <div>
      <ProgressHeader eyebrow="알림" title="활동 알림" description="임시 메시지 대신 계정에 저장된 브랜드, 명함 시안, 주문 활동을 보여줘요." />
      <div className="grid gap-3">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <SoftCard key={notification.id} className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-sm font-black text-ink">{notification.title}</p>
                  <span className={`rounded-md px-2 py-1 text-[10px] font-black ${toneClass(notification.tone)}`}>실데이터</span>
                </div>
                <p className="text-xs font-bold leading-5 text-muted">{notification.message}</p>
              </div>
              <span className="shrink-0 text-xs font-black text-soft">{notification.createdAt}</span>
            </SoftCard>
          ))
        ) : (
          <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] text-center">
            <p className="text-sm font-black text-ink">아직 알림이 없어요</p>
            <p className="mt-2 text-xs font-bold leading-5 text-muted">제작이나 주문을 진행하면 여기에 표시돼요.</p>
          </SoftCard>
        )}
      </div>
    </div>
  );
}
