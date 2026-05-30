"use client";

import Image from "next/image";
import { useState } from "react";
import { BrandDetail } from "@/components/printy/dashboard/brand-detail";
import { resolveLogoFromState } from "@/components/printy/logo/logo-state";
import { AppButton, ProgressHeader, SoftCard } from "@/components/ui";
import { LogoMark } from "@/components/ui/logo";
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

export function IconButton({ label, icon, onClick, badge = 0 }: { label: string; icon: "notification" | "plus"; onClick?: () => void; badge?: number }) {
  return (
    <button className="relative grid h-8 w-8 place-items-center rounded-full bg-surface text-ink transition duration-200 hover:-translate-y-0.5 hover:text-primary" type="button" aria-label={label} onClick={onClick}>
      {badge > 0 ? (
        <span className="absolute right-0 top-0 grid h-5 min-w-5 -translate-y-1/4 translate-x-1/4 place-items-center rounded-full bg-danger px-1 text-[10px] font-black text-white">
          {badge}
        </span>
      ) : null}
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
    <button className="group relative overflow-hidden rounded-lg bg-[#f3f4f6] p-3 text-left transition duration-200 hover:-translate-y-0.5" type="button" onClick={onOpen}>
      {"imageUrl" in logo && !imageFailed ? (
        <Image src={logo.imageUrl} alt="" width={512} height={512} sizes="(max-width: 430px) 50vw, 190px" className="h-auto w-full rounded-sm opacity-100 transition duration-300 group-hover:scale-105" unoptimized aria-hidden="true" onError={() => setImageFailed(true)} />
      ) : (
        <div className="grid aspect-square w-full place-items-center rounded-sm bg-[radial-gradient(circle_at_82%_12%,rgba(255,255,255,0.8)_0%,transparent_44%),linear-gradient(135deg,#f8fafc_0%,#e5e7eb_100%)]" aria-hidden="true">
          <div className="opacity-80 transition duration-300 group-hover:scale-105">
            <div className="scale-150">
              <LogoMark logo={logo} size="xl" />
            </div>
          </div>
        </div>
      )}
      <span className="mt-3 flex justify-end">
        <span className="flex items-start gap-3">
          <span className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-black text-primary-strong backdrop-blur-xl">{brand.category}</span>
        </span>
      </span>
    </button>
  );
}
