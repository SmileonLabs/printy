"use client";

import { BrandsTab } from "@/components/printy/dashboard/brands-tab";
import { HomeTab } from "@/components/printy/dashboard/home-tab";
import { MyTab } from "@/components/printy/dashboard/my-tab";
import { NotificationsTab } from "@/components/printy/dashboard/notifications-tab";
import { OrdersTab } from "@/components/printy/dashboard/orders-tab";
import { TemplatesTab } from "@/components/printy/dashboard/templates-tab";
import { BottomTabs } from "@/components/ui";
import { usePrintyStore } from "@/store/use-printy-store";

export function MainApp() {
  const activeTab = usePrintyStore((state) => state.activeTab);
  const setActiveTab = usePrintyStore((state) => state.setActiveTab);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="phone-scroll flex-1 overflow-y-auto px-5 pb-6 pt-2">
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
