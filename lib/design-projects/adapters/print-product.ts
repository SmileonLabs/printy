import type { DesignBackground, DesignElement, DesignLayout, DesignMockup, DesignProject } from "@/lib/design-projects/types";
import type { PrintProductDraft, PrintProductMockup, PrintProductProductionLayout } from "@/lib/types";

function backgroundFromPrintProduct(layout: PrintProductProductionLayout): DesignBackground {
  return { type: "color", color: layout.backgroundColor };
}

export function printProductLayoutToDesignLayout(layout: PrintProductProductionLayout): DesignLayout {
  const elements: DesignElement[] = [
    { type: "logo", id: "page:logo", visible: layout.logo.visible, box: layout.logo.box, assetType: layout.logo.assetType },
    ...layout.fields.map((field) => field.id === "qrCode"
      ? { type: "qr" as const, id: `page:field:${field.id}`, label: field.label, fieldId: field.id, value: field.value, visible: field.visible, box: field.box }
      : { type: "text" as const, id: `page:field:${field.id}`, label: field.label, fieldId: field.id, value: field.value, visible: field.visible, box: field.box, fontFamily: field.fontFamily ?? "sans", fontSize: field.fontSize, color: field.color, fontWeight: field.fontWeight, italic: Boolean(field.italic), align: field.align }),
    ...(layout.promptShapes ?? []).map((shape) => ({ type: "shape" as const, id: `page:shape:${shape.id}`, label: shape.label, prompt: shape.prompt, visible: shape.visible, box: shape.box, fillColor: shape.fillColor, strokeColor: shape.strokeColor, textColor: shape.textColor, glyph: shape.glyph })),
  ];

  return {
    canvas: {
      widthMm: layout.widthMm,
      heightMm: layout.heightMm,
      bleedMm: 0,
    },
    pages: [{ id: "page", label: "시안", background: backgroundFromPrintProduct(layout), elements }],
  };
}

export function printProductMockupToDesignMockup(mockup: PrintProductMockup, layout: PrintProductProductionLayout): DesignMockup {
  return {
    id: mockup.id,
    imageUrl: mockup.imageUrl,
    cleanImageUrl: mockup.cleanImageUrl,
    title: mockup.title,
    layoutSnapshot: printProductLayoutToDesignLayout(layout),
    createdAt: mockup.createdAt,
    source: "print-product-draft",
  };
}

export function printProductDraftToDesignProject(draft: PrintProductDraft): DesignProject {
  const mockups = draft.mockups.map((mockup) => printProductMockupToDesignMockup(mockup, draft.layout));

  return {
    id: `legacy-print-product:${draft.id}`,
    brandId: draft.brandId,
    productType: draft.productType,
    title: draft.title,
    status: mockups.length > 0 || draft.pdfUrl ? "completed" : "draft",
    layout: printProductLayoutToDesignLayout(draft.layout),
    mockups,
    selectedMockupId: draft.selectedMockupId,
    pdf: draft.pdfUrl && draft.pdfFileName ? { url: draft.pdfUrl, fileName: draft.pdfFileName, createdAt: draft.updatedAt } : undefined,
    source: "print-product-draft",
    legacyId: draft.id,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}
