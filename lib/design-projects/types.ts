import type { BusinessCardTemplateFontFamily, BusinessCardTemplateIconId, BusinessCardTemplateTextAlign, BusinessCardTemplateTextFieldId, BusinessCardTemplateTextWeight, PrintProductProductionType } from "@/lib/types";

export type DesignProductType = "business-card" | PrintProductProductionType | "flyer" | "poster" | "brochure" | "sticker";

export type DesignProjectStatus = "draft" | "completed";

export type DesignProjectSource = "business-card-draft" | "ai-business-card-mockup" | "print-product-draft" | "design-project";

export type DesignBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DesignBackground =
  | { type: "none" }
  | { type: "color"; color: string }
  | { type: "image"; imageUrl: string; color?: string };

export type DesignTextElement = {
  type: "text";
  id: string;
  label?: string;
  fieldId?: BusinessCardTemplateTextFieldId | string;
  value?: string;
  visible: boolean;
  box: DesignBox;
  fontFamily: BusinessCardTemplateFontFamily;
  fontSize: number;
  color: string;
  fontWeight: BusinessCardTemplateTextWeight;
  italic: boolean;
  align: BusinessCardTemplateTextAlign;
};

export type DesignLogoElement = {
  type: "logo";
  id: string;
  visible: boolean;
  box: DesignBox;
  assetType?: "png" | "svg";
};

export type DesignQrElement = {
  type: "qr";
  id: string;
  label?: string;
  fieldId?: string;
  value?: string;
  visible: boolean;
  box: DesignBox;
};

export type DesignIconElement = {
  type: "icon";
  id: string;
  icon: BusinessCardTemplateIconId;
  visible: boolean;
  box: DesignBox;
  color: string;
  textGapPx?: number;
};

export type DesignLineElement = {
  type: "line";
  id: string;
  orientation: "horizontal" | "vertical";
  visible: boolean;
  box: DesignBox;
  color: string;
};

export type DesignShapeElement = {
  type: "shape";
  id: string;
  label?: string;
  prompt?: string;
  visible: boolean;
  box: DesignBox;
  fillColor: string;
  strokeColor: string;
  textColor?: string;
  glyph?: string;
};

export type DesignElement = DesignTextElement | DesignLogoElement | DesignQrElement | DesignIconElement | DesignLineElement | DesignShapeElement;

export type DesignPage = {
  id: string;
  label: string;
  background: DesignBackground;
  elements: DesignElement[];
};

export type DesignLayout = {
  canvas: {
    widthMm: number;
    heightMm: number;
    bleedMm?: number;
    safeMarginMm?: number;
  };
  pages: DesignPage[];
};

export type DesignMockup = {
  id: string;
  imageUrl: string;
  cleanImageUrl?: string;
  title: string;
  layoutSnapshot: DesignLayout;
  createdAt: string;
  source?: DesignProjectSource;
};

export type DesignPdfRecord = {
  url: string;
  fileName: string;
  createdAt?: string;
};

export type DesignProject = {
  id: string;
  brandId: string;
  productType: DesignProductType;
  title: string;
  status: DesignProjectStatus;
  layout: DesignLayout;
  mockups: DesignMockup[];
  selectedMockupId?: string;
  pdf?: DesignPdfRecord;
  source: DesignProjectSource;
  legacyId?: string;
  createdAt: string;
  updatedAt: string;
};
