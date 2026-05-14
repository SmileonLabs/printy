"use client";

import { useState } from "react";
import Image from "next/image";
import { EmptyBrands } from "@/components/printy/dashboard/brands-tab";
import { resolveLogoFromState } from "@/components/printy/logo/logo-state";
import { BusinessCardPreview } from "@/components/printy/templates/business-card-preview";
import { AppButton, SoftCard, TextField } from "@/components/ui";
import { getLogo, LogoMark } from "@/components/ui/logo";
import { brandDetailSections, logoOptions } from "@/lib/mock-data";
import type { Brand, BrandAsset, BrandDetailSectionId, BusinessCardDraft, Member, OrderRecord, PrintTemplate, ResolvedLogoOption } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

type LogoWithImage = Extract<ResolvedLogoOption, { imageUrl: string }>;
type MemberFormValues = Pick<Member, "name" | "role" | "phone" | "mainPhone" | "fax" | "email" | "website" | "address">;

const emptyMemberFormValues: MemberFormValues = {
  name: "",
  role: "",
  phone: "",
  mainPhone: "",
  fax: "",
  email: "",
  website: "",
  address: "",
};

const memberFormFields: Array<{ label: string; field: keyof MemberFormValues; placeholder: string }> = [
  { label: "이름", field: "name", placeholder: "김하린" },
  { label: "직함", field: "role", placeholder: "대표" },
  { label: "휴대폰", field: "phone", placeholder: "010-0000-0000" },
  { label: "대표전화", field: "mainPhone", placeholder: "02-0000-0000" },
  { label: "팩스", field: "fax", placeholder: "02-0000-0001" },
  { label: "이메일", field: "email", placeholder: "hello@brand.kr" },
  { label: "웹도메인", field: "website", placeholder: "www.brand.kr" },
  { label: "주소", field: "address", placeholder: "서울시 성동구 프린티로 12" },
];

const brandMockupTemplates = [
  { id: "standing-sign", title: "실사형 입간판", description: "매장 앞 입간판에 로고 합성" },
  { id: "store-signboard", title: "매장 간판", description: "외부 간판에 로고 합성" },
  { id: "paper-card", title: "명함/종이", description: "고급 종이 인쇄물 목업" },
  { id: "cup-package", title: "컵/패키지", description: "컵과 포장재 실사 목업" },
  { id: "window-decal", title: "유리창 스티커", description: "매장 유리창 데칼 목업" },
];

function logoHasImage(logo: ResolvedLogoOption): logo is LogoWithImage {
  return "imageUrl" in logo;
}

function isClaimedSharedLogo(logo: ResolvedLogoOption) {
  return "shareLockedAt" in logo && typeof logo.shareLockedAt === "string";
}

function isBrandAsset(value: unknown): value is BrandAsset {
  return typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string" && typeof (value as { brandId?: unknown }).brandId === "string" && typeof (value as { title?: unknown }).title === "string" && typeof (value as { description?: unknown }).description === "string" && typeof (value as { createdAt?: unknown }).createdAt === "string";
}

function readBrandMockupAssetResponse(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const asset = (value as { asset?: unknown }).asset;

  return isBrandAsset(asset) ? asset : undefined;
}

function getBrandLogoIds(brand: Brand) {
  return Array.from(new Set([brand.selectedLogoId, ...(Array.isArray(brand.logoIds) ? brand.logoIds : [])]));
}

export function BrandDetail() {
  const { brands, businessCardDrafts, orders, brandAssets, templates, selectedBrandId, activeBrandSection, setBrandSection, startNewBrand } = usePrintyStore();
  const brand = brands.find((item) => item.id === selectedBrandId);
  const section = brandDetailSections.find((item) => item.id === activeBrandSection) ?? brandDetailSections[0];
  const logo = usePrintyStore((state) => resolveLogoFromState(state, brand?.selectedLogoId ?? logoOptions[0].id));

  if (!brand) {
    return (
      <div>
        <EmptyBrands onStartNewBrand={startNewBrand} />
      </div>
    );
  }

  const cardDraft = businessCardDrafts.find((draft) => draft.brandId === brand.id);
  const brandOrders = orders.filter((order) => order.brandId === brand.id);

  return (
    <div>
      <header className="mb-5">
        <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
          <div className="flex items-center gap-4">
            <LogoMark logo={logo} />
            <div>
              <p className="text-xs font-black text-primary-strong">브랜드 관리</p>
              <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-ink">{brand.name}</h1>
              <p className="mt-1 text-xs font-bold text-muted">{brand.category} · {brand.designRequest ? "자유 요청 저장" : "자동 요청"}</p>
            </div>
          </div>
        </SoftCard>
      </header>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
        {brandDetailSections.map((item) => (
          <button
            key={item.id}
            className={`shrink-0 rounded-md px-4 py-3 text-xs font-black transition ${activeBrandSection === item.id ? "bg-primary text-white shadow-soft" : "bg-surface-blue text-primary-strong"}`}
            type="button"
            onClick={() => setBrandSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <SectionPanel sectionId={section.id} title={section.label} summary={section.summary} brand={brand} cardDraft={cardDraft} businessCardDrafts={businessCardDrafts} orders={brandOrders} assets={brandAssets.filter((asset) => asset.brandId === brand.id)} templates={templates} />
    </div>
  );
}

export function SectionPanel({ sectionId, title, summary, brand, cardDraft, businessCardDrafts, orders, assets, templates }: { sectionId: BrandDetailSectionId; title: string; summary: string; brand: Brand; cardDraft?: BusinessCardDraft; businessCardDrafts: BusinessCardDraft[]; orders: OrderRecord[]; assets: BrandAsset[]; templates: PrintTemplate[] }) {
  const [shareStatus, setShareStatus] = useState("");
  const [mockupStatus, setMockupStatus] = useState("");
  const [generatingMockupSceneId, setGeneratingMockupSceneId] = useState<string>();
  const [mockupLogoId, setMockupLogoId] = useState<string>();
  const [teamNotice, setTeamNotice] = useState("");
  const brandLogo = usePrintyStore((state) => resolveLogoFromState(state, brand.selectedLogoId));
  const startBrandSectionProduction = usePrintyStore((state) => state.startBrandSectionProduction);
  const startAdditionalLogoForBrand = usePrintyStore((state) => state.startAdditionalLogoForBrand);
  const startLogoRevision = usePrintyStore((state) => state.startLogoRevision);
  const addBrandAssets = usePrintyStore((state) => state.addBrandAssets);
  const selectBrandLogo = usePrintyStore((state) => state.selectBrandLogo);
  const deleteBrandLogo = usePrintyStore((state) => state.deleteBrandLogo);
  const setBrandSection = usePrintyStore((state) => state.setBrandSection);
  const addBrandMember = usePrintyStore((state) => state.addBrandMember);
  const sectionAssets = assets.filter((asset) => asset.sectionId === sectionId);
  const hasDownloadableLogo = logoHasImage(brandLogo);
  const canShareLogo = hasDownloadableLogo && !isClaimedSharedLogo(brandLogo);
  const generatedLogoOptions = usePrintyStore((state) => state.generatedLogoOptions);
  const savedGeneratedLogoOptions = usePrintyStore((state) => state.savedGeneratedLogoOptions);
  const brandLogos = getBrandLogoIds(brand).map((logoId) => getLogo(logoId, [...generatedLogoOptions, ...savedGeneratedLogoOptions]));
  const mockupLogo = mockupLogoId ? brandLogos.find((item) => item.id === mockupLogoId) : undefined;

  const handleLogoShare = async () => {
    if (!logoHasImage(brandLogo)) {
      return;
    }

    setShareStatus("공유 페이지를 준비하고 있어요.");

    try {
      const response = await fetch("/api/logo-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brand.id, logoId: brandLogo.id }),
      });
      const payload: unknown = await response.json().catch(() => undefined);
      const token = typeof payload === "object" && payload !== null && "token" in payload && typeof payload.token === "string" ? payload.token : undefined;

      if (!response.ok || !token) {
        throw new Error("공유 페이지를 만들지 못했어요.");
      }

      const shareUrl = new URL(`/share/logos/${token}`, window.location.origin).toString();
      const shareText = `${brand.name} 대표 로고를 확인해 보세요.`;

      if (navigator.share) {
        await navigator.share({ title: `${brand.name} 로고`, text: shareText, url: shareUrl });
        setShareStatus("공유를 열었어요.");
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("공유 페이지 링크를 복사했어요.");
        return;
      }

      window.open(shareUrl, "_blank", "noopener,noreferrer");
      setShareStatus("새 창에서 공유 페이지를 열었어요.");
    } catch {
      setShareStatus("공유를 완료하지 못했어요.");
    }
  };

  const handleCreateBrandMockup = async (logo: ResolvedLogoOption, sceneId: string) => {
    if (!logoHasImage(logo)) {
      setMockupStatus("저장된 이미지 로고가 있어야 목업을 만들 수 있어요.");
      return;
    }

    setGeneratingMockupSceneId(sceneId);
    setMockupStatus("브랜드 목업을 만들고 있어요.");

    try {
      const response = await fetch("/api/brand-mockups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brand.id, brandName: brand.name, category: brand.category, logoImageUrl: logo.imageUrl, sceneId }),
      });
      const payload: unknown = await response.json().catch(() => undefined);
      const asset = readBrandMockupAssetResponse(payload);

      if (!response.ok || !asset) {
        throw new Error(typeof payload === "object" && payload !== null && typeof (payload as { reason?: unknown }).reason === "string" ? (payload as { reason: string }).reason : "브랜드 목업을 만들지 못했어요.");
      }

      addBrandAssets(brand.id, [asset]);
      setMockupStatus(`${asset.title} 목업을 만들었어요.`);
    } catch (error) {
      setMockupStatus(error instanceof Error ? error.message : "브랜드 목업을 만들지 못했어요.");
    } finally {
      setGeneratingMockupSceneId(undefined);
    }
  };

  const handleStartCardsProduction = (memberIds?: string[]) => {
    if (brand.members.length === 0) {
      setTeamNotice("팀원 1명 이상을 추가해 주세요.");
      setBrandSection("team");
      return;
    }

    startBrandSectionProduction(brand.id, "cards", memberIds);
  };

  const content = (() => {
    if (sectionId === "style") {
      if (mockupLogo) {
        return <MockupStudioPage logo={mockupLogo} assets={sectionAssets} mockupStatus={mockupStatus} generatingMockupSceneId={generatingMockupSceneId} onBack={() => setMockupLogoId(undefined)} onCreateBrandMockup={handleCreateBrandMockup} />;
      }

      return <StyleSection logo={brandLogo} logos={brandLogos} selectedLogoId={brand.selectedLogoId} canShareLogo={canShareLogo} shareStatus={shareStatus} onShare={handleLogoShare} onOpenMockupStudio={(logoId) => { setMockupStatus(""); setMockupLogoId(logoId); }} onStartAdditionalLogo={() => startAdditionalLogoForBrand(brand.id)} onStartLogoRevision={startLogoRevision} onSelectBrandLogo={(logoId) => selectBrandLogo(brand.id, logoId)} onDeleteBrandLogo={(logoId) => deleteBrandLogo(brand.id, logoId)} />;
    }

    if (sectionId === "team") {
      return <TeamSection members={brand.members} notice={teamNotice} onAddMember={(member) => { addBrandMember(brand.id, member); setTeamNotice(""); }} />;
    }

    if (sectionId === "cards") {
      return <CardsSection brand={brand} logo={brandLogo} businessCardDrafts={businessCardDrafts} orders={orders} templates={templates} onStartProduction={handleStartCardsProduction} />;
    }

    if (sectionId === "promotions" || sectionId === "banners" || sectionId === "signage") {
      return <ComingSoonSection />;
    }

    return <FilesSection cardDraft={cardDraft} orders={orders} assets={sectionAssets} />;
  })();

  if (sectionId === "style") {
    return (
      <div className="grid gap-5">
        <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black tracking-[-0.04em] text-ink">{title}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-muted">{summary}</p>
            </div>
          </div>
        </SoftCard>
        {content}
      </div>
    );
  }

  return (
    <SoftCard>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-[-0.04em] text-ink">{title}</h2>
          {sectionId === "cards" ? null : <p className="mt-2 text-sm font-medium leading-6 text-muted">{summary}</p>}
        </div>
      </div>
      {content}
    </SoftCard>
  );
}

function StyleSection({ logo, logos, selectedLogoId, canShareLogo, shareStatus, onShare, onOpenMockupStudio, onStartAdditionalLogo, onStartLogoRevision, onSelectBrandLogo, onDeleteBrandLogo }: { logo: ResolvedLogoOption; logos: ResolvedLogoOption[]; selectedLogoId: string; canShareLogo: boolean; shareStatus: string; onShare: () => void; onOpenMockupStudio: (logoId: string) => void; onStartAdditionalLogo: () => void; onStartLogoRevision: (logoId: string) => void; onSelectBrandLogo: (logoId: string) => void; onDeleteBrandLogo: (logoId: string) => void }) {
  const rows = [
    ["설명", logo.description],
  ];

  return (
    <div className="grid gap-5">
      <SoftCard className="bg-[linear-gradient(135deg,var(--color-surface-blue)_0%,var(--color-surface)_100%)]">
        <div className="grid gap-5">
          <LargeLogoPreview logo={logo} />
          <AppButton variant="secondary" onClick={onStartAdditionalLogo}>
            로고 하나 더 만들기
          </AppButton>
        </div>
      </SoftCard>
      <BrandLogoGallery logos={logos} selectedLogoId={selectedLogoId} onOpenMockupStudio={onOpenMockupStudio} onStartLogoRevision={onStartLogoRevision} onSelectBrandLogo={onSelectBrandLogo} onDeleteBrandLogo={onDeleteBrandLogo} />
      <div className="grid gap-3">
        {rows.map(([label, value]) => (
          <SoftCard key={label}>
            <p className="text-xs font-black text-soft">{label}</p>
            <p className="mt-1 text-sm font-medium leading-6 text-ink">{value}</p>
          </SoftCard>
        ))}
      </div>
      {canShareLogo ? (
        <SoftCard>
          <AppButton className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" variant="secondary" onClick={onShare}>
            공유하기
          </AppButton>
        </SoftCard>
      ) : null}
      {!logoHasImage(logo) ? <SoftCard className="bg-surface-blue text-xs font-bold leading-5 text-primary-strong">기본 제공 로고는 이미지 파일 링크가 없어 공유를 비활성화했어요.</SoftCard> : null}
      {isClaimedSharedLogo(logo) ? <SoftCard className="bg-surface-blue text-xs font-bold leading-5 text-primary-strong">이미 다른 계정에서 사용 확정된 공유 로고예요.</SoftCard> : null}
      {shareStatus ? <SoftCard className="bg-surface-blue text-xs font-bold leading-5 text-primary-strong">{shareStatus}</SoftCard> : null}
    </div>
  );
}

function BrandLogoGallery({ logos, selectedLogoId, onOpenMockupStudio, onStartLogoRevision, onSelectBrandLogo, onDeleteBrandLogo }: { logos: ResolvedLogoOption[]; selectedLogoId: string; onOpenMockupStudio: (logoId: string) => void; onStartLogoRevision: (logoId: string) => void; onSelectBrandLogo: (logoId: string) => void; onDeleteBrandLogo: (logoId: string) => void }) {
  if (logos.length === 0) {
    return null;
  }

  const imageLogoIds = new Set(logos.filter(logoHasImage).map((logo) => logo.id));
  const canDeleteAnyLogo = imageLogoIds.size > 1;

  const handleDeleteLogo = (logo: ResolvedLogoOption) => {
    if (!canDeleteAnyLogo) {
      return;
    }

    if (window.confirm(`${logo.name} 로고를 삭제할까요?`)) {
      onDeleteBrandLogo(logo.id);
    }
  };

  return (
    <SoftCard>
      <div className="mb-4">
        <p className="text-sm font-black text-ink">저장된 로고</p>
        <p className="mt-1 text-xs font-bold leading-5 text-muted">로고 이미지를 누르면 해당 로고로 목업을 만드는 별도 화면으로 이동해요.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {logos.map((item) => {
          const isSelected = item.id === selectedLogoId;
          const canDelete = logoHasImage(item) && canDeleteAnyLogo && !isSelected;

          return (
            <div key={item.id} className={`rounded-lg border bg-surface p-3 shadow-card ${isSelected ? "border-primary ring-4 ring-primary-soft" : "border-line"}`}>
              <div className="relative">
                <button className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-md bg-surface-blue text-left transition hover:ring-4 hover:ring-primary-soft" type="button" onClick={() => onOpenMockupStudio(item.id)} aria-label={`${item.name} 로고로 목업 만들기`}>
                  {logoHasImage(item) ? <Image src={item.imageUrl} alt={item.name} fill sizes="160px" className="object-contain p-2" unoptimized /> : <LogoMark logo={item} />}
                  <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-3 py-1 text-[10px] font-black text-primary-strong shadow-card">목업 만들기</span>
                </button>
                {canDelete ? <button className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-danger shadow-card transition hover:scale-105" type="button" aria-label={`${item.name} 로고 삭제`} onClick={() => handleDeleteLogo(item)} title="로고 삭제"><TrashIcon /></button> : null}
              </div>
              <p className="mt-3 text-xs font-black text-ink">{item.name}</p>
              <p className="mt-1 text-[11px] font-bold leading-4 text-muted">{item.label}</p>
              <AppButton className="mt-3 w-full disabled:cursor-default disabled:opacity-100 disabled:hover:translate-y-0" variant={isSelected ? "primary" : "secondary"} onClick={() => onSelectBrandLogo(item.id)} disabled={isSelected}>
                {isSelected ? "현재 대표 로고" : "대표로고로 선택"}
              </AppButton>
              {logoHasImage(item) ? (
                <AppButton className="mt-2 w-full" variant="secondary" onClick={() => onStartLogoRevision(item.id)}>
                  이 로고 수정하기
                </AppButton>
              ) : null}
            </div>
          );
        })}
      </div>
    </SoftCard>
  );
}

function MockupStudioPage({ logo, assets, mockupStatus, generatingMockupSceneId, onBack, onCreateBrandMockup }: { logo: ResolvedLogoOption; assets: BrandAsset[]; mockupStatus: string; generatingMockupSceneId?: string; onBack: () => void; onCreateBrandMockup: (logo: ResolvedLogoOption, sceneId: string) => void }) {
  return (
    <div className="grid gap-5">
      <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
        <button className="mb-4 text-xs font-black text-primary-strong" type="button" onClick={onBack}>
          ← 로고 목록으로
        </button>
        <div className="grid gap-4">
          <LargeLogoPreview logo={logo} />
          <div>
            <p className="text-lg font-black tracking-[-0.04em] text-ink">{logo.name} 목업 제작</p>
            <p className="mt-1 text-xs font-bold leading-5 text-muted">이 화면에서는 선택한 로고 하나만 기준으로 목업을 생성해요.</p>
          </div>
        </div>
      </SoftCard>
      <MockupTemplateList logo={logo} generatingMockupSceneId={generatingMockupSceneId} onCreateBrandMockup={onCreateBrandMockup} />
      {mockupStatus ? <SoftCard className="bg-surface-blue text-xs font-bold leading-5 text-primary-strong">{mockupStatus}</SoftCard> : null}
      <div className="grid gap-3">
        {assets.length > 0 ? <p className="px-1 text-sm font-black text-ink">생성된 목업</p> : null}
        {assets.map((asset) => (
          <SoftCard key={asset.id}>
            {asset.imageUrl ? (
              <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-md bg-surface-blue">
                <Image src={asset.imageUrl} alt={asset.title} fill sizes="(max-width: 430px) 100vw, 390px" className="object-cover" unoptimized />
              </div>
            ) : null}
            <p className="text-xs font-black text-soft">저장 목업</p>
            <p className="mt-1 text-sm font-black leading-6 text-ink">{asset.title} · {asset.createdAt}</p>
            <p className="mt-2 text-xs font-bold leading-5 text-muted">{asset.description}</p>
          </SoftCard>
        ))}
      </div>
    </div>
  );
}

function MockupTemplateList({ logo, generatingMockupSceneId, onCreateBrandMockup }: { logo: ResolvedLogoOption; generatingMockupSceneId?: string; onCreateBrandMockup: (logo: ResolvedLogoOption, sceneId: string) => void }) {
  const canGenerate = logoHasImage(logo);

  return (
    <SoftCard>
      <div className="mb-4">
        <p className="text-sm font-black text-ink">선택 로고 목업</p>
        <p className="mt-1 text-xs font-bold leading-5 text-muted">선택한 로고를 GPT 이미지 모델에 보내 실사형 목업을 생성해요.</p>
      </div>
      <div className="grid gap-2">
        {brandMockupTemplates.map((template) => {
          const isGenerating = generatingMockupSceneId === template.id;

          return (
            <button key={template.id} className="rounded-md border border-line bg-surface p-3 text-left shadow-card transition hover:border-primary-soft hover:bg-surface-blue disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={!canGenerate || Boolean(generatingMockupSceneId)} onClick={() => onCreateBrandMockup(logo, template.id)}>
              <span className="block text-sm font-black text-ink">{isGenerating ? "생성 중..." : template.title}</span>
              <span className="mt-1 block text-xs font-bold leading-5 text-muted">{template.description}</span>
            </button>
          );
        })}
      </div>
    </SoftCard>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 4h6m-8 4h10m-8 3v6m6-6v6M8 8l.6 11h6.8L16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LargeLogoPreview({ logo }: { logo: ResolvedLogoOption }) {
  if (logoHasImage(logo)) {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[linear-gradient(135deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] shadow-soft">
        <Image src={logo.imageUrl} alt={logo.name} fill sizes="(max-width: 430px) 100vw, 390px" className="object-cover" unoptimized />
      </div>
    );
  }

  return (
    <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg bg-[linear-gradient(135deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] shadow-soft">
      <div className="scale-[2.85]">
        <LogoMark logo={logo} size="xl" />
      </div>
    </div>
  );
}

function createMemberFromForm(values: MemberFormValues): Member {
  return {
    id: "",
    name: values.name.trim(),
    role: values.role.trim(),
    phone: values.phone.trim(),
    mainPhone: values.mainPhone.trim(),
    fax: values.fax.trim(),
    email: values.email.trim(),
    website: values.website?.trim() ?? "",
    address: values.address.trim(),
  };
}

function TeamSection({ members, notice, onAddMember }: { members: Member[]; notice: string; onAddMember: (member: Member) => void }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [memberForm, setMemberForm] = useState<MemberFormValues>(emptyMemberFormValues);
  const [formError, setFormError] = useState("");

  const updateMemberForm = (field: keyof MemberFormValues, value: string) => {
    setMemberForm((current) => ({ ...current, [field]: value }));
    if (field === "name" && value.trim().length > 0) {
      setFormError("");
    }
  };

  const handleSubmit = () => {
    const nextMember = createMemberFromForm(memberForm);

    if (!nextMember.name) {
      setFormError("이름을 입력해 주세요.");
      return;
    }

    onAddMember(nextMember);
    setMemberForm(emptyMemberFormValues);
    setFormError("");
    setIsFormOpen(false);
  };

  return (
    <div>
      {notice ? <p className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-xs font-bold leading-5 text-danger">{notice}</p> : null}
      {members.length > 0 ? (
        <div className="grid gap-3">
          {members.map((member) => (
          <div key={member.id} className="rounded-lg bg-surface-blue p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black tracking-[-0.04em] text-ink">{member.name}</p>
                <p className="mt-1 text-xs font-black text-primary-strong">{member.role}</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-black text-white shadow-soft">{member.name.slice(0, 1)}</span>
            </div>
            <div className="grid gap-2 text-xs font-bold leading-5 text-muted">
              <span>{member.phone}</span>
              <span>{member.email}</span>
              <span>{member.address}</span>
            </div>
          </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-surface-blue px-4 py-3 text-xs font-bold leading-5 text-primary-strong">아직 저장된 구성원이 없어요. 명함에 넣을 사람 정보를 추가해 주세요.</p>
      )}
      {isFormOpen ? (
        <div className="mt-5 grid gap-4 rounded-lg border border-line bg-surface p-4 shadow-card">
          <div>
            <p className="text-sm font-black text-ink">명함 정보 추가</p>
            <p className="mt-1 text-xs font-bold leading-5 text-muted">브랜드 로고가 적용될 명함 구성원 정보를 입력해 주세요.</p>
          </div>
          {memberFormFields.map((field) => (
                    <TextField key={field.field} label={field.label} placeholder={field.placeholder} value={memberForm[field.field] ?? ""} onChange={(value) => updateMemberForm(field.field, value)} />
          ))}
          {formError ? <p className="rounded-md bg-danger/10 px-4 py-3 text-xs font-bold leading-5 text-danger">{formError}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <AppButton variant="ghost" onClick={() => setIsFormOpen(false)}>
              취소
            </AppButton>
            <AppButton onClick={handleSubmit}>저장</AppButton>
          </div>
        </div>
      ) : (
        <AppButton className="mt-5" variant="secondary" onClick={() => setIsFormOpen(true)}>
          팀원 추가
        </AppButton>
      )}
    </div>
  );
}

function createBusinessCardPreviewMember(brand: Brand): Member {
  return brand.members[0] ?? {
    id: "preview-member",
    name: brand.name,
    role: brand.category,
    phone: "010-0000-0000",
    mainPhone: "02-0000-0000",
    fax: "02-0000-0001",
    email: "hello@printy.kr",
    address: "서울시 성동구 프린티로 12",
  };
}

type OrderedBusinessCard = {
  order: OrderRecord;
  draft: BusinessCardDraft;
  template: PrintTemplate;
  member: Member;
  logo: ResolvedLogoOption;
};

function CardsSection({ brand, logo, businessCardDrafts, orders, templates, onStartProduction }: { brand: Brand; logo: ResolvedLogoOption; businessCardDrafts: BusinessCardDraft[]; orders: OrderRecord[]; templates: PrintTemplate[]; onStartProduction: (memberIds?: string[]) => void }) {
  const printyState = usePrintyStore();
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(brand.members.map((member) => member.id));
  const previewMember = createBusinessCardPreviewMember(brand);
  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((current) => (current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]));
  };
  const handleStartProduction = () => {
    onStartProduction(selectedMemberIds.length > 0 ? selectedMemberIds : brand.members.map((member) => member.id));
  };
  const memberSelector = brand.members.length > 0 ? (
    <div className="grid gap-3 rounded-lg bg-surface-blue p-4 shadow-soft">
      <div>
        <p className="text-sm font-black text-ink">제작할 팀원 선택</p>
        <p className="mt-1 text-xs font-bold leading-5 text-muted">선택한 팀원마다 같은 디자인과 팀원별 수량으로 명함을 제작해요.</p>
      </div>
      <div className="grid gap-2">
        {brand.members.map((member) => (
          <label key={member.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3 transition ${selectedMemberIds.includes(member.id) ? "border-primary bg-white shadow-soft" : "border-line bg-surface"}`}>
            <span>
              <span className="block text-sm font-black text-ink">{member.name}</span>
              <span className="mt-1 block text-xs font-bold text-muted">{member.role || brand.category}</span>
            </span>
            <input className="h-5 w-5 accent-[var(--color-primary)]" type="checkbox" checked={selectedMemberIds.includes(member.id)} onChange={() => toggleMember(member.id)} />
          </label>
        ))}
      </div>
    </div>
  ) : null;
  const orderedBusinessCards = orders
    .filter((order) => order.status === "paid")
    .map((order) => {
      const draft = businessCardDrafts.find((item) => item.id === order.cardDraftId);

      if (!draft) {
        return null;
      }

      const templateId = order.templateId ?? draft.templateId;
      const template = templates.find((item) => item.id === templateId && item.productId === "business-card");

      if (!template) {
        return null;
      }

      return {
        order,
        draft,
        template,
        member: draft.member ?? previewMember,
        logo: draft.selectedLogoId ? resolveLogoFromState(printyState, draft.selectedLogoId) : logo,
      };
    })
    .filter((card): card is OrderedBusinessCard => card !== null);

  if (orderedBusinessCards.length === 0) {
    return (
      <div className="grid gap-5">
        <div className="rounded-lg bg-surface-blue p-5 text-center shadow-soft">
          <p className="text-base font-black text-ink">완료된 명함이 아직 없어요</p>
          <p className="mt-2 text-xs font-bold leading-5 text-muted">결제 완료된 명함이 생기면 이곳에서 다시 확인할 수 있어요.</p>
        </div>
        {memberSelector}
        <AppButton variant="secondary" onClick={handleStartProduction} disabled={brand.members.length > 0 && selectedMemberIds.length === 0} className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
          명함 제작하기
        </AppButton>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {orderedBusinessCards.map(({ order, draft, template, member, logo: cardLogo }) => (
        <div key={order.id} className="grid gap-4 rounded-lg border border-line bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-primary-strong">{order.orderNumber}</p>
              <h3 className="mt-1 text-lg font-black tracking-[-0.04em] text-ink">{template.title}</h3>
              <p className="mt-2 text-xs font-bold leading-5 text-muted">{member.name} · {draft.createdAt}</p>
            </div>
            <span className="shrink-0 rounded-md bg-surface-blue px-3 py-1 text-xs font-black text-primary-strong">{order.statusLabel}</span>
          </div>
          <div className="grid gap-4">
            <BusinessCardPreview brandName={brand.name} category={brand.category} member={member} logo={cardLogo} template={template} side="front" />
            {template.layout ? <BusinessCardPreview brandName={brand.name} category={brand.category} member={member} logo={cardLogo} template={template} side="back" /> : null}
          </div>
        </div>
      ))}
      {memberSelector}
      <AppButton variant="secondary" onClick={handleStartProduction} disabled={brand.members.length > 0 && selectedMemberIds.length === 0} className="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
        명함 제작하기
      </AppButton>
    </div>
  );
}

function ComingSoonSection() {
  return (
    <div className="rounded-lg bg-surface-blue p-5 text-center shadow-soft">
      <p className="text-base font-black text-ink">준비중입니다.</p>
    </div>
  );
}

function FilesSection({ cardDraft, orders, assets }: { cardDraft?: BusinessCardDraft; orders: OrderRecord[]; assets: BrandAsset[] }) {
  const rows = [
    ...(cardDraft ? [{ id: cardDraft.id, label: "명함 시안", value: `${cardDraft.brandName} · ${cardDraft.createdAt}` }] : []),
    ...orders.map((order) => ({ id: order.id, label: "주문 영수증", value: `${order.orderNumber} · ${order.statusLabel}` })),
    ...assets.map((asset) => ({ id: asset.id, label: asset.title, value: asset.createdAt })),
  ];

  return (
    <div className="grid gap-3">
      {rows.length > 0 ? rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 rounded-md bg-surface-blue p-4">
          <span className="text-xs font-black text-primary-strong">{row.label}</span>
          <span className="text-right text-sm font-black leading-5 text-ink">{row.value}</span>
        </div>
      )) : <div className="rounded-md bg-surface-blue p-4 text-sm font-black text-ink">저장된 항목이 아직 없어요</div>}
    </div>
  );
}
