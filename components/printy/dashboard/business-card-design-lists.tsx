"use client";

import Image from "next/image";
import { toPng } from "html-to-image";
import { useRef, useState } from "react";
import { BusinessCardUserPreview } from "@/components/admin/business-card-layout-builder";
import { CompletedDesignCard, completedBusinessCardMockupImageSize, completedDesignPreviewImageSizes } from "@/components/design-production/completed-design-card";
import { SavedDesignDraftList } from "@/components/design-production/saved-design-draft-list";
import { AppButton } from "@/components/ui";
import { getBusinessCardLayoutOrientation } from "@/lib/business-card-layout-generator";
import type { AiBusinessCardMockup, BusinessCardDraft, BusinessCardTemplateLayout, Member, ResolvedLogoOption } from "@/lib/types";

const completedBusinessCardPreviewClassName = "h-full w-full max-w-none !bg-transparent !p-0 [&>div]:!border-0 [&>div]:!shadow-none";

export type CompletedBusinessCardEntry = {
  draft?: BusinessCardDraft;
  mockup: AiBusinessCardMockup;
  signature?: string;
};

type SavedBusinessCardLayoutListProps = {
  drafts: BusinessCardDraft[];
  selectedDraft?: BusinessCardDraft;
  onSelectDraft: (draftId: string) => void;
  onLoadDraft: (draft: BusinessCardDraft) => void;
  onDeleteDraft: (draft: BusinessCardDraft) => void;
};

type CompletedBusinessCardListProps = {
  entries: CompletedBusinessCardEntry[];
  logo: ResolvedLogoOption;
  pdfRecords: Record<string, { url: string; fileName: string }>;
  pdfErrors: Record<string, string>;
  runningMockupPdfId?: string;
  rendererVersion: string;
  resolveMember: (entry: CompletedBusinessCardEntry) => Member | undefined;
  resolveLayout: (entry: CompletedBusinessCardEntry) => BusinessCardTemplateLayout | undefined;
  onEdit: (entry: CompletedBusinessCardEntry, member: Member | undefined, layout: BusinessCardTemplateLayout | undefined) => void;
  onDelete: (entry: CompletedBusinessCardEntry) => void;
  onDownloadPdf: (entry: CompletedBusinessCardEntry, member: Member | undefined, layout: BusinessCardTemplateLayout | undefined) => void;
};

function CompletedBusinessCardListItem({ entry, logo, rendererVersion, pdfRecords, pdfErrors, runningMockupPdfId, runningMockupImageId, setRunningMockupImageId, resolveMember, resolveLayout, onEdit, onDelete, onDownloadPdf }: {
  entry: CompletedBusinessCardEntry;
  logo: ResolvedLogoOption;
  rendererVersion: string;
  pdfRecords: Record<string, { url: string; fileName: string }>;
  pdfErrors: Record<string, string>;
  runningMockupPdfId?: string;
  runningMockupImageId?: string;
  setRunningMockupImageId: (nextValue: string | undefined) => void;
  resolveMember: (entry: CompletedBusinessCardEntry) => Member | undefined;
  resolveLayout: (entry: CompletedBusinessCardEntry) => BusinessCardTemplateLayout | undefined;
  onEdit: (entry: CompletedBusinessCardEntry, member: Member | undefined, layout: BusinessCardTemplateLayout | undefined) => void;
  onDelete: (entry: CompletedBusinessCardEntry) => void;
  onDownloadPdf: (entry: CompletedBusinessCardEntry, member: Member | undefined, layout: BusinessCardTemplateLayout | undefined) => void;
}) {
  const { mockup } = entry;
  const matchedMember = resolveMember(entry);
  const completedLayout = resolveLayout(entry);
  const pdfRecordKey = `${mockup.id}:${rendererVersion}`;
  const previewRef = useRef<HTMLDivElement>(null);
  const canDownloadImage = Boolean(mockup.cleanImageUrl && completedLayout && matchedMember);

  return (
    <CompletedDesignCard
      key={mockup.id}
      layout="overlay"
      preview={mockup.cleanImageUrl && completedLayout && matchedMember ? (
        <div ref={previewRef} className="relative">
          <BusinessCardUserPreview className={completedBusinessCardPreviewClassName} cleanImageUrl={mockup.cleanImageUrl} layout={completedLayout} member={matchedMember} logo={logo} />
        </div>
      ) : (
        <Image className="block h-full w-full rounded-lg object-cover" src={mockup.imageUrl} alt={mockup.title} width={completedBusinessCardMockupImageSize.width} height={completedBusinessCardMockupImageSize.height} sizes={completedDesignPreviewImageSizes} unoptimized />
      )}
      actions={<>
        <AppButton className="whitespace-nowrap px-2 py-2 !bg-emerald-600/60 backdrop-blur disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" variant="success" onClick={() => onEdit(entry, matchedMember, completedLayout)}>디자인 수정하기</AppButton>
        <AppButton className="whitespace-nowrap px-2 py-2 !bg-primary/60 backdrop-blur disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" variant="primary" onClick={() => onDownloadPdf(entry, matchedMember, completedLayout)} disabled={runningMockupPdfId === mockup.id || !mockup.cleanImageUrl}>
          {runningMockupPdfId === mockup.id ? "PDF 만드는 중" : pdfRecords[pdfRecordKey] ? "PDF 다운 받기" : "인쇄용 PDF 만들기"}
        </AppButton>
        <AppButton
          className="whitespace-nowrap px-2 py-2 !bg-surface/80 text-primary-strong backdrop-blur disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          onClick={async () => {
            if (!canDownloadImage || !previewRef.current) {
              return;
            }

            setRunningMockupImageId(mockup.id);

            try {
              const dataUrl = await toPng(previewRef.current, { cacheBust: true, pixelRatio: 2 });
              const link = document.createElement("a");
              link.href = dataUrl;
              link.download = `printy-business-card-${mockup.id}.png`;
              link.click();
            } finally {
              setRunningMockupImageId(undefined);
            }
          }}
          disabled={runningMockupImageId === mockup.id || !canDownloadImage}
        >
          {runningMockupImageId === mockup.id ? "이미지 만드는 중" : "이미지 다운로드"}
        </AppButton>
        <AppButton className="whitespace-nowrap px-2 py-2 !bg-danger/60 backdrop-blur disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" variant="danger" onClick={() => onDelete(entry)} disabled={!entry.draft}>삭제하기</AppButton>
      </>}
      notices={<>
        {!mockup.cleanImageUrl ? <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-[11px] font-bold leading-5 text-danger">클린 배경이 없는 목업이라 PDF를 만들 수 없어요.</p> : null}
        {pdfErrors[pdfRecordKey] ? <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-[11px] font-bold leading-5 text-danger">{pdfErrors[pdfRecordKey]}</p> : null}
      </>}
    />
  );
}

export function SavedBusinessCardLayoutList({ drafts, selectedDraft, onSelectDraft, onLoadDraft, onDeleteDraft }: SavedBusinessCardLayoutListProps) {
  return <SavedDesignDraftList title="임시 저장된 레이아웃 불러오기" description="새 명함 제작 중 목업 생성 전에 임시 저장한 좌표만 이어서 편집해요." options={drafts.map((draft) => {
    const orientation = draft.layout ? getBusinessCardLayoutOrientation(draft.layout) : "horizontal";

    return { id: draft.id, label: `${draft.member.name || "이름 미입력"} · ${orientation === "vertical" ? "세로형" : "가로형"} · ${draft.createdAt}` };
  })} selectedId={selectedDraft?.id} onSelect={onSelectDraft} onLoad={() => selectedDraft ? onLoadDraft(selectedDraft) : undefined} onDelete={() => selectedDraft ? onDeleteDraft(selectedDraft) : undefined} />;
}

export function CompletedBusinessCardList({ entries, logo, pdfRecords, pdfErrors, runningMockupPdfId, rendererVersion, resolveMember, resolveLayout, onEdit, onDelete, onDownloadPdf }: CompletedBusinessCardListProps) {
  if (entries.length === 0) {
    return null;
  }

  const [runningMockupImageId, setRunningMockupImageId] = useState<string>();

  return (
    <div className="grid gap-3 rounded-lg bg-surface-blue p-4">
      <div>
        <p className="text-base font-black text-ink">디자인 완료된 명함</p>
      </div>
      <div className="grid gap-4">
        {entries.map((entry) => (
          <CompletedBusinessCardListItem
            key={entry.mockup.id}
            entry={entry}
            logo={logo}
            rendererVersion={rendererVersion}
            pdfRecords={pdfRecords}
            pdfErrors={pdfErrors}
            runningMockupPdfId={runningMockupPdfId}
            runningMockupImageId={runningMockupImageId}
            setRunningMockupImageId={setRunningMockupImageId}
            resolveMember={resolveMember}
            resolveLayout={resolveLayout}
            onEdit={onEdit}
            onDelete={onDelete}
            onDownloadPdf={onDownloadPdf}
          />
        ))}
      </div>
    </div>
  );
}
