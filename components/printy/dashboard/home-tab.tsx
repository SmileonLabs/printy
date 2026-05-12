"use client";

import { BrandCard, DashboardHeader, DashboardSectionHeader, EmptyBrands } from "@/components/printy/dashboard/brands-tab";
import { SoftCard } from "@/components/ui";
import type { OrderRecord } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

export function HomeTab() {
  const { brands, orders, startNewBrand, openBrandDetail, setActiveTab } = usePrintyStore();

  return (
    <div className="pb-2">
      <DashboardHeader onStartNewBrand={startNewBrand} />
      <section className="mb-7 animate-float-in">
        <p className="text-3xl font-black leading-tight tracking-[-0.05em] text-ink">안녕하세요! 👋</p>
        <h1 className="mt-1 text-3xl font-black leading-tight tracking-[-0.05em] text-ink">
          오늘도 <span className="text-primary">브랜드를 빛내볼까요?</span>
        </h1>
        <p className="mt-3 max-w-xs text-sm font-semibold leading-6 text-muted">로고부터 명함, 배너까지 한 번에 만들고 주문하세요.</p>
      </section>
      <DashboardSectionHeader title="내 브랜드" action="전체 보기" onAction={() => setActiveTab("brands")} />
      {brands.length > 0 ? (
        <div className="mb-6 grid grid-cols-2 gap-3">
          {brands.slice(0, 4).map((brand) => (
            <BrandCard key={brand.id} brand={brand} onOpen={() => openBrandDetail(brand.id)} />
          ))}
        </div>
      ) : (
        <EmptyBrands onStartNewBrand={startNewBrand} />
      )}
      <BusinessCardPromoBanner />
      <DashboardSectionHeader title="최근 주문" action="전체 보기" className="mt-7" onAction={() => setActiveTab("orders")} />
      <div className="grid gap-3">
        {orders.length > 0 ? orders.map((order) => <RecentOrderRow key={order.id} order={order} />) : <EmptyOrders />}
      </div>
    </div>
  );
}

export function BusinessCardPromoBanner() {
  const brands = usePrintyStore((state) => state.brands);
  const openBrandDetail = usePrintyStore((state) => state.openBrandDetail);
  const setBrandSection = usePrintyStore((state) => state.setBrandSection);
  const startProduct = usePrintyStore((state) => state.startProduct);
  const latestBrand = brands[0];

  const handleStartBusinessCard = () => {
    if (latestBrand) {
      openBrandDetail(latestBrand.id);
      setBrandSection("cards");
      return;
    }

    startProduct("business-card");
  };

  return (
    <button className="relative block w-full overflow-hidden rounded-lg bg-[linear-gradient(135deg,var(--color-primary)_0%,var(--color-primary-strong)_100%)] p-5 text-left text-surface shadow-soft transition hover:-translate-y-0.5" type="button" onClick={handleStartBusinessCard}>
      <div className="relative z-10 max-w-52">
        <p className="mb-2 text-xs font-black text-surface/80">3분 만에 완성!</p>
        <h2 className="text-2xl font-black tracking-[-0.05em]">명함 바로 만들기</h2>
        <p className="mt-3 text-xs font-bold leading-5 text-surface/80">로고와 정보를 입력하면 자동으로 명함이 완성돼요.</p>
        <span className="mt-4 inline-block rounded-md bg-surface px-4 py-2 text-xs font-black text-primary-strong shadow-soft">
          명함 만들기 →
        </span>
      </div>
      <div className="absolute bottom-4 right-4 h-32 w-40" aria-hidden="true">
        <div className="absolute bottom-1 right-0 h-24 w-36 rotate-6 rounded-lg border border-surface/70 bg-surface/20 shadow-card" />
        <div className="absolute bottom-4 right-4 h-24 w-36 -rotate-6 rounded-lg border border-surface/70 bg-surface p-3 shadow-floating">
          <div className="mb-5 flex items-center justify-between">
            <span className="h-8 w-8 rounded-full bg-surface-blue" />
            <span className="h-2 w-14 rounded-md bg-primary-soft" />
          </div>
          <span className="block h-2 w-20 rounded-md bg-ink/20" />
          <span className="mt-2 block h-2 w-24 rounded-md bg-primary-soft" />
        </div>
      </div>
    </button>
  );
}

export function EmptyOrders() {
  return (
    <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] text-center">
      <p className="text-sm font-black text-ink">아직 저장된 주문이 없어요</p>
      <p className="mt-2 text-xs font-bold leading-5 text-muted">브랜드와 명함을 만들고 결제하면 최근 주문에 바로 표시돼요.</p>
    </SoftCard>
  );
}

export function RecentOrderRow({ order }: { order: OrderRecord }) {
  const statusClass = order.status === "paid" ? "bg-primary-soft text-primary-strong" : "bg-success/10 text-success";

  return (
    <SoftCard className="flex items-center justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-black text-ink">{order.title}</span>
          <span className={`rounded-md px-2 py-1 text-[10px] font-black ${statusClass}`}>{order.statusLabel}</span>
        </div>
        <p className="text-xs font-bold text-muted">{order.orderNumber} · {order.createdAt}</p>
      </div>
      <p className="shrink-0 text-sm font-black text-ink">{order.price}</p>
    </SoftCard>
  );
}
