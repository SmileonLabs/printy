"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { EmptyBrands } from "@/components/printy/dashboard/brands-tab";
import { resolveLogoFromState } from "@/components/printy/logo/logo-state";
import { QrCodeImageField } from "@/components/printy/member-qr-code-image-field";
import { BusinessCardPreview } from "@/components/printy/templates/business-card-preview";
import { AppButton, SoftCard, TextAreaField, TextField } from "@/components/ui";
import { getLogo, LogoMark } from "@/components/ui/logo";
import { createAiBusinessCardMockupSignature, createAiBusinessCardRequestBody } from "@/lib/ai-business-card/client";
import type { AiBusinessCardDesign } from "@/lib/ai-business-card/schema";
import { createBusinessCardLayoutFromSelection, getBusinessCardLayoutOrientation } from "@/lib/business-card-layout-generator";
import { brandDetailSections } from "@/lib/mock-data";
import { readQrImageFile } from "@/lib/member-qr-image";
import type { ActiveBrandMockupJob, Brand, BrandAsset, BrandDetailSectionId, BusinessCardDraft, BusinessCardTemplateLayout, BusinessCardUserElementId, Member, OrderRecord, PrintTemplate, ResolvedLogoOption } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

type LogoWithImage = Extract<ResolvedLogoOption, { imageUrl: string }>;
type UserArchiveFile = {
  id: string;
  originalName: string;
  displayName: string;
  note: string;
  contentType: string;
  size: number;
  createdAt: string;
};
type MemberFormValues = Pick<Member, "name" | "role" | "phone" | "mainPhone" | "fax" | "email" | "website" | "address" | "account" | "titleLine1" | "titleLine2" | "adLine1" | "adLine2" | "instagram" | "qrCodeImageUrl">;
const emptyMemberFormValues: MemberFormValues = {
  name: "",
  role: "",
  phone: "",
  mainPhone: "",
  fax: "",
  email: "",
  website: "",
  address: "",
  account: "",
  titleLine1: "",
  titleLine2: "",
  adLine1: "",
  adLine2: "",
  instagram: "",
  qrCodeImageUrl: "",
};

const memberFormFields: Array<{ label: string; field: keyof MemberFormValues; placeholder: string; multiline?: boolean }> = [
  { label: "이름", field: "name", placeholder: "김하린" },
  { label: "직함", field: "role", placeholder: "대표" },
  { label: "전화번호", field: "phone", placeholder: "010-0000-0000" },
  { label: "대표전화", field: "mainPhone", placeholder: "02-0000-0000" },
  { label: "팩스", field: "fax", placeholder: "02-0000-0001" },
  { label: "이메일", field: "email", placeholder: "hello@brand.kr" },
  { label: "웹도메인", field: "website", placeholder: "www.brand.kr" },
  { label: "주소", field: "address", placeholder: "서울시 성동구 프린티로 12" },
  { label: "계좌번호", field: "account", placeholder: "국민 123456-04-123456" },
  { label: "한줄 제목 1", field: "titleLine1", placeholder: "믿고 맡기는 프린팅" },
  { label: "한줄 제목 2", field: "titleLine2", placeholder: "브랜드를 더 선명하게" },
  { label: "광고 내용 1", field: "adLine1", placeholder: "프리미엄 맞춤 제작\n빠르고 정확한 상담", multiline: true },
  { label: "광고 내용 2", field: "adLine2", placeholder: "브랜드를 더 선명하게\n문의는 언제든 환영해요", multiline: true },
  { label: "인스타그램", field: "instagram", placeholder: "@brand.official" },
];

const businessCardUserElements: Array<{ id: BusinessCardUserElementId; label: string }> = [
  { id: "name", label: "이름" },
  { id: "role", label: "직함" },
  { id: "phone", label: "전화번호" },
  { id: "mainPhone", label: "대표전화" },
  { id: "fax", label: "팩스" },
  { id: "email", label: "이메일" },
  { id: "website", label: "웹도메인" },
  { id: "address", label: "주소" },
  { id: "account", label: "계좌번호" },
  { id: "titleLine1", label: "한줄 제목 1" },
  { id: "titleLine2", label: "한줄 제목 2" },
  { id: "adLine1", label: "광고 문구 1" },
  { id: "adLine2", label: "광고 문구 2" },
  { id: "instagram", label: "인스타그램" },
  { id: "qrCode", label: "QR 코드" },
];

const defaultFrontBusinessCardElements: BusinessCardUserElementId[] = [];
const defaultBackBusinessCardElements: BusinessCardUserElementId[] = [];
const clientRequestTimeoutMs = 540_000;
const aiBusinessCardPdfRendererVersion = "pdf-template-bg-v20-fast-mockup";
type AiBusinessCardJobResponse =
  | { jobId: string; kind: "mockups" | "pdf"; status: "queued" | "running" }
  | { jobId: string; kind: "mockups"; status: "succeeded"; mockups: unknown[] }
  | { jobId: string; kind: "pdf"; status: "succeeded"; fileName: string; contentType: "application/pdf"; base64: string }
  | { jobId: string; kind: "mockups" | "pdf"; status: "failed" | "cancelled"; reason: string };

const brandMockupTemplates = [
  { id: "standing-sign", title: "실사형 입간판", description: "매장 앞 입간판에 로고 합성" },
  { id: "store-signboard", title: "매장 간판", description: "외부 간판에 로고 합성" },
  { id: "paper-card", title: "명함/종이", description: "고급 종이 인쇄물 목업" },
  { id: "cup-package", title: "컵/패키지", description: "컵과 포장재 실사 목업" },
  { id: "t-shirt", title: "티셔츠", description: "티셔츠 전면 로고 인쇄 목업" },
  { id: "mug-cup", title: "머그컵", description: "세라믹 머그컵 로고 인쇄 목업" },
  { id: "phone-case", title: "핸드폰 케이스", description: "스마트폰 케이스 로고 인쇄 목업" },
  { id: "window-decal", title: "유리창 스티커", description: "매장 유리창 데칼 목업" },
];

function logoHasImage(logo: ResolvedLogoOption): logo is LogoWithImage {
  return "imageUrl" in logo;
}

function isClaimedSharedLogo(logo: ResolvedLogoOption) {
  return "shareLockedAt" in logo && typeof logo.shareLockedAt === "string";
}

function readBrandMockupJobCreateResponse(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as { jobId?: unknown; status?: unknown };

  return typeof record.jobId === "string" && record.status === "queued" ? { jobId: record.jobId } : undefined;
}

function readApiErrorReason(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "reason" in value && typeof value.reason === "string" ? value.reason : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function savedAiBusinessCardMockupSignatureMatches(value: string | undefined, input: { brandName: string; logoId: string; members: Member[] }) {
  if (!value) {
    return false;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!isRecord(parsed) || parsed.brandName !== input.brandName || parsed.logoId !== input.logoId || !isRecord(parsed.member)) {
      return false;
    }

    const memberName = typeof parsed.member.name === "string" ? parsed.member.name.trim() : "";
    const memberPhone = typeof parsed.member.phone === "string" ? parsed.member.phone.trim() : "";

    return input.members.some((member) => member.name.trim() === memberName && member.phone.trim() === memberPhone);
  } catch {
    return false;
  }
}

function memberFromSavedAiBusinessCardMockupSignature(value: string | undefined, members: Member[]) {
  if (!value) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!isRecord(parsed) || !isRecord(parsed.member)) {
      return undefined;
    }

    const memberName = typeof parsed.member.name === "string" ? parsed.member.name.trim() : "";
    const memberPhone = typeof parsed.member.phone === "string" ? parsed.member.phone.trim() : "";

    return members.find((member) => member.name.trim() === memberName && member.phone.trim() === memberPhone);
  } catch {
    return undefined;
  }
}

function readDownloadFileName(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const asciiMatch = /filename="?([^";]+)"?/i.exec(disposition);

  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }

  return asciiMatch?.[1] ?? fallback;
}

function createPdfBlobUrl(blob: Blob) {
  const url = URL.createObjectURL(blob);

  window.setTimeout(() => URL.revokeObjectURL(url), 30 * 60_000);
  return url;
}

function createPdfBlobFromBase64(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: "application/pdf" });
}

function downloadPdfUrl(url: string, fileName: string) {
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), clientRequestTimeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readAiBusinessCardJob(response: Response) {
  const data: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(readApiErrorReason(data, "AI 명함 작업을 시작하지 못했어요."));
  }

  return data as AiBusinessCardJobResponse;
}

async function pollAiBusinessCardJob(jobId: string) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const response = await fetch(`/api/ai-business-cards/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
    const job = await readAiBusinessCardJob(response);

    if (job.status === "succeeded" || job.status === "failed" || job.status === "cancelled") {
      return job;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 3_000));
  }

  throw new Error("AI 명함 작업이 오래 걸리고 있어요. 잠시 후 다시 확인해 주세요.");
}

function getBrandLogoIds(brand: Brand) {
  return Array.from(new Set([...(Array.isArray(brand.logoIds) ? brand.logoIds : []), brand.selectedLogoId]));
}

function isUserArchiveFile(value: unknown): value is UserArchiveFile {
  return isRecord(value) && typeof value.id === "string" && typeof value.originalName === "string" && typeof value.displayName === "string" && typeof value.note === "string" && typeof value.contentType === "string" && typeof value.size === "number" && typeof value.createdAt === "string";
}

function readUserArchiveFilesResponse(value: unknown) {
  return isRecord(value) && Array.isArray(value.files) ? value.files.filter(isUserArchiveFile) : [];
}

function formatArchiveFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
  }

  if (size >= 1024) {
    return `${Math.ceil(size / 1024)}KB`;
  }

  return `${size}B`;
}

function formatArchiveDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ko-KR", { dateStyle: "short" });
}

function getMockupAssetsForLogo(assets: BrandAsset[], logoId: string, selectedLogoId: string) {
  return assets.filter((asset) => asset.logoId === logoId || (!asset.logoId && logoId === selectedLogoId));
}

export function BrandDetail() {
  const { brands, businessCardDrafts, orders, brandAssets, templates, selectedBrandId, activeBrandSection, setBrandSection, startNewBrand } = usePrintyStore();
  const deleteBrand = usePrintyStore((state) => state.deleteBrand);
  const brand = brands.find((item) => item.id === selectedBrandId);
  const section = brandDetailSections.find((item) => item.id === activeBrandSection) ?? brandDetailSections[0];
  if (!brand) {
    return (
      <div>
        <EmptyBrands onStartNewBrand={startNewBrand} />
      </div>
    );
  }

  const cardDraft = businessCardDrafts.find((draft) => draft.brandId === brand.id);
  const brandOrders = orders.filter((order) => order.brandId === brand.id);
  const handleDeleteBrand = () => {
    if (window.confirm(`${brand.name} 브랜드를 삭제할까요? 저장된 명함 초안과 주문 기록도 함께 삭제돼요.`)) {
      deleteBrand(brand.id);
    }
  };

  return (
    <div>
      <header className="mb-5">
        <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
          <div className="min-w-0">
            <p className="text-xs font-black text-primary-strong">브랜드 관리</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-ink">{brand.name}</h1>
            <p className="mt-1 text-xs font-bold text-muted">{brand.category} · {brand.designRequest ? "자유 요청 저장" : "자동 요청"}</p>
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
      <SoftCard className="mt-5 border border-danger/20 bg-danger/5">
        <p className="text-sm font-black text-danger">브랜드 삭제</p>
        <p className="mt-2 text-xs font-bold leading-5 text-muted">브랜드, 저장된 명함 초안, 주문 기록을 함께 삭제해요.</p>
        <AppButton className="mt-4 py-3 text-sm text-danger" variant="ghost" onClick={handleDeleteBrand}>브랜드 삭제</AppButton>
      </SoftCard>
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
  const startUploadedLogoForBrand = usePrintyStore((state) => state.startUploadedLogoForBrand);
  const startLogoRevision = usePrintyStore((state) => state.startLogoRevision);
  const activeBrandMockupJob = usePrintyStore((state) => state.activeBrandMockupJob);
  const setActiveBrandMockupJob = usePrintyStore((state) => state.setActiveBrandMockupJob);
  const selectBrandLogo = usePrintyStore((state) => state.selectBrandLogo);
  const deleteBrandLogo = usePrintyStore((state) => state.deleteBrandLogo);
  const setBrandSection = usePrintyStore((state) => state.setBrandSection);
  const addBrandMember = usePrintyStore((state) => state.addBrandMember);
  const updateBrandMember = usePrintyStore((state) => state.updateBrandMember);
  const deleteBrandMember = usePrintyStore((state) => state.deleteBrandMember);
  const sectionAssets = assets.filter((asset) => asset.sectionId === sectionId);
  const hasDownloadableLogo = logoHasImage(brandLogo);
  const canShareLogo = hasDownloadableLogo && !isClaimedSharedLogo(brandLogo);
  const generatedLogoOptions = usePrintyStore((state) => state.generatedLogoOptions);
  const savedGeneratedLogoOptions = usePrintyStore((state) => state.savedGeneratedLogoOptions);
  const brandLogos = getBrandLogoIds(brand).map((logoId) => getLogo(logoId, [...generatedLogoOptions, ...savedGeneratedLogoOptions]));
  const mockupLogo = mockupLogoId ? brandLogos.find((item) => item.id === mockupLogoId) : undefined;
  const activeGeneratingMockupJob = activeBrandMockupJob?.status === "generating" ? activeBrandMockupJob : undefined;

  useEffect(() => {
    if (!activeBrandMockupJob || activeBrandMockupJob.brandId !== brand.id) {
      setGeneratingMockupSceneId(undefined);
      return;
    }

    setMockupStatus(activeBrandMockupJob.message);

    if (activeBrandMockupJob.status === "generating") {
      setGeneratingMockupSceneId(activeBrandMockupJob.sceneId);
      return;
    }

    setGeneratingMockupSceneId(undefined);

    if (activeBrandMockupJob.status === "ready") {
      setMockupLogoId(activeBrandMockupJob.logoId);

      if (activeBrandMockupJob.assetId && assets.some((asset) => asset.id === activeBrandMockupJob.assetId)) {
        setActiveBrandMockupJob(undefined);
      }
    }
  }, [activeBrandMockupJob, assets, brand.id, setActiveBrandMockupJob]);

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
    if (activeGeneratingMockupJob) {
      setMockupStatus(activeGeneratingMockupJob.message);
      return;
    }

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
        body: JSON.stringify({ brandId: brand.id, logoId: logo.id, brandName: brand.name, category: brand.category, logoImageUrl: logo.imageUrl, sceneId }),
      });
      const payload: unknown = await response.json().catch(() => undefined);
      const job = readBrandMockupJobCreateResponse(payload);

      if (!response.ok || !job) {
        throw new Error(typeof payload === "object" && payload !== null && typeof (payload as { reason?: unknown }).reason === "string" ? (payload as { reason: string }).reason : "브랜드 목업을 만들지 못했어요.");
      }

      setActiveBrandMockupJob({ jobId: job.jobId, brandId: brand.id, logoId: logo.id, sceneId, status: "generating", message: "브랜드 목업을 백그라운드에서 만들고 있어요." });
      setMockupStatus("브랜드 목업을 백그라운드에서 만들고 있어요.");
    } catch (error) {
      setGeneratingMockupSceneId(undefined);
      setMockupStatus(error instanceof Error ? error.message : "브랜드 목업을 만들지 못했어요.");
    }
  };

  const handleStartCardsProduction = (memberIds?: string[], templateId?: string) => {
    if (brand.members.length === 0) {
      setTeamNotice("팀원 1명 이상을 추가해 주세요.");
      setBrandSection("team");
      return;
    }

    startBrandSectionProduction(brand.id, "cards", memberIds, templateId);
  };

  const content = (() => {
    if (sectionId === "style") {
      if (mockupLogo) {
        return <MockupStudioPage logo={mockupLogo} assets={getMockupAssetsForLogo(sectionAssets, mockupLogo.id, brand.selectedLogoId)} mockupStatus={mockupStatus} activeMockupJob={activeGeneratingMockupJob} generatingMockupSceneId={generatingMockupSceneId} onBack={() => setMockupLogoId(undefined)} onCreateBrandMockup={handleCreateBrandMockup} />;
      }

      return <StyleSection logo={brandLogo} logos={brandLogos} selectedLogoId={brand.selectedLogoId} canShareLogo={canShareLogo} shareStatus={shareStatus} mockupStatus={mockupStatus} onShare={handleLogoShare} onOpenMockupStudio={(logoId) => { setMockupStatus(generatingMockupSceneId ? mockupStatus : ""); setMockupLogoId(logoId); }} onStartAdditionalLogo={() => startAdditionalLogoForBrand(brand.id)} onStartUploadedLogo={() => startUploadedLogoForBrand(brand.id)} onStartLogoRevision={(logoId) => startLogoRevision(logoId, brand.id)} onSelectBrandLogo={(logoId) => selectBrandLogo(brand.id, logoId)} onDeleteBrandLogo={(logoId) => deleteBrandLogo(brand.id, logoId)} />;
    }

    if (sectionId === "team") {
      return <TeamSection members={brand.members} notice={teamNotice} onAddMember={(member) => { addBrandMember(brand.id, member); setTeamNotice(""); }} onUpdateMember={(memberId, member) => { updateBrandMember(brand.id, memberId, member); setTeamNotice(""); }} onDeleteMember={(memberId) => deleteBrandMember(brand.id, memberId)} />;
    }

    if (sectionId === "cards") {
      return <CardsSection brand={brand} logo={brandLogo} businessCardDrafts={businessCardDrafts} orders={orders} templates={templates} onStartProduction={handleStartCardsProduction} onAddMember={(member) => { addBrandMember(brand.id, member); setTeamNotice(""); }} onUpdateMember={(memberId, member) => { updateBrandMember(brand.id, memberId, member); setTeamNotice(""); }} onDeleteMember={(memberId) => deleteBrandMember(brand.id, memberId)} />;
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

function StyleSection({ logo, logos, selectedLogoId, canShareLogo, shareStatus, mockupStatus, onShare, onOpenMockupStudio, onStartAdditionalLogo, onStartUploadedLogo, onStartLogoRevision, onSelectBrandLogo, onDeleteBrandLogo }: { logo: ResolvedLogoOption; logos: ResolvedLogoOption[]; selectedLogoId: string; canShareLogo: boolean; shareStatus: string; mockupStatus: string; onShare: () => void; onOpenMockupStudio: (logoId: string) => void; onStartAdditionalLogo: () => void; onStartUploadedLogo: () => void; onStartLogoRevision: (logoId: string) => void; onSelectBrandLogo: (logoId: string) => void; onDeleteBrandLogo: (logoId: string) => void }) {
  const rows = [
    ["설명", logo.description],
  ];

  return (
    <div className="grid gap-5">
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
      {mockupStatus ? <SoftCard className="bg-surface-blue text-xs font-bold leading-5 text-primary-strong">{mockupStatus}</SoftCard> : null}
      {shareStatus ? <SoftCard className="bg-surface-blue text-xs font-bold leading-5 text-primary-strong">{shareStatus}</SoftCard> : null}
      <SoftCard className="bg-[linear-gradient(135deg,var(--color-surface-blue)_0%,var(--color-surface)_100%)]">
        <div className="grid gap-3">
          <AppButton variant="secondary" onClick={onStartAdditionalLogo}>
            로고 하나 더 만들기
          </AppButton>
          <AppButton variant="secondary" onClick={onStartUploadedLogo}>
            가지고 있는 로고 등록
          </AppButton>
        </div>
      </SoftCard>
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
      <div className="grid grid-cols-1 gap-3">
        {logos.map((item) => {
          const isSelected = item.id === selectedLogoId;
          const canDelete = logoHasImage(item) && canDeleteAnyLogo && !isSelected;

          return (
            <div key={item.id} className={`rounded-lg border bg-surface p-3 shadow-card ${isSelected ? "border-primary ring-4 ring-primary-soft" : "border-line"}`}>
              <div className="relative">
                <button className="relative grid w-full place-items-center overflow-hidden rounded-md bg-surface-blue p-2 text-left transition hover:ring-4 hover:ring-primary-soft" type="button" onClick={() => onOpenMockupStudio(item.id)} aria-label={`${item.name} 로고로 목업 만들기`}>
                  {logoHasImage(item) ? <Image src={item.imageUrl} alt={item.name} width={512} height={512} sizes="(max-width: 430px) 100vw, 390px" className="h-auto w-full rounded-sm" unoptimized /> : <div className="grid aspect-[4/3] w-full place-items-center"><LogoMark logo={item} /></div>}
                  <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-3 py-1 text-[10px] font-black text-primary-strong shadow-card">목업 만들기</span>
                </button>
                {canDelete ? <button className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-danger shadow-card transition hover:scale-105" type="button" aria-label={`${item.name} 로고 삭제`} onClick={() => handleDeleteLogo(item)} title="로고 삭제"><TrashIcon /></button> : null}
              </div>
              <p className="mt-3 text-xs font-black text-ink">{item.name}</p>
              <p className="mt-1 text-[11px] font-bold leading-4 text-muted">{item.label}</p>
              <AppButton className="mt-3 w-full px-2 py-3 text-[clamp(0.72rem,3.3vw,0.9rem)] disabled:cursor-default disabled:opacity-100 disabled:hover:translate-y-0" variant={isSelected ? "primary" : "secondary"} onClick={() => onSelectBrandLogo(item.id)} disabled={isSelected}>
                {isSelected ? "현재 대표 로고" : "대표로고로 선택"}
              </AppButton>
              {logoHasImage(item) ? (
                <AppButton className="mt-2 w-full px-2 py-3 text-[clamp(0.72rem,3.3vw,0.9rem)]" variant="secondary" onClick={() => onStartLogoRevision(item.id)}>
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

function MockupStudioPage({ logo, assets, mockupStatus, activeMockupJob, generatingMockupSceneId, onBack, onCreateBrandMockup }: { logo: ResolvedLogoOption; assets: BrandAsset[]; mockupStatus: string; activeMockupJob?: ActiveBrandMockupJob; generatingMockupSceneId?: string; onBack: () => void; onCreateBrandMockup: (logo: ResolvedLogoOption, sceneId: string) => void }) {
  return (
    <div className="grid gap-5">
      <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
        <button className="mb-4 text-xs font-black text-primary-strong" type="button" onClick={onBack}>
          ← 로고 목록으로
        </button>
        <div className="grid gap-4">
          <LargeLogoPreview logo={logo} />
          <GeneratedMockupList assets={assets} />
          <div>
            <p className="text-lg font-black tracking-[-0.04em] text-ink">{logo.name} 목업 제작</p>
            <p className="mt-1 text-xs font-bold leading-5 text-muted">이 화면에서는 선택한 로고 하나만 기준으로 목업을 생성해요.</p>
          </div>
        </div>
      </SoftCard>
      <MockupTemplateList logo={logo} activeMockupJob={activeMockupJob} generatingMockupSceneId={generatingMockupSceneId} onCreateBrandMockup={onCreateBrandMockup} />
      {mockupStatus ? <SoftCard className="bg-surface-blue text-xs font-bold leading-5 text-primary-strong">{mockupStatus}</SoftCard> : null}
    </div>
  );
}

function GeneratedMockupList({ assets }: { assets: BrandAsset[] }) {
  if (assets.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <p className="px-1 text-sm font-black text-ink">생성된 목업</p>
      {assets.map((asset) => (
        <div key={asset.id} className="rounded-lg bg-surface p-3 shadow-card">
          {asset.imageUrl ? (
            <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-md bg-surface-blue">
              <Image src={asset.imageUrl} alt={asset.title} fill sizes="(max-width: 430px) 100vw, 390px" className="object-cover" unoptimized />
            </div>
          ) : null}
          <p className="text-xs font-black text-soft">저장 목업</p>
          <p className="mt-1 text-sm font-black leading-6 text-ink">{asset.title} · {asset.createdAt}</p>
          <p className="mt-2 text-xs font-bold leading-5 text-muted">{asset.description}</p>
        </div>
      ))}
    </div>
  );
}

function MockupTemplateList({ logo, activeMockupJob, generatingMockupSceneId, onCreateBrandMockup }: { logo: ResolvedLogoOption; activeMockupJob?: ActiveBrandMockupJob; generatingMockupSceneId?: string; onCreateBrandMockup: (logo: ResolvedLogoOption, sceneId: string) => void }) {
  const canGenerate = logoHasImage(logo);
  const activeTemplate = brandMockupTemplates.find((template) => template.id === activeMockupJob?.sceneId);
  const isAnotherLogoGenerating = Boolean(activeMockupJob && activeMockupJob.logoId !== logo.id);

  return (
    <SoftCard>
      <div className="mb-4">
        <p className="text-sm font-black text-ink">선택 로고 목업</p>
        <p className="mt-1 text-xs font-bold leading-5 text-muted">선택한 로고를 AI 이미지 모델에 보내 실사형 목업을 생성해요.</p>
        {activeMockupJob ? <p className="mt-2 rounded-md bg-surface-blue px-3 py-2 text-xs font-black leading-5 text-primary-strong">{isAnotherLogoGenerating ? "다른 로고의" : activeTemplate ? `${activeTemplate.title}` : "선택한"} 목업을 만들고 있어요. 완료 후 새 목업을 만들 수 있어요.</p> : null}
      </div>
      <div className="grid gap-2">
        {brandMockupTemplates.map((template) => {
          const isGenerating = generatingMockupSceneId === template.id;

          return (
            <button key={template.id} className="rounded-md border border-line bg-surface p-3 text-left shadow-card transition hover:border-primary-soft hover:bg-surface-blue disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={!canGenerate || Boolean(activeMockupJob)} onClick={() => onCreateBrandMockup(logo, template.id)}>
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
      <div className="w-full overflow-hidden rounded-lg bg-[linear-gradient(135deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)] p-3 shadow-soft">
        <Image src={logo.imageUrl} alt={logo.name} width={1024} height={1024} sizes="(max-width: 430px) 100vw, 390px" className="h-auto w-full rounded-md" unoptimized />
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
    account: values.account?.trim() ?? "",
    titleLine1: values.titleLine1?.trim() ?? "",
    titleLine2: values.titleLine2?.trim() ?? "",
    adLine1: values.adLine1?.trim() ?? "",
    adLine2: values.adLine2?.trim() ?? "",
    instagram: values.instagram?.trim() ?? "",
    qrCodeImageUrl: values.qrCodeImageUrl?.trim() ?? "",
  };
}

function memberFormValuesFromMember(member: Member): MemberFormValues {
  return {
    name: member.name,
    role: member.role,
    phone: member.phone,
    mainPhone: member.mainPhone,
    fax: member.fax,
    email: member.email,
    website: member.website ?? "",
    address: member.address,
    account: member.account ?? "",
    titleLine1: member.titleLine1 ?? "",
    titleLine2: member.titleLine2 ?? "",
    adLine1: member.adLine1 ?? "",
    adLine2: member.adLine2 ?? "",
    instagram: member.instagram ?? "",
    qrCodeImageUrl: member.qrCodeImageUrl ?? "",
  };
}

function TeamSection({ members, notice, onAddMember, onUpdateMember, onDeleteMember }: { members: Member[]; notice: string; onAddMember: (member: Member) => void; onUpdateMember: (memberId: string, member: Member) => void; onDeleteMember: (memberId: string) => void }) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [memberForm, setMemberForm] = useState<MemberFormValues>(emptyMemberFormValues);
  const [formError, setFormError] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string>();

  const updateMemberForm = (field: keyof MemberFormValues, value: string) => {
    setMemberForm((current) => ({ ...current, [field]: value }));
    if (field === "name" && value.trim().length > 0) {
      setFormError("");
    }
  };
  const updateQrCodeImage = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      const imageUrl = await readQrImageFile(file);
      setMemberForm((current) => ({ ...current, qrCodeImageUrl: imageUrl }));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "QR 이미지를 읽지 못했어요.");
    }
  };

  const handleSubmit = () => {
    const nextMember = createMemberFromForm(memberForm);

    if (!nextMember.name) {
      setFormError("이름을 입력해 주세요.");
      return;
    }

    if (editingMemberId) {
      onUpdateMember(editingMemberId, nextMember);
    } else {
      onAddMember(nextMember);
    }

    setMemberForm(emptyMemberFormValues);
    setFormError("");
    setEditingMemberId(undefined);
    setIsFormOpen(false);
  };

  const openAddForm = () => {
    setEditingMemberId(undefined);
    setMemberForm(emptyMemberFormValues);
    setFormError("");
    setIsFormOpen(true);
  };

  const openEditForm = (member: Member) => {
    setEditingMemberId(member.id);
    setMemberForm(memberFormValuesFromMember(member));
    setFormError("");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingMemberId(undefined);
    setMemberForm(emptyMemberFormValues);
    setFormError("");
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
            <div className="mt-4 grid grid-cols-2 gap-2">
              <AppButton className="py-3 text-sm" variant="secondary" onClick={() => openEditForm(member)}>
                수정
              </AppButton>
              <AppButton className="py-3 text-sm" variant="ghost" onClick={() => onDeleteMember(member.id)}>
                삭제
              </AppButton>
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
            <p className="text-sm font-black text-ink">{editingMemberId ? "명함 정보 수정" : "명함 정보 추가"}</p>
            <p className="mt-1 text-xs font-bold leading-5 text-muted">브랜드 로고가 적용될 명함 구성원 정보를 입력해 주세요.</p>
          </div>
          {memberFormFields.map((field) => (field.multiline ? <TextAreaField key={field.field} label={field.label} placeholder={field.placeholder} value={memberForm[field.field] ?? ""} onChange={(value) => updateMemberForm(field.field, value)} /> : <TextField key={field.field} label={field.label} placeholder={field.placeholder} value={memberForm[field.field] ?? ""} onChange={(value) => updateMemberForm(field.field, value)} />))}
          <QrCodeImageField value={memberForm.qrCodeImageUrl ?? ""} onChange={updateQrCodeImage} onClear={() => updateMemberForm("qrCodeImageUrl", "")} />
          {formError ? <p className="rounded-md bg-danger/10 px-4 py-3 text-xs font-bold leading-5 text-danger">{formError}</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <AppButton variant="ghost" onClick={closeForm}>
              취소
            </AppButton>
            <AppButton onClick={handleSubmit}>저장</AppButton>
          </div>
        </div>
      ) : (
        <AppButton className="mt-5" variant="secondary" onClick={openAddForm}>
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
    account: "국민 123456-04-123456",
    titleLine1: "믿고 맡기는 프린팅",
    titleLine2: "브랜드를 더 선명하게",
    adLine1: "프리미엄 맞춤 제작",
    adLine2: "빠르고 정확한 상담",
    instagram: "@printy.official",
    qrCodeImageUrl: "",
  };
}

function isSelectableBusinessCardElementId(elementId: string): elementId is BusinessCardUserElementId {
  return businessCardUserElements.some((item) => item.id === elementId);
}

function businessCardElementHasInputValue(elementId: BusinessCardUserElementId, brand: Brand, members: Member[]) {
  if (elementId === "logo") {
    return false;
  }

  if (elementId === "brandName") {
    return brand.name.trim().length > 0;
  }

  if (elementId === "category") {
    return brand.category.trim().length > 0;
  }

  if (elementId === "instagramIcon") {
    return members.some((member) => (member.instagram ?? "").trim().length > 0);
  }

  if (elementId === "qrCode") {
    return members.some((member) => (member.qrCodeImageUrl ?? "").trim().length > 0);
  }

  const memberField = elementId as keyof Pick<Member, "name" | "role" | "phone" | "mainPhone" | "fax" | "email" | "website" | "address" | "account" | "titleLine1" | "titleLine2" | "adLine1" | "adLine2" | "instagram">;

  return members.some((member) => typeof member[memberField] === "string" && member[memberField].trim().length > 0);
}

function businessCardElementsWithInputValues(brand: Brand, members: Member[]) {
  return businessCardUserElements.filter((item) => businessCardElementHasInputValue(item.id, brand, members)).map((item) => item.id);
}

function selectableBusinessCardElements(elements: BusinessCardUserElementId[]) {
  return elements.filter(isSelectableBusinessCardElementId);
}

function visibleBusinessCardElements(layout: BusinessCardTemplateLayout, sideId: "front" | "back"): BusinessCardUserElementId[] {
  return layout.sides[sideId].fields.filter((field) => field.visible).map((field) => field.id);
}

type OrderedBusinessCard = {
  order: OrderRecord;
  draft: BusinessCardDraft;
  template: PrintTemplate;
  member: Member;
  logo: ResolvedLogoOption;
};

function CardsSection({ brand, logo, businessCardDrafts, orders, templates, onStartProduction, onAddMember, onUpdateMember, onDeleteMember }: { brand: Brand; logo: ResolvedLogoOption; businessCardDrafts: BusinessCardDraft[]; orders: OrderRecord[]; templates: PrintTemplate[]; onStartProduction: (memberIds?: string[], templateId?: string) => void; onAddMember: (member: Member) => void; onUpdateMember: (memberId: string, member: Member) => void; onDeleteMember: (memberId: string) => void }) {
  const printyState = usePrintyStore();
  const productionOptions = usePrintyStore((state) => state.businessCardProductionOptions);
  const selectedTemplateId = usePrintyStore((state) => state.selectedTemplateId);
  const aiBusinessCardMockups = usePrintyStore((state) => state.aiBusinessCardMockups);
  const aiBusinessCardMockupSignature = usePrintyStore((state) => state.aiBusinessCardMockupSignature);
  const updateBusinessCardProductionOptions = usePrintyStore((state) => state.updateBusinessCardProductionOptions);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(brand.members.map((member) => member.id));
  const [frontElements, setFrontElements] = useState<BusinessCardUserElementId[]>(productionOptions.frontElements.length > 0 ? selectableBusinessCardElements(productionOptions.frontElements) : defaultFrontBusinessCardElements);
  const [backElements, setBackElements] = useState<BusinessCardUserElementId[]>(productionOptions.backElements.length > 0 ? selectableBusinessCardElements(productionOptions.backElements) : defaultBackBusinessCardElements);
  const selectedColor = productionOptions.color;
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [memberForm, setMemberForm] = useState<MemberFormValues>(emptyMemberFormValues);
  const [editingMemberId, setEditingMemberId] = useState<string>();
  const [memberFormError, setMemberFormError] = useState("");
  const [productionNotice, setProductionNotice] = useState("");
  const [hasAppliedSuggestedElements, setHasAppliedSuggestedElements] = useState(false);
  const [runningMockupPdfId, setRunningMockupPdfId] = useState<string>();
  const [mockupPdfErrors, setMockupPdfErrors] = useState<Record<string, string>>({});
  const [mockupPdfRecords, setMockupPdfRecords] = useState<Record<string, { url: string; fileName: string }>>({});
  const [selectedSavedLayoutDraftId, setSelectedSavedLayoutDraftId] = useState("");
  const previewMember = createBusinessCardPreviewMember(brand);
  const selectedMembers = useMemo(() => brand.members.filter((member) => selectedMemberIds.includes(member.id)), [brand.members, selectedMemberIds]);
  const suggestedBusinessCardElements = useMemo(() => businessCardElementsWithInputValues(brand, selectedMembers.length > 0 ? selectedMembers : brand.members), [brand, selectedMembers]);
  const savedLayoutDrafts = useMemo(() => businessCardDrafts.filter((draft) => draft.brandId === brand.id && Boolean(draft.layout)), [brand.id, businessCardDrafts]);
  const selectedSavedLayoutDraft = savedLayoutDrafts.find((draft) => draft.id === selectedSavedLayoutDraftId) ?? savedLayoutDrafts[0];

  useEffect(() => {
    setSelectedMemberIds((current) => {
      const validIds = new Set(brand.members.map((member) => member.id));
      const nextIds = current.filter((id) => validIds.has(id));

      return nextIds.length > 0 ? nextIds : brand.members.map((member) => member.id);
    });
  }, [brand.members]);

  useEffect(() => {
    if (hasAppliedSuggestedElements || suggestedBusinessCardElements.length === 0 || frontElements.length > 0 || backElements.length > 0) {
      return;
    }

    setFrontElements(suggestedBusinessCardElements);
    setBackElements(suggestedBusinessCardElements);
    updateBusinessCardProductionOptions({ frontElements: suggestedBusinessCardElements, backElements: suggestedBusinessCardElements, color: selectedColor });
    setHasAppliedSuggestedElements(true);
  }, [backElements.length, frontElements.length, hasAppliedSuggestedElements, selectedColor, suggestedBusinessCardElements, updateBusinessCardProductionOptions]);

  useEffect(() => {
    const nextFrontElements = selectableBusinessCardElements(frontElements);
    const nextBackElements = selectableBusinessCardElements(backElements);

    if (nextFrontElements.length === frontElements.length && nextBackElements.length === backElements.length) {
      return;
    }

    setFrontElements(nextFrontElements);
    setBackElements(nextBackElements);
    updateBusinessCardProductionOptions({ frontElements: nextFrontElements, backElements: nextBackElements, color: selectedColor });
  }, [backElements, frontElements, selectedColor, updateBusinessCardProductionOptions]);

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((current) => (current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]));
  };
  const updateMemberForm = (field: keyof MemberFormValues, value: string) => {
    setMemberForm((current) => ({ ...current, [field]: value }));
    if (field === "name" && value.trim()) {
      setMemberFormError("");
    }
  };
  const updateQrCodeImage = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      const imageUrl = await readQrImageFile(file);
      setMemberForm((current) => ({ ...current, qrCodeImageUrl: imageUrl }));
    } catch (error) {
      setMemberFormError(error instanceof Error ? error.message : "QR 이미지를 읽지 못했어요.");
    }
  };
  const openAddMemberForm = () => {
    setEditingMemberId(undefined);
    setMemberForm(emptyMemberFormValues);
    setMemberFormError("");
    setIsMemberFormOpen(true);
  };
  const openEditMemberForm = (member: Member) => {
    setEditingMemberId(member.id);
    setMemberForm(memberFormValuesFromMember(member));
    setMemberFormError("");
    setIsMemberFormOpen(true);
  };
  const closeMemberForm = () => {
    setEditingMemberId(undefined);
    setMemberForm(emptyMemberFormValues);
    setMemberFormError("");
    setIsMemberFormOpen(false);
  };
  const handleSaveMember = () => {
    const nextMember = createMemberFromForm(memberForm);

    if (!nextMember.name) {
      setMemberFormError("이름을 입력해 주세요.");
      return;
    }

    if (editingMemberId) {
      onUpdateMember(editingMemberId, nextMember);
    } else {
      onAddMember(nextMember);
    }

    closeMemberForm();
  };
  const handleDeleteMember = (memberId: string) => {
    setSelectedMemberIds((current) => current.filter((id) => id !== memberId));
    onDeleteMember(memberId);
  };
  const handleStartProduction = () => {
    setProductionNotice("");
    const nextFrontElements = frontElements.length > 0 ? frontElements : suggestedBusinessCardElements;
    const nextBackElements = backElements.length > 0 ? backElements : suggestedBusinessCardElements;
    const nextLayout = createBusinessCardLayoutFromSelection({ frontElements: nextFrontElements, backElements: nextBackElements });

    updateBusinessCardProductionOptions({ frontElements: nextFrontElements, backElements: nextBackElements, color: selectedColor, layout: nextLayout });
    onStartProduction(selectedMemberIds.length > 0 ? selectedMemberIds : brand.members.map((member) => member.id));
  };
  const handleEditOrderedCardLayout = (draft: BusinessCardDraft, template: PrintTemplate) => {
    const nextLayout = draft.layout ?? template.layout ?? createBusinessCardLayoutFromSelection({ frontElements, backElements });

    updateBusinessCardProductionOptions({ frontElements, backElements, color: selectedColor, layout: nextLayout });
    onStartProduction([draft.member.id], template.id);
  };
  const handleLoadSavedLayout = (draft: BusinessCardDraft) => {
    if (!draft.layout) {
      return;
    }

    const nextFrontElements = visibleBusinessCardElements(draft.layout, "front");
    const nextBackElements = visibleBusinessCardElements(draft.layout, "back");

    setProductionNotice("");
    setFrontElements(nextFrontElements);
    setBackElements(nextBackElements);
    setSelectedMemberIds([draft.member.id]);
    setSelectedSavedLayoutDraftId(draft.id);
    updateBusinessCardProductionOptions({ frontElements: nextFrontElements, backElements: nextBackElements, color: selectedColor, layout: draft.layout });
    onStartProduction([draft.member.id], draft.templateId);
  };
  const handleDownloadMockupPdf = async (mockup: { id: string; imageUrl: string; cleanImageUrl?: string }) => {
    const pdfRecordKey = `${mockup.id}:${aiBusinessCardPdfRendererVersion}`;
    const existingRecord = mockupPdfRecords[pdfRecordKey];

    if (existingRecord) {
      downloadPdfUrl(existingRecord.url, existingRecord.fileName);
      return;
    }

    if (!mockup.cleanImageUrl) {
      setMockupPdfErrors((current) => ({ ...current, [pdfRecordKey]: "클린 배경 목업이 없어 PDF를 만들 수 없어요. 목업을 다시 생성해 주세요." }));
      return;
    }

    const matchedMember = currentBrandMockupSignatureEntries.find((entry) => entry.signature === aiBusinessCardMockupSignature)?.member ?? memberFromSavedAiBusinessCardMockupSignature(aiBusinessCardMockupSignature, brand.members);

    if (!matchedMember) {
      setMockupPdfErrors((current) => ({ ...current, [pdfRecordKey]: "현재 브랜드/구성원 정보와 맞는 목업을 찾지 못했어요. 목업을 다시 생성해 주세요." }));
      return;
    }

    const input = { brandName: brand.name, category: brand.category, mood: brand.designRequest, member: matchedMember, logo, templateId: selectedTemplateId, productionOptions };
    const body = createAiBusinessCardRequestBody(input);

    setRunningMockupPdfId(mockup.id);
    setMockupPdfErrors((current) => {
      const next = { ...current };

      delete next[pdfRecordKey];
      return next;
    });

    try {
      const designResponse = await fetchWithTimeout("/api/ai-business-cards/design", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, mockupImageUrl: mockup.imageUrl, cleanMockupImageUrl: mockup.cleanImageUrl }),
      });

      if (!designResponse.ok) {
        const data: unknown = await designResponse.json().catch(() => undefined);

        throw new Error(readApiErrorReason(data, "관리자 템플릿 좌표로 인쇄용 레이아웃을 만들지 못했어요."));
      }

      const designData = await designResponse.json() as { design?: AiBusinessCardDesign };

      if (!designData.design) {
        throw new Error("선택 목업에서 인쇄용 레이아웃을 만들지 못했어요. 다른 목업으로 다시 시도해 주세요.");
      }

      const pdfResponse = await fetchWithTimeout("/api/ai-business-cards/pdf", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, design: designData.design, mockupImageUrl: mockup.imageUrl, cleanMockupImageUrl: mockup.cleanImageUrl, signature: pdfRecordKey }),
      });

      const queuedJob = await readAiBusinessCardJob(pdfResponse);
      const job = queuedJob.status === "succeeded" || queuedJob.status === "failed" || queuedJob.status === "cancelled" ? queuedJob : await pollAiBusinessCardJob(queuedJob.jobId);

      if (job.status === "failed" || job.status === "cancelled") {
        throw new Error(job.reason);
      }

      if (job.kind !== "pdf" || job.status !== "succeeded") {
        throw new Error("PDF를 만들 수 없어요. 잠시 후 다시 시도해 주세요.");
      }

      const blob = createPdfBlobFromBase64(job.base64);
      const fileName = job.fileName || readDownloadFileName(pdfResponse, `${brand.name || "printy"}-ai-business-card.pdf`);
      const pdfUrl = createPdfBlobUrl(blob);

      setMockupPdfRecords((current) => ({ ...current, [pdfRecordKey]: { url: pdfUrl, fileName } }));
      downloadPdfUrl(pdfUrl, fileName);
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError" ? "PDF 생성이 오래 걸렸어요. 다시 시도해 주세요." : error instanceof Error ? error.message : "PDF를 만들 수 없어요. 잠시 후 다시 시도해 주세요.";

      setMockupPdfErrors((current) => ({ ...current, [pdfRecordKey]: message }));
    } finally {
      setRunningMockupPdfId(undefined);
    }
  };
  const memberSelector = (
    <div className="grid gap-3 rounded-lg bg-surface-blue p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-ink">팀/구성원</p>
          <p className="mt-1 text-xs font-bold leading-5 text-muted">명함을 만들 구성원을 선택하고 수정해요.</p>
        </div>
        <AppButton full={false} className="shrink-0 px-3 py-2 text-xs" variant="secondary" onClick={openAddMemberForm}>추가</AppButton>
      </div>
      <div className="grid gap-2">
        {brand.members.length > 0 ? brand.members.map((member) => (
          <div key={member.id} className={`grid grid-cols-[24px_1fr_auto_auto] items-center gap-2 rounded-md border p-2 transition ${selectedMemberIds.includes(member.id) ? "border-primary bg-white shadow-soft" : "border-line bg-surface"}`}>
            <input className="h-5 w-5 accent-[var(--color-primary)]" aria-label={`${member.name} 선택`} type="checkbox" checked={selectedMemberIds.includes(member.id)} onChange={() => toggleMember(member.id)} />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-ink">{member.name} <span className="text-xs text-primary-strong">{member.role || brand.category}</span></p>
              <p className="truncate text-[11px] font-bold text-muted">{[member.phone, member.email].filter(Boolean).join(" · ") || "연락처 미입력"}</p>
            </div>
            <button className="rounded-sm bg-surface-blue px-2 py-1 text-[11px] font-black text-primary-strong" type="button" onClick={() => openEditMemberForm(member)}>수정</button>
            <button className="rounded-sm bg-danger/10 px-2 py-1 text-[11px] font-black text-danger" type="button" onClick={() => handleDeleteMember(member.id)}>삭제</button>
          </div>
        )) : <p className="rounded-md bg-white px-3 py-3 text-xs font-bold leading-5 text-primary-strong">아직 저장된 구성원이 없어요. 추가 버튼으로 명함 정보를 입력해 주세요.</p>}
      </div>
      {isMemberFormOpen ? (
        <div className="grid gap-3 rounded-md border border-line bg-white p-3 shadow-soft">
          <p className="text-xs font-black text-ink">{editingMemberId ? "구성원 수정" : "구성원 추가"}</p>
          {memberFormFields.map((field) => (field.multiline ? <TextAreaField key={field.field} label={field.label} placeholder={field.placeholder} value={memberForm[field.field] ?? ""} onChange={(value) => updateMemberForm(field.field, value)} /> : <TextField key={field.field} label={field.label} placeholder={field.placeholder} value={memberForm[field.field] ?? ""} onChange={(value) => updateMemberForm(field.field, value)} />))}
          <QrCodeImageField value={memberForm.qrCodeImageUrl ?? ""} onChange={updateQrCodeImage} onClear={() => updateMemberForm("qrCodeImageUrl", "")} />
          {memberFormError ? <p className="rounded-md bg-danger/10 px-3 py-2 text-xs font-bold text-danger">{memberFormError}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <AppButton variant="ghost" onClick={closeMemberForm}>취소</AppButton>
            <AppButton onClick={handleSaveMember}>저장</AppButton>
          </div>
        </div>
      ) : null}
    </div>
  );
  const orderedBusinessCards = orders
    .filter((order) => order.status === "paid" || order.status === "preparing")
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
  const currentBrandMockupSignatureEntries = brand.members.map((member) => ({ member, signature: createAiBusinessCardMockupSignature({ brandName: brand.name, category: brand.category, mood: brand.designRequest, member, logo, templateId: selectedTemplateId, productionOptions }) }));
  const hasExactMockupSignature = aiBusinessCardMockupSignature ? currentBrandMockupSignatureEntries.some((entry) => entry.signature === aiBusinessCardMockupSignature) : false;
  const hasRelaxedMockupSignature = savedAiBusinessCardMockupSignatureMatches(aiBusinessCardMockupSignature, { brandName: brand.name, logoId: logo.id, members: brand.members });
  const visibleAiBusinessCardMockups = hasExactMockupSignature || hasRelaxedMockupSignature ? aiBusinessCardMockups.filter((mockup) => mockup.imageUrl && mockup.cleanImageUrl) : [];

  return (
    <div className="grid gap-5">
      {memberSelector}
      {productionNotice ? <p className="rounded-md bg-danger/10 px-4 py-3 text-xs font-bold leading-5 text-danger">{productionNotice}</p> : null}
      <AppButton variant="primary" onClick={handleStartProduction} disabled={brand.members.length > 0 && selectedMemberIds.length === 0} className="py-4 text-base font-black shadow-floating disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
        명함 제작하기
      </AppButton>
      {savedLayoutDrafts.length > 0 ? (
        <div className="grid gap-2 rounded-lg border border-line bg-surface p-3 shadow-soft">
          <div>
            <p className="text-xs font-black text-ink">임시 저장된 레이아웃 불러오기</p>
            <p className="mt-1 text-[11px] font-bold leading-5 text-muted">이미지 생성 전에 저장해둔 좌표를 선택해서 이어서 편집할 수 있어요.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <select className="min-h-10 rounded-md border border-line bg-white px-3 text-xs font-bold text-ink outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft" value={selectedSavedLayoutDraft?.id ?? ""} onChange={(event) => setSelectedSavedLayoutDraftId(event.target.value)}>
              {savedLayoutDrafts.map((draft) => {
                const orientation = draft.layout ? getBusinessCardLayoutOrientation(draft.layout) : "horizontal";

                return (
                  <option key={draft.id} value={draft.id}>
                    {draft.member.name || "이름 미입력"} · {orientation === "vertical" ? "세로형" : "가로형"} · {draft.createdAt}
                  </option>
                );
              })}
            </select>
            <AppButton className="py-2 text-xs" variant="secondary" onClick={() => selectedSavedLayoutDraft ? handleLoadSavedLayout(selectedSavedLayoutDraft) : undefined} disabled={!selectedSavedLayoutDraft}>
              불러오기
            </AppButton>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4">
        {visibleAiBusinessCardMockups.length > 0 ? (
          <div className="grid gap-3 rounded-lg border border-line bg-surface p-4 shadow-card">
            <div>
              <p className="text-base font-black text-ink">완성된 명함 목업</p>
              <p className="mt-1 text-xs font-bold leading-5 text-muted">최근 생성한 AI 명함 목업이에요. 인쇄용 PDF는 아래 버튼으로 만들 수 있어요.</p>
              <AppButton className="mt-3 py-2 text-xs" variant="ghost" onClick={handleStartProduction} disabled={brand.members.length > 0 && selectedMemberIds.length === 0}>
                레이아웃 수정하기
              </AppButton>
            </div>
            <div className="grid gap-3">
              {visibleAiBusinessCardMockups.map((mockup) => (
                <div key={mockup.id} className="overflow-hidden rounded-md border border-line bg-surface-blue p-2 shadow-soft">
                  <Image className="block h-auto w-full rounded-sm" src={mockup.imageUrl} alt={mockup.title} width={920} height={1040} sizes="(max-width: 768px) 100vw, 768px" unoptimized />
                  <p className="mt-2 text-xs font-black text-ink">{mockup.title}</p>
                  <AppButton className="mt-2 py-3 text-xs" variant={mockupPdfRecords[`${mockup.id}:${aiBusinessCardPdfRendererVersion}`] ? "primary" : "secondary"} onClick={() => handleDownloadMockupPdf(mockup)} disabled={runningMockupPdfId === mockup.id || !mockup.cleanImageUrl}>
                    {runningMockupPdfId === mockup.id ? "PDF 만드는 중" : mockupPdfRecords[`${mockup.id}:${aiBusinessCardPdfRendererVersion}`] ? "PDF 다운로드" : "PDF 만들기"}
                  </AppButton>
                  {!mockup.cleanImageUrl ? <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-[11px] font-bold leading-5 text-danger">클린 배경이 없는 목업이라 PDF를 만들 수 없어요.</p> : null}
                  {mockupPdfErrors[`${mockup.id}:${aiBusinessCardPdfRendererVersion}`] ? <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-[11px] font-bold leading-5 text-danger">{mockupPdfErrors[`${mockup.id}:${aiBusinessCardPdfRendererVersion}`]}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {orderedBusinessCards.length > 0 ? orderedBusinessCards.map(({ order, draft, template, member, logo: cardLogo }) => (
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
            <AppButton className="py-3 text-sm" variant="secondary" onClick={() => handleEditOrderedCardLayout(draft, template)}>
              레이아웃 수정하기
            </AppButton>
          </div>
        )) : visibleAiBusinessCardMockups.length === 0 ? (
          <div className="rounded-lg bg-surface-blue p-5 text-center shadow-soft">
            <p className="text-base font-black text-ink">완료된 명함이 아직 없어요</p>
            <p className="mt-2 text-xs font-bold leading-5 text-muted">입금 확인된 명함이 생기면 이곳에서 다시 확인할 수 있어요.</p>
          </div>
        ) : null}
      </div>
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
  const [archiveFiles, setArchiveFiles] = useState<UserArchiveFile[]>([]);
  const [archiveStatus, setArchiveStatus] = useState("파일 보관함을 확인하고 있어요.");

  useEffect(() => {
    let isActive = true;

    async function loadArchiveFiles() {
      const response = await fetch("/api/file-archive", { cache: "no-store" });

      if (!isActive) {
        return;
      }

      if (!response.ok) {
        setArchiveStatus(response.status === 401 ? "로그인 후 관리자 등록 파일을 확인할 수 있어요." : "파일 보관함을 불러오지 못했어요.");
        return;
      }

      const files = readUserArchiveFilesResponse(await response.json().catch(() => undefined));
      setArchiveFiles(files);
      setArchiveStatus(files.length > 0 ? "" : "관리자가 등록한 다운로드 파일이 아직 없어요.");
    }

    void loadArchiveFiles().catch(() => {
      if (isActive) {
        setArchiveStatus("파일 보관함을 불러오지 못했어요.");
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  const rows = [
    ...(cardDraft ? [{ id: cardDraft.id, label: "명함 시안", value: `${cardDraft.brandName} · ${cardDraft.createdAt}` }] : []),
    ...orders.map((order) => ({ id: order.id, label: "주문 영수증", value: `${order.orderNumber} · ${order.statusLabel}` })),
    ...assets.map((asset) => ({ id: asset.id, label: asset.title, value: asset.createdAt })),
  ];

  return (
    <div className="grid gap-3">
      <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
        <p className="text-xs font-black text-primary-strong">관리자 등록 파일</p>
        <h3 className="mt-1 text-xl font-black tracking-[-0.04em] text-ink">다운로드 보관함</h3>
        <p className="mt-2 text-sm font-bold leading-6 text-muted">관리자가 등록한 원본, 인쇄 파일, 안내 파일을 여기에서 내려받을 수 있어요.</p>
      </SoftCard>
      {archiveFiles.map((file) => (
        <article key={file.id} className="rounded-lg border border-line bg-surface p-4 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-base font-black text-ink">{file.displayName}</p>
              <p className="mt-1 text-xs font-bold text-muted">{file.originalName} · {formatArchiveFileSize(file.size)} · {formatArchiveDate(file.createdAt)}</p>
              {file.note ? <p className="mt-3 rounded-md bg-surface-blue px-3 py-2 text-xs font-bold leading-5 text-muted">{file.note}</p> : null}
            </div>
            <a className="shrink-0 rounded-md bg-primary px-4 py-3 text-center text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5" href={`/api/file-archive/${encodeURIComponent(file.id)}/download`} download>
              다운로드
            </a>
          </div>
        </article>
      ))}
      {archiveStatus ? <div className="rounded-md bg-surface-blue p-4 text-sm font-black text-ink">{archiveStatus}</div> : null}
      <SoftCard>
        <p className="text-xs font-black text-primary-strong">브랜드 작업 기록</p>
      </SoftCard>
      {rows.length > 0 ? rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 rounded-md bg-surface-blue p-4">
          <span className="text-xs font-black text-primary-strong">{row.label}</span>
          <span className="text-right text-sm font-black leading-5 text-ink">{row.value}</span>
        </div>
      )) : <div className="rounded-md bg-surface-blue p-4 text-sm font-black text-ink">저장된 항목이 아직 없어요</div>}
    </div>
  );
}
