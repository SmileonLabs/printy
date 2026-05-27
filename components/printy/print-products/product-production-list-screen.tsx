"use client";

import { AppButton, SoftCard } from "@/components/ui";
import { CompletedDesignCard, completedDesignPreviewClassName } from "@/components/design-production/completed-design-card";
import { SavedDesignDraftList } from "@/components/design-production/saved-design-draft-list";
import { PrintProductPreviewOverlay } from "@/components/printy/print-products/print-product-preview-overlay";
import { formatKoreanDateTime } from "@/lib/date-format";
import { normalizePrintProductLayout, type PrintProductAdapter } from "@/lib/print-products/adapters";
import type { PrintProductDraft } from "@/lib/types";

type ProductProductionListScreenProps = {
  adapter: PrintProductAdapter;
  draft?: PrintProductDraft;
  temporaryDrafts: PrintProductDraft[];
  completedDrafts: PrintProductDraft[];
  logoImageUrl?: string;
  logoVectorSvgUrl?: string;
  isGeneratingPdf: boolean;
  isGeneratingLayout: boolean;
  layoutPrompt: string;
  onLayoutPromptChange: (value: string) => void;
  onStartNewDesign: () => void;
  onStartNewDesignWithAiLayout: () => void;
  onLoadDraft: (draft: PrintProductDraft) => void;
  onDeleteDraft: (draft: PrintProductDraft) => void;
  onEditCompletedDraft: (draft: PrintProductDraft) => void;
  onDeleteCompletedDraft: (draft: PrintProductDraft) => void;
  onGeneratePdf: (draft: PrintProductDraft) => void;
  onDownloadPdf: (url: string, fileName: string) => void;
};

export function ProductProductionListScreen({ adapter, draft, temporaryDrafts, completedDrafts, logoImageUrl, logoVectorSvgUrl, isGeneratingPdf, isGeneratingLayout, layoutPrompt, onLayoutPromptChange, onStartNewDesign, onStartNewDesignWithAiLayout, onLoadDraft, onDeleteDraft, onEditCompletedDraft, onDeleteCompletedDraft, onGeneratePdf, onDownloadPdf }: ProductProductionListScreenProps) {
  return (
    <div className="grid gap-5">
      <SoftCard className="bg-[linear-gradient(180deg,var(--color-surface)_0%,var(--color-surface-blue)_100%)]">
        <p className="text-xs font-black text-primary-strong">{adapter.title} 제작</p>
      </SoftCard>
      <SoftCard className="grid gap-3">
        <div>
          <p className="text-sm font-black text-ink">AI {adapter.shortTitle} 요청</p>
          <p className="mt-1 text-xs font-bold leading-5 text-muted">원하는 분위기를 적으면 GPT가 먼저 좌표를 잡고, 다음 제작 화면의 배경 프롬프트는 별도로 유지해요.</p>
        </div>
        <label className="grid gap-2">
          <span className="text-xs font-black text-primary-strong">레이아웃 프롬프트</span>
          <textarea className="min-h-24 resize-y rounded-md border border-line bg-surface-blue px-3 py-3 text-sm font-bold leading-6 text-ink outline-none transition focus:border-primary focus:bg-surface focus:shadow-soft" value={layoutPrompt} placeholder="예: 카페 홍보물은 여백 넉넉하게, 로고 강조, 럭셔리 느낌" onChange={(event) => onLayoutPromptChange(event.currentTarget.value)} />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <AppButton variant="primary" onClick={onStartNewDesignWithAiLayout} disabled={isGeneratingLayout}>{isGeneratingLayout ? "GPT 레이아웃 생성 중" : layoutPrompt.trim() ? `프롬프트로 새 ${adapter.shortTitle} 제작하기` : `새 ${adapter.shortTitle} 제작하기`}</AppButton>
          <AppButton variant="secondary" onClick={onStartNewDesign}>빈 편집창으로 시작하기</AppButton>
        </div>
      </SoftCard>
      <SoftCard>
        {temporaryDrafts.length > 0 ? <SavedDesignDraftList title="임시 저장된 디자인 불러오기" options={temporaryDrafts.map((item) => ({ id: item.id, label: `${item.title} · 후보 ${item.mockups.length}개 · ${formatKoreanDateTime(item.updatedAt)}` }))} selectedId={draft?.completedAt ? undefined : draft?.id} onSelect={(draftId) => {
          const selected = temporaryDrafts.find((item) => item.id === draftId);
          if (selected) onLoadDraft(selected);
        }} onLoad={() => {
          const selected = temporaryDrafts.find((item) => item.id === draft?.id) ?? temporaryDrafts[0];
          onLoadDraft(selected);
        }} onDelete={() => {
          const selected = temporaryDrafts.find((item) => item.id === draft?.id) ?? temporaryDrafts[0];
          onDeleteDraft(selected);
        }} /> : (
          <div className="mt-3 rounded-md bg-surface-blue px-4 py-4 text-center shadow-soft">
            <p className="text-sm font-black text-ink">임시 저장된 {adapter.shortTitle} 디자인이 아직 없어요</p>
            <p className="mt-1 text-xs font-bold leading-5 text-muted">레이아웃 임시 저장하기를 누르면 이곳에 표시돼요.</p>
          </div>
        )}
      </SoftCard>
      <SoftCard>
        <p className="text-sm font-black text-ink">디자인 완료된 {adapter.shortTitle}</p>
        {completedDrafts.length > 0 ? (
          <div className="mt-3 columns-2 gap-3 sm:columns-3 xl:columns-4">
            {completedDrafts.map((item) => {
              const itemMockup = item.mockups.find((mockup) => mockup.id === item.selectedMockupId) ?? item.mockups[0];
              const itemLayout = normalizePrintProductLayout(item.layout);

              return (
                <CompletedDesignCard
                  key={item.id}
                  preview={<PrintProductPreviewOverlay className={completedDesignPreviewClassName} layout={itemLayout} backgroundImageUrl={itemMockup?.cleanImageUrl ?? itemMockup?.imageUrl} logoImageUrl={logoImageUrl} logoVectorSvgUrl={logoVectorSvgUrl} />}
                  subtitle={item.completedAt ? formatKoreanDateTime(item.completedAt) : "완료 저장"}
                  actions={<>
                    <AppButton className="py-2 text-xs" variant="success" onClick={() => onEditCompletedDraft(item)}>디자인 수정하기</AppButton>
                    <AppButton className="py-2 text-xs" variant="primary" onClick={() => item.pdfUrl && item.pdfFileName ? onDownloadPdf(item.pdfUrl, item.pdfFileName) : onGeneratePdf(item)} disabled={isGeneratingPdf || !itemMockup}>
                      {isGeneratingPdf ? "PDF 만드는 중" : item.pdfUrl ? "PDF 다운 받기" : "인쇄용 PDF 파일 만들기"}
                    </AppButton>
                    <AppButton className="py-2 text-xs" variant="danger" onClick={() => onDeleteCompletedDraft(item)}>삭제하기</AppButton>
                  </>}
                />
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-md bg-surface-blue px-4 py-5 text-center shadow-soft">
            <p className="text-sm font-black text-ink">디자인 완료된 {adapter.shortTitle}이 아직 없어요</p>
            <p className="mt-1 text-xs font-bold leading-5 text-muted">배경 후보를 선택하고 디자인 저장하기를 누르면 이곳에 표시돼요.</p>
          </div>
        )}
      </SoftCard>
    </div>
  );
}
