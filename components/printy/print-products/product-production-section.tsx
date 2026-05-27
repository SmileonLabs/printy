"use client";

import { ProductProductionEditorScreen } from "@/components/printy/print-products/product-production-editor-screen";
import { ProductProductionListScreen } from "@/components/printy/print-products/product-production-list-screen";
import { ToastNotice, ToastNoticeViewport } from "@/components/printy/shared/toast-notice";
import { useProductProductionController } from "@/components/printy/print-products/use-product-production-controller";
import { downloadUrl } from "@/lib/client/download";
import type { Brand, PrintProductProductionType, ResolvedLogoOption } from "@/lib/types";

type ProductProductionSectionProps = {
  brand: Brand;
  productType: PrintProductProductionType;
  logo: ResolvedLogoOption;
};

export function ProductProductionSection({ brand, productType, logo }: ProductProductionSectionProps) {
  const controller = useProductProductionController(brand, productType, logo);

  if (controller.isEditorOpen) {
    return (
      <>
        <ProductProductionToast message={controller.status} loading={controller.isGeneratingLayout || controller.isGeneratingMockup || controller.isGeneratingPdf} onDismiss={controller.clearStatus} />
        <ProductProductionEditorScreen
          adapter={controller.adapter}
          draft={controller.draft}
          layout={controller.layout}
          selectedMockup={controller.selectedMockup}
          mockupPrompt={controller.mockupPrompt}
          editorMode={controller.editorMode}
          isGeneratingMockup={controller.isGeneratingMockup}
          isGeneratingPdf={controller.isGeneratingPdf}
          canUseLogo={controller.canUseLogo}
          logoImageUrl={controller.logoImageUrl}
          logoVectorSvgUrl={controller.logoVectorSvgUrl}
          onLayoutChange={controller.updateCurrentLayout}
          onSizeChange={controller.updateSize}
          onRequestChange={controller.updateRequest}
          onMockupPromptChange={controller.setMockupPrompt}
          onSelectMockup={controller.selectMockup}
          onDeleteMockup={controller.deleteMockup}
          onSave={controller.saveLayout}
          onSendMockupPrompt={controller.sendMockupPrompt}
          onCompleteDesign={controller.completeSelectedDesign}
          onGeneratePdf={() => controller.generatePdf()}
          onDownloadPdf={downloadUrl}
        />
      </>
    );
  }

  return (
    <>
      <ProductProductionToast message={controller.status} loading={controller.isGeneratingLayout || controller.isGeneratingMockup || controller.isGeneratingPdf} onDismiss={controller.clearStatus} />
      <ProductProductionListScreen
        adapter={controller.adapter}
        draft={controller.draft}
        temporaryDrafts={controller.temporaryDrafts}
        completedDrafts={controller.completedDrafts}
        logoImageUrl={controller.logoImageUrl}
        logoVectorSvgUrl={controller.logoVectorSvgUrl}
        isGeneratingPdf={controller.isGeneratingPdf}
        isGeneratingLayout={controller.isGeneratingLayout}
        layoutPrompt={controller.layoutPrompt}
        onLayoutPromptChange={controller.setLayoutPrompt}
        onStartNewDesign={controller.startNewDesign}
        onStartNewDesignWithAiLayout={controller.startNewDesignWithAiLayout}
        onLoadDraft={controller.loadDraft}
        onDeleteDraft={controller.deleteDraft}
        onEditCompletedDraft={controller.editCompletedDraft}
        onDeleteCompletedDraft={controller.deleteDraft}
        onGeneratePdf={controller.generatePdf}
        onDownloadPdf={downloadUrl}
      />
    </>
  );
}

function ProductProductionToast({ message, loading, onDismiss }: { message: string; loading: boolean; onDismiss: () => void }) {
  if (!message) {
    return null;
  }

  const tone = message.includes("못") || message.includes("초과") || message.includes("필요") ? "danger" : message.includes("완료") || message.includes("삭제") || message.includes("다운로드") || message.includes("저장") ? "success" : "info";

  return (
    <ToastNoticeViewport>
      <ToastNotice eyebrow="제작 작업" message={message} tone={tone} loading={loading} onDismiss={onDismiss} />
    </ToastNoticeViewport>
  );
}
