"use client";

import { useEffect } from "react";
import { BrandsTab } from "@/components/printy/dashboard/brands-tab";
import { HomeTab } from "@/components/printy/dashboard/home-tab";
import { MyTab } from "@/components/printy/dashboard/my-tab";
import { NotificationsTab } from "@/components/printy/dashboard/notifications-tab";
import { OrdersTab } from "@/components/printy/dashboard/orders-tab";
import { TemplatesTab } from "@/components/printy/dashboard/templates-tab";
import { BottomTabs } from "@/components/ui";
import type { PrintTemplate } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPublicTemplatesResponse(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.templates)) {
    return [];
  }

  return value.templates.filter((template): template is PrintTemplate => isRecord(template) && typeof template.id === "string" && template.productId === "business-card");
}

export function MainApp() {
  const activeTab = usePrintyStore((state) => state.activeTab);
  const setActiveTab = usePrintyStore((state) => state.setActiveTab);
  const syncTemplates = usePrintyStore((state) => state.syncTemplates);

  useEffect(() => {
    let isActive = true;

    async function loadPublicTemplates() {
      const response = await fetch("/api/templates", { cache: "no-store" });

      if (!response.ok || !isActive) {
        return;
      }

      const data: unknown = await response.json().catch(() => undefined);
      syncTemplates(readPublicTemplatesResponse(data));
    }

    void loadPublicTemplates().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [syncTemplates]);

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
