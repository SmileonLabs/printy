"use client";

import { AppButton, ProgressHeader, SoftCard } from "@/components/ui";
import { usePrintyStore } from "@/store/use-printy-store";

export function formatAuthDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function MyTab() {
  const { authSession, users, brands, businessCardDrafts, orders, savedGeneratedLogoOptions, logout } = usePrintyStore();
  const hasSession = authSession !== undefined && Boolean(authSession.userId && authSession.contact);

  if (!authSession || !hasSession) {
    return (
      <div>
        <ProgressHeader eyebrow="마이" title="프린티 계정" description="현재 로그인된 간편 계정이 없어요. 주문 단계에서 이름과 연락처로 바로 가입하거나 로그인할 수 있어요." />
        <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] text-center">
          <p className="text-sm font-black text-ink">로그아웃된 상태예요</p>
          <p className="mt-2 text-xs font-bold leading-5 text-muted">저장된 브랜드와 주문은 이 기기에 계속 보관됩니다.</p>
        </SoftCard>
      </div>
    );
  }

  const currentUser = users.find((user) => user.id === authSession.userId);
  const displayName = currentUser?.name ?? authSession.name;
  const displayContact = currentUser?.contact ?? authSession.contact;
  const rows: Array<[string, string]> = [
    ["이름", displayName],
    ["연락처", displayContact],
    ["최근 로그인", formatAuthDate(authSession.authenticatedAt)],
  ];
  const stats: Array<[string, string]> = [
    ["브랜드", `${brands.length}개`],
    ["명함 시안", `${businessCardDrafts.length}개`],
    ["주문", `${orders.length}건`],
    ["생성 로고", `${savedGeneratedLogoOptions.length}개`],
  ];
  const handleLogout = () => {
    fetch("/api/session", { method: "DELETE" }).finally(logout);
  };

  return (
    <div>
      <ProgressHeader eyebrow="마이" title="프린티 계정" description="현재 로그인된 계정의 브랜드, 명함 시안, 주문 데이터를 한곳에서 확인해요." />
      <SoftCard className="mb-4 bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
        <div className="mb-5 flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-xl font-black text-white shadow-soft">{displayName.slice(0, 1)}</span>
          <div>
            <p className="text-xs font-black text-primary-strong">간편 계정</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-ink">{displayName} 님</h2>
          </div>
        </div>
        <div className="grid gap-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-md bg-surface px-4 py-3">
              <span className="text-xs font-black text-soft">{label}</span>
              <span className="text-sm font-black text-ink">{value}</span>
            </div>
          ))}
        </div>
      </SoftCard>
      <div className="mb-4 grid grid-cols-2 gap-3">
        {stats.map(([label, value]) => (
          <SoftCard key={label} className="bg-white text-center">
            <p className="text-[11px] font-black text-soft">{label}</p>
            <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-ink">{value}</p>
          </SoftCard>
        ))}
      </div>
      <AppButton variant="secondary" onClick={handleLogout}>
        로그아웃
      </AppButton>
    </div>
  );
}
