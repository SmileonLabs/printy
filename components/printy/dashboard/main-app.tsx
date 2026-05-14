"use client";

import { BrandsTab } from "@/components/printy/dashboard/brands-tab";
import { HomeTab } from "@/components/printy/dashboard/home-tab";
import { MyTab } from "@/components/printy/dashboard/my-tab";
import { NotificationsTab } from "@/components/printy/dashboard/notifications-tab";
import { OrdersTab } from "@/components/printy/dashboard/orders-tab";
import { TemplatesTab } from "@/components/printy/dashboard/templates-tab";
import { AppButton, BottomTabs, SoftCard } from "@/components/ui";
import { usePrintyStore } from "@/store/use-printy-store";

export function MainApp() {
  const activeTab = usePrintyStore((state) => state.activeTab);
  const setActiveTab = usePrintyStore((state) => state.setActiveTab);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="phone-scroll flex-1 overflow-y-auto px-5 pb-6 pt-2">
        <BackgroundLogoGenerationNotice />
        {activeTab === "home" ? <HomeTab /> : null}
        {activeTab === "brands" ? <BrandsTab /> : null}
        {activeTab === "templates" ? <TemplatesTab /> : null}
        {activeTab === "orders" ? <OrdersTab /> : null}
        {activeTab === "my" ? <MyTab /> : null}
        {activeTab === "notifications" ? <NotificationsTab /> : null}
      </div>
      <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}

function BackgroundLogoGenerationNotice() {
  const notice = usePrintyStore((state) => state.backgroundLogoGenerationNotice);
  const openGeneratedLogos = usePrintyStore((state) => state.openBackgroundGeneratedLogos);

  if (!notice) {
    return null;
  }

  return (
    <SoftCard className="mb-4 bg-surface-blue">
      <p className="text-xs font-black text-primary-strong">로고 생성</p>
      <p className="mt-1 text-sm font-black leading-6 text-ink">{notice.message}</p>
      {notice.status === "ready" ? (
        <AppButton className="mt-3" onClick={openGeneratedLogos}>
          생성된 로고 확인하기
        </AppButton>
      ) : null}
      {notice.status === "failed" ? <p className="mt-2 text-xs font-bold leading-5 text-danger">요청을 수정한 뒤 다시 시도해 주세요.</p> : null}
    </SoftCard>
  );
}
