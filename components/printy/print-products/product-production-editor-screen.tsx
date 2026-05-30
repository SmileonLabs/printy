"use client";

import { toPng } from "html-to-image";
import { useRef, useState } from "react";
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
  referenceImageDataUrl?: string;
  referenceImageName: string;
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
  onReferenceImageChange: (dataUrl: string | undefined, name: string) => void;
  onSelectMockup: (draftId: string, mockupId: string) => void;
  onDeleteMockup: (draftId: string, mockupId: string) => void;
  onSave: () => void;
  onSendMockupPrompt: () => void;
  onCompleteDesign: () => void;
  onGeneratePdf: () => void;
  onDownloadPdf: (url: string, fileName: string) => void;
};

export function ProductProductionEditorScreen({ adapter, draft, layout, selectedMockup, mockupPrompt, referenceImageDataUrl, referenceImageName, editorMode, isGeneratingMockup, isGeneratingPdf, canUseLogo, logoImageUrl, logoVectorSvgUrl, onLayoutChange, onSizeChange, onRequestChange, onMockupPromptChange, onReferenceImageChange, onSelectMockup, onDeleteMockup, onSave, onSendMockupPrompt, onCompleteDesign, onGeneratePdf, onDownloadPdf }: ProductProductionEditorScreenProps) {
  const isEditMode = editorMode === "edit";
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const downloadPreviewRef = useRef<HTMLDivElement>(null);
  const activeBackgroundImageUrl = selectedMockup?.cleanImageUrl ?? selectedMockup?.imageUrl;

  return (
    <div className="grid w-full gap-4">
      <ProductionSizeCard title="인쇄 사이즈" description="이 제작 화면에서 인쇄 사이즈를 정해요. 사이즈를 바꾸면 현재 레이아웃 비율과 PDF 크기도 함께 바뀝니다." value={layout.sizeId} options={adapter.sizes} onChange={onSizeChange} />
      <SoftCard className="grid gap-3">
        <div>
          <p className="text-sm font-black text-ink">편집 화면</p>
          <p className="mt-1 text-xs font-bold leading-5 text-muted">현재 선택한 배경과 로고 위치를 같은 카드 폭에서 조정해요.</p>
        </div>
        <PrintProductEditor layout={layout} backgroundImageUrl={selectedMockup?.cleanImageUrl ?? selectedMockup?.imageUrl} logoImageUrl={logoImageUrl} logoVectorSvgUrl={logoVectorSvgUrl} onChange={onLayoutChange} />
      </SoftCard>
      <ProductionAiDesignRequestCard mode={editorMode} title={isEditMode ? "AI 디자인 수정" : "AI 디자인 요청"} description={isEditMode ? "프롬프트와 참고 이미지로 현재 디자인의 배경 후보를 다시 요청해요." : "프롬프트와 참고 이미지를 입력해 배경 후보를 만들고, 완료 저장한 뒤 바로 수정 화면으로 열어요."} promptValue={draft?.request ?? ""} promptPlaceholder="예: 초록색 중심, 멀리서도 잘 보이는 고급스러운 매장 홍보 배경" onPromptChange={onRequestChange} onTemporarySave={onSave} temporarySaveLabel="저장하기" onAiRequest={onSendMockupPrompt} isAiRequestLoading={isGeneratingMockup} aiRequestDisabled={isGeneratingMockup} showSaveDesign={Boolean(draft?.mockups.length)} onSaveDesign={onCompleteDesign} saveDesignLabel="저장하기">
        <ReferenceImageInput value={referenceImageDataUrl} name={referenceImageName} onChange={onReferenceImageChange} />
      </ProductionAiDesignRequestCard>
      {!isEditMode ? (
        <SoftCard className="grid gap-3">
          <p className="text-sm font-black text-ink">인쇄용 파일</p>
          <AppButton variant="secondary" onClick={() => draft?.pdfUrl && draft.pdfFileName ? onDownloadPdf(draft.pdfUrl, draft.pdfFileName) : onGeneratePdf()} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? "PDF 만드는 중" : draft?.pdfUrl ? "PDF 다운 받기" : "인쇄용 PDF 파일 만들기"}
          </AppButton>
          <AppButton
            variant="secondary"
            onClick={async () => {
              if (!downloadPreviewRef.current) {
                return;
              }

              setIsDownloadingImage(true);

              try {
                const dataUrl = await toPng(downloadPreviewRef.current, { cacheBust: true, pixelRatio: 2 });
                const link = document.createElement("a");
                link.href = dataUrl;
                link.download = `${adapter.productType}-preview.png`;
                link.click();
              } finally {
                setIsDownloadingImage(false);
              }
            }}
            disabled={isDownloadingImage || !activeBackgroundImageUrl}
          >
            {isDownloadingImage ? "이미지 만드는 중" : "이미지 다운로드"}
          </AppButton>
          <div className="sr-only" aria-hidden="true">
            <div ref={downloadPreviewRef} className="w-[420px] max-w-none">
              <PrintProductPreviewOverlay layout={layout} backgroundImageUrl={activeBackgroundImageUrl} logoImageUrl={logoImageUrl} logoVectorSvgUrl={logoVectorSvgUrl} />
            </div>
          </div>
        </SoftCard>
      ) : null}
      {!isEditMode ? <ProductionPromptCard value={mockupPrompt} onChange={onMockupPromptChange} /> : null}
      {draft?.mockups.length ? (
        <SoftCard>
          <p className="text-sm font-black text-ink">지금까지 생성한 이미지</p>
          <p className="mt-1 text-xs font-bold leading-5 text-muted">이 제작 건에서 만든 배경 후보를 모두 보여줘요. 카드를 누르면 현재 편집 배경으로 선택됩니다.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {draft.mockups.map((mockup) => (
              <div key={mockup.id} className={`grid gap-2 rounded-lg text-left ${mockup.id === selectedMockup?.id ? "ring-2 ring-primary-soft" : ""}`}>
                <button className="block w-full text-left" type="button" onClick={() => onSelectMockup(draft.id, mockup.id)}>
                  <PrintProductPreviewOverlay layout={layout} backgroundImageUrl={mockup.cleanImageUrl ?? mockup.imageUrl} logoImageUrl={logoImageUrl} logoVectorSvgUrl={logoVectorSvgUrl} />
                  <p className="mt-2 text-xs font-black text-ink">{mockup.title}</p>
                </button>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-muted">{mockup.id === selectedMockup?.id ? "선택됨" : "배경 후보"}</span>
                  <a className="text-[11px] font-black text-primary-strong underline underline-offset-2" href={mockup.imageUrl} target="_blank" rel="noreferrer">원본 보기</a>
                  {mockup.cleanImageUrl ? <a className="text-[11px] font-black text-primary-strong underline underline-offset-2" href={mockup.cleanImageUrl} target="_blank" rel="noreferrer">클린 보기</a> : null}
                  <button className="rounded-sm bg-surface-blue px-3 py-2 text-xs font-black text-danger" type="button" onClick={() => onDeleteMockup(draft.id, mockup.id)}>배경 이미지 삭제하기</button>
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

function ReferenceImageInput({ value, name, onChange }: { value?: string; name: string; onChange: (dataUrl: string | undefined, name: string) => void }) {
  const handleFileChange = (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      window.alert("참고 이미지는 8MB 이하의 이미지 파일만 사용할 수 있어요.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : undefined, file.name);
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid min-w-0 gap-3 overflow-hidden rounded-md bg-surface-blue p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black text-ink">참고 이미지</p>
          <p className="mt-1 text-[11px] font-bold leading-5 text-muted">분위기, 색감, 질감 참고용으로만 AI에 전달돼요.</p>
        </div>
        {value ? <button className="rounded-sm bg-white px-3 py-2 text-xs font-black text-danger" type="button" onClick={() => onChange(undefined, "")}>삭제</button> : null}
      </div>
      <input className="block w-full min-w-0 max-w-full overflow-hidden text-[11px] font-bold text-muted file:mr-2 file:rounded-sm file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-black file:text-primary-strong" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleFileChange(event.target.files?.[0])} />
      {value ? <div className="flex items-center gap-3 rounded-md bg-white p-2"><img className="h-16 w-16 rounded-sm object-cover" src={value} alt="참고 이미지 미리보기" /><p className="min-w-0 truncate text-xs font-bold text-ink">{name || "참고 이미지 선택됨"}</p></div> : null}
    </div>
  );
}
