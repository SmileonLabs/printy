"use client";

import dynamic from "next/dynamic";

const AdminTemplateManager = dynamic(() => import("@/components/admin/admin-template-manager").then((module) => module.AdminTemplateManager), {
  loading: () => <main className="min-h-screen bg-[#f6f8fb] p-6 text-ink">관리자 도구를 불러오는 중이에요...</main>,
});

export function AdminTemplateManagerLoader() {
  return <AdminTemplateManager />;
}
