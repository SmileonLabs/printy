"use client";

import Image from "next/image";
import { useState } from "react";
import { BrandDetail } from "@/components/printy/dashboard/brand-detail";
import { resolveLogoFromState } from "@/components/printy/logo/logo-state";
import { AppButton, ProgressHeader, SoftCard } from "@/components/ui";
import { LogoMark, PrintyBrandLogo } from "@/components/ui/logo";
import type { Brand } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

export function BrandsTab() {
  const brandView = usePrintyStore((state) => state.brandView);
  return brandView === "detail" ? <BrandDetail /> : <BrandList />;
}

export function BrandList() {
  const { brands, startNewBrand, openBrandDetail } = usePrintyStore();

  return (
    <div className="pb-2">
      <DashboardHeader onStartNewBrand={startNewBrand} />
      <ProgressHeader eyebrow="브랜드" title="저장한 브랜드를 한눈에" description="로고, 구성원, 명함 시안과 주문 기록을 브랜드별로 이어서 관리하세요." />
      {brands.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {brands.map((brand) => (
            <BrandCard key={brand.id} brand={brand} onOpen={() => openBrandDetail(brand.id)} />
          ))}
        </div>
      ) : (
        <EmptyBrands onStartNewBrand={startNewBrand} />
      )}
    </div>
  );
}

export function EmptyBrands({ onStartNewBrand }: { onStartNewBrand: () => void }) {
  return (
    <SoftCard className="mb-6 bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] text-center">
      <p className="text-sm font-black text-ink">아직 저장된 브랜드가 없어요</p>
      <p className="mt-2 text-xs font-bold leading-5 text-muted">로고를 저장하면 이곳에 직접 만든 브랜드가 표시돼요.</p>
      <AppButton className="mt-4" variant="secondary" onClick={onStartNewBrand}>
        첫 브랜드 만들기
      </AppButton>
    </SoftCard>
  );
}

export function DashboardHeader({ onStartNewBrand }: { onStartNewBrand: () => void }) {
  const openNotifications = usePrintyStore((state) => state.openNotifications);
  const activityCount = usePrintyStore((state) => state.orders.length + state.brands.length + state.businessCardDrafts.length);

  return (
    <header className="mb-6 flex items-center justify-between">
      <PrintyBrandLogo size="sm" />
      <div className="flex items-center gap-2">
        <IconButton label={`활동 알림 보기${activityCount > 0 ? ` ${activityCount}개` : ""}`} icon="notification" onClick={openNotifications} />
        <IconButton label="새 브랜드 만들기" icon="plus" onClick={onStartNewBrand} />
      </div>
    </header>
  );
}

export function IconButton({ label, icon, onClick, badge = 0 }: { label: string; icon: "notification" | "plus"; onClick?: () => void; badge?: number }) {
  return (
    <button className="relative grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-ink shadow-card transition duration-200 hover:-translate-y-0.5 hover:text-primary" type="button" aria-label={label} onClick={onClick}>
      {badge > 0 ? <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-black text-white">{badge}</span> : null}
      {icon === "notification" ? (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6.8 10.4c0-3 2.3-5.4 5.2-5.4s5.2 2.4 5.2 5.4v2.8l1.5 2.4H5.3l1.5-2.4v-2.8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.8 18.2c.5.8 1.3 1.3 2.2 1.3s1.7-.5 2.2-1.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

export function DashboardSectionHeader({ title, action, onAction, className = "" }: { title: string; action: string; onAction: () => void; className?: string }) {
  return (
    <div className={`mb-3 flex items-center justify-between ${className}`}>
      <h2 className="text-lg font-black tracking-[-0.04em] text-ink">{title}</h2>
      <button className="rounded-md bg-surface-blue px-3 py-1 text-xs font-black text-primary-strong" type="button" onClick={onAction}>
        {action}
      </button>
    </div>
  );
}

export function BrandCard({ brand, onOpen }: { brand: Brand; onOpen: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const logo = usePrintyStore((state) => resolveLogoFromState(state, brand.selectedLogoId));

  return (
    <button className="group relative min-h-44 overflow-hidden rounded-lg border border-line bg-[#f3f4f6] p-4 text-left shadow-card transition duration-200 hover:-translate-y-0.5" type="button" onClick={onOpen}>
      {"imageUrl" in logo && !imageFailed ? (
        <Image src={logo.imageUrl} alt="" fill sizes="(max-width: 430px) 50vw, 190px" className="object-contain p-3 opacity-100 transition duration-300 group-hover:scale-105" unoptimized aria-hidden="true" onError={() => setImageFailed(true)} />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,rgba(255,255,255,0.8)_0%,transparent_44%),linear-gradient(135deg,#f8fafc_0%,#e5e7eb_100%)]" aria-hidden="true">
          <div className="absolute inset-0 grid place-items-center opacity-80 transition duration-300 group-hover:scale-105">
            <div className="scale-150">
              <LogoMark logo={logo} size="xl" />
            </div>
          </div>
        </div>
      )}
      <span className="relative z-10 flex min-h-36 justify-end">
        <span className="flex items-start gap-3">
          <span className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-black text-primary-strong shadow-soft backdrop-blur-xl">{brand.category}</span>
        </span>
      </span>
    </button>
  );
}
