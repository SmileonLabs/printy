"use client";

import { ProductionAiDesignRequestCard, ProductionPromptCard, ProductionSizeCard } from "@/components/design-production/production-editor-cards";
import { PrintProductEditor } from "@/components/printy/print-products/print-product-editor";
import { PrintProductPreviewOverlay } from "@/components/printy/print-products/print-product-preview-overlay";
import { AppButton, SoftCard } from "@/components/ui";
import type { PrintProductAdapter } from "@/lib/print-products/adapters";
import type { PrintProductDraft, PrintProductMockup, PrintProductProductionLayout } from "@/lib/types";

type ProductProductionEditorScreenProps = {
  adapter: PrintProductAdapter;
  draft?: PrintProductDraft;
  layout: PrintProductProductionLayout;
  selectedMockup?: PrintProductMockup;
  mockupPrompt: string;
  editorMode: "create" | "edit";
  isGeneratingMockup: boolean;
  isGeneratingPdf: boolean;
  canUseLogo: boolean;
  logoImageUrl?: string;
  logoVectorSvgUrl?: string;
  onLayoutChange: (layout: PrintProductProductionLayout) => void;
  onSizeChange: (sizeId: string) => void;
  onRequestChange: (value: string) => void;
  onMockupPromptChange: (value: string) => void;
  onSelectMockup: (draftId: string, mockupId: string) => void;
  onDeleteMockup: (draftId: string, mockupId: string) => void;
  onSave: () => void;
  onSendMockupPrompt: () => void;
  onCompleteDesign: () => void;
  onGeneratePdf: () => void;
  onDownloadPdf: (url: string, fileName: string) => void;
};

export function ProductProductionEditorScreen({ adapter, draft, layout, selectedMockup, mockupPrompt, editorMode, isGeneratingMockup, isGeneratingPdf, canUseLogo, logoImageUrl, logoVectorSvgUrl, onLayoutChange, onSizeChange, onRequestChange, onMockupPromptChange, onSelectMockup, onDeleteMockup, onSave, onSendMockupPrompt, onCompleteDesign, onGeneratePdf, onDownloadPdf }: ProductProductionEditorScreenProps) {
  const isEditMode = editorMode === "edit";

  return (
    <div className="grid gap-5">
      <ProductionSizeCard title="인쇄 사이즈" description="이 제작 화면에서 인쇄 사이즈를 정해요. 사이즈를 바꾸면 현재 레이아웃 비율과 PDF 크기도 함께 바뀝니다." value={layout.sizeId} options={adapter.sizes} onChange={onSizeChange} />
      <SoftCard>
        <PrintProductEditor layout={layout} backgroundImageUrl={selectedMockup?.cleanImageUrl ?? selectedMockup?.imageUrl} logoImageUrl={logoImageUrl} logoVectorSvgUrl={logoVectorSvgUrl} onChange={onLayoutChange} />
      </SoftCard>
      <ProductionAiDesignRequestCard mode={editorMode} title={isEditMode ? "AI 디자인 수정" : "AI 디자인 요청"} description={isEditMode ? "프롬프트로 현재 디자인의 배경 후보를 다시 요청해요." : "프롬프트를 입력해 배경 후보를 만들고, 완료 저장한 뒤 바로 수정 화면으로 열어요."} promptValue={draft?.request ?? ""} promptPlaceholder="예: 초록색 중심, 멀리서도 잘 보이는 고급스러운 매장 홍보 배경" onPromptChange={onRequestChange} onTemporarySave={onSave} temporarySaveLabel="저장하기" onAiRequest={onSendMockupPrompt} isAiRequestLoading={isGeneratingMockup} aiRequestDisabled={isGeneratingMockup} showSaveDesign={Boolean(draft?.mockups.length)} onSaveDesign={onCompleteDesign} saveDesignLabel="저장하기" />
      {!isEditMode ? <SoftCard><AppButton variant="secondary" onClick={() => draft?.pdfUrl && draft.pdfFileName ? onDownloadPdf(draft.pdfUrl, draft.pdfFileName) : onGeneratePdf()} disabled={isGeneratingPdf}>{isGeneratingPdf ? "PDF 만드는 중" : draft?.pdfUrl ? "PDF 다운 받기" : "인쇄용 PDF 파일 만들기"}</AppButton></SoftCard> : null}
      {!isEditMode ? <ProductionPromptCard value={mockupPrompt} onChange={onMockupPromptChange} /> : null}
      {draft?.mockups.length ? (
        <SoftCard>
          <p className="text-sm font-black text-ink">지금까지 생성한 이미지</p>
          <p className="mt-1 text-xs font-bold leading-5 text-muted">이 제작 건에서 만든 배경 후보를 모두 보여줘요. 카드를 누르면 현재 편집 배경으로 선택됩니다.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {draft.mockups.map((mockup) => (
              <div key={mockup.id} className={`rounded-lg border p-2 text-left ${mockup.id === selectedMockup?.id ? "border-primary bg-surface-blue" : "border-line bg-surface"}`}>
                <button className="block w-full text-left" type="button" onClick={() => onSelectMockup(draft.id, mockup.id)}>
                  <PrintProductPreviewOverlay layout={layout} backgroundImageUrl={mockup.cleanImageUrl ?? mockup.imageUrl} logoImageUrl={logoImageUrl} logoVectorSvgUrl={logoVectorSvgUrl} />
                  <p className="mt-2 text-xs font-black text-ink">{mockup.title}</p>
                </button>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-muted">{mockup.id === selectedMockup?.id ? "선택됨" : "배경 후보"}</span>
                  <a className="text-[11px] font-black text-primary-strong underline underline-offset-2" href={mockup.imageUrl} target="_blank" rel="noreferrer">원본 보기</a>
                  {mockup.cleanImageUrl ? <a className="text-[11px] font-black text-primary-strong underline underline-offset-2" href={mockup.cleanImageUrl} target="_blank" rel="noreferrer">클린 보기</a> : null}
                  <button className="rounded-sm bg-white px-3 py-2 text-xs font-black text-danger shadow-soft" type="button" onClick={() => onDeleteMockup(draft.id, mockup.id)}>배경 이미지 삭제하기</button>
                </div>
              </div>
            ))}
          </div>
        </SoftCard>
      ) : null}
      {!canUseLogo ? <SoftCard className="bg-surface-blue text-xs font-bold leading-5 text-primary-strong">실제 로고 이미지를 등록하면 {adapter.title} 미리보기와 PDF에 로고를 배치할 수 있어요.</SoftCard> : null}
    </div>
  );
}
