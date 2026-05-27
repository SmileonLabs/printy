import type { DesignBackground, DesignElement, DesignLayout, DesignMockup, DesignProject } from "@/lib/design-projects/types";
import type { AiBusinessCardMockup, BusinessCardDraft, BusinessCardTemplateBackground, BusinessCardTemplateLayout, BusinessCardTemplateSideId } from "@/lib/types";

const sideLabels: Record<BusinessCardTemplateSideId, string> = { front: "앞면", back: "뒷면" };

function backgroundFromBusinessCard(background: BusinessCardTemplateBackground): DesignBackground {
  if (!background.enabled) {
    return { type: "none" };
  }

  if (background.type === "color") {
    return { type: "color", color: background.color };
  }

  return background.color ? { type: "image", imageUrl: background.imageUrl, color: background.color } : { type: "image", imageUrl: background.imageUrl };
}

export function businessCardLayoutToDesignLayout(layout: BusinessCardTemplateLayout): DesignLayout {
  return {
    canvas: {
      widthMm: layout.canvas.trim.widthMm,
      heightMm: layout.canvas.trim.heightMm,
      bleedMm: 0,
    },
    pages: (["front", "back"] as const).map((sideId) => {
      const side = layout.sides[sideId];
      const elements: DesignElement[] = [
        { type: "logo", id: `${sideId}:logo`, visible: side.logo.visible, box: side.logo.box, assetType: side.logo.assetType },
        ...side.fields.map((field) => field.id === "qrCode"
          ? { type: "qr" as const, id: `${sideId}:field:${field.id}`, label: field.id, fieldId: field.id, value: field.customValue, visible: field.visible, box: field.box }
          : { type: "text" as const, id: `${sideId}:field:${field.id}`, label: field.id, fieldId: field.id, value: field.customValue, visible: field.visible, box: field.box, fontFamily: field.fontFamily, fontSize: field.fontSize, color: field.color, fontWeight: field.fontWeight, italic: field.italic, align: field.align }),
        ...side.icons.map((icon) => ({ type: "icon" as const, id: `${sideId}:icon:${icon.id}`, icon: icon.icon, visible: icon.visible, box: icon.box, color: icon.color, textGapPx: icon.textGapPx })),
        ...side.lines.map((line) => ({ type: "line" as const, id: `${sideId}:line:${line.id}`, orientation: line.orientation, visible: line.visible, box: line.box, color: line.color })),
      ];

      return { id: sideId, label: sideLabels[sideId], background: backgroundFromBusinessCard(side.background), elements };
    }),
  };
}

export function aiBusinessCardMockupToDesignMockup(mockup: AiBusinessCardMockup, fallbackLayout: BusinessCardTemplateLayout, createdAt: string): DesignMockup {
  return {
    id: mockup.id,
    imageUrl: mockup.imageUrl,
    cleanImageUrl: mockup.cleanImageUrl,
    title: mockup.title,
    layoutSnapshot: businessCardLayoutToDesignLayout(mockup.layout ?? fallbackLayout),
    createdAt,
    source: "ai-business-card-mockup",
  };
}

export function businessCardDraftToDesignProject(draft: BusinessCardDraft, mockups: AiBusinessCardMockup[] = []): DesignProject | undefined {
  if (!draft.brandId || !draft.layout) {
    return undefined;
  }

  const designMockups = mockups.map((mockup) => aiBusinessCardMockupToDesignMockup(mockup, draft.layout as BusinessCardTemplateLayout, draft.completedMockupAt ?? draft.createdAt));

  return {
    id: `legacy-business-card:${draft.id}`,
    brandId: draft.brandId,
    productType: "business-card",
    title: `${draft.member.name || draft.brandName || "명함"} 명함`,
    status: draft.completedMockupSignature || designMockups.length > 0 ? "completed" : "draft",
    layout: businessCardLayoutToDesignLayout(draft.layout),
    mockups: designMockups,
    selectedMockupId: designMockups[0]?.id,
    source: "business-card-draft",
    legacyId: draft.id,
    createdAt: draft.createdAt,
    updatedAt: draft.completedMockupAt ?? draft.createdAt,
  };
}
