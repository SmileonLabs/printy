import "server-only";

import type { AiBusinessCardDesign, AiBusinessCardElement, AiBusinessCardIconKind, AiBusinessCardInput, AiBusinessCardSideId, AiBusinessCardTextElement, AiBusinessCardTextField } from "@/lib/ai-business-card/schema";
import type { BusinessCardTemplateBox, BusinessCardTemplateIconElement, BusinessCardTemplateIconId, BusinessCardTemplateSideId, BusinessCardTemplateTextElement, BusinessCardTemplateTextWeight, PrintTemplate } from "@/lib/types";

const sideIds: AiBusinessCardSideId[] = ["front", "back"];
const templateWidthMm = 92;
const templateHeightMm = 52;
const iconTextGapMm = 0.5;
const iconFieldByTemplateIcon: Partial<Record<BusinessCardTemplateIconId, AiBusinessCardTextField>> = {
  name: "name",
  role: "role",
  mobile: "phone",
  phone: "mainPhone",
  email: "email",
  location: "address",
  address: "address",
  fax: "fax",
  web: "website",
  account: "account",
  instagram: "instagram",
};
const fontWeightByTemplateWeight: Record<BusinessCardTemplateTextWeight, AiBusinessCardTextElement["fontWeight"]> = {
  regular: "regular",
  bold: "bold",
};

function fieldTextValue(input: AiBusinessCardInput, field: AiBusinessCardTextField) {
  if (field === "brandName" || field === "category") {
    return "";
  }

  if (field === "qrCode") {
    return input.member.qrCodeImageUrl?.trim() ?? "";
  }

  if (field.startsWith("headline-") || field.startsWith("body-")) return "";
  return input.member[field as keyof Pick<AiBusinessCardInput["member"], "name" | "role" | "phone" | "mainPhone" | "fax" | "email" | "website" | "address" | "account" | "instagram">]?.trim() ?? "";
}

function shouldUseInstagramIcon(input: AiBusinessCardInput, sideId: BusinessCardTemplateSideId) {
  const selectedElements = selectedElementsForSide(input, sideId);

  return !selectedElements || selectedElements.includes("instagram") || selectedElements.includes("instagramIcon");
}

function templateBoxToMm(box: BusinessCardTemplateBox) {
  return {
    xMm: box.x / 100 * templateWidthMm,
    yMm: box.y / 100 * templateHeightMm,
    widthMm: box.width / 100 * templateWidthMm,
    heightMm: box.height / 100 * templateHeightMm,
  };
}

function selectedElementsForSide(input: AiBusinessCardInput, sideId: BusinessCardTemplateSideId) {
  return sideId === "front" ? input.productionOptions?.frontElements : input.productionOptions?.backElements;
}

function selectedLogoUrl(input: AiBusinessCardInput, assetType: "png" | "svg" | undefined) {
  const logo = input.logo;

  if (!logo || !("imageUrl" in logo)) {
    return undefined;
  }

  return assetType === "svg" && logo.vectorSvgUrl ? logo.vectorSvgUrl : logo.imageUrl;
}

function shouldUseTemplateField(input: AiBusinessCardInput, sideId: BusinessCardTemplateSideId, field: AiBusinessCardTextElement["field"] | AiBusinessCardTextField) {
  const selectedElements = selectedElementsForSide(input, sideId);

  return !selectedElements || selectedElements.includes(field);
}

function sideHasIconForField(input: AiBusinessCardInput, sideId: BusinessCardTemplateSideId, icons: BusinessCardTemplateIconElement[], field: AiBusinessCardTextField) {
  return icons.some((icon) => icon.visible && iconFieldByTemplateIcon[icon.icon] === field && fieldTextValue(input, field) && shouldUseTemplateField(input, sideId, field));
}

function textElementFromTemplateField(input: AiBusinessCardInput, sideId: BusinessCardTemplateSideId, icons: BusinessCardTemplateIconElement[], field: BusinessCardTemplateTextElement, layer: number): AiBusinessCardElement | undefined {
  const value = field.customValue?.trim() || fieldTextValue(input, field.id);

  if (!field.visible || !value || !shouldUseTemplateField(input, sideId, field.id)) {
    return undefined;
  }

  if (field.id === "qrCode") {
    return {
      type: "image",
      src: value,
      ...templateBoxToMm(field.box),
      fit: "contain",
      layer,
    };
  }

  const box = templateBoxToMm(field.box);
  const gapMm = sideHasIconForField(input, sideId, icons, field.id) ? iconTextGapMm : 0;

  return {
    type: "text",
    field: field.id,
    ...box,
    xMm: box.xMm + gapMm,
    widthMm: Math.max(1, box.widthMm - gapMm),
    fontFamily: "Noto Sans KR",
    fontWeight: field.id === "name" ? "bold" : fontWeightByTemplateWeight[field.fontWeight],
    fontSizePt: Math.max(1, Math.min(32, field.fontSize * 0.375)),
    color: field.color,
    align: field.align,
    layer,
  };
}

function templateIconToAiIcon(icon: BusinessCardTemplateIconId): AiBusinessCardIconKind | undefined {
  if (icon === "building") {
    return "company";
  }

  return icon;
}

function iconElementFromTemplateIcon(input: AiBusinessCardInput, sideId: BusinessCardTemplateSideId, icon: BusinessCardTemplateIconElement, layer: number): AiBusinessCardElement | undefined {
  const aiIcon = templateIconToAiIcon(icon.icon);
  const field = iconFieldByTemplateIcon[icon.icon];

  if (!icon.visible || !aiIcon || (icon.icon === "instagram" && (!fieldTextValue(input, "instagram") || !shouldUseInstagramIcon(input, sideId))) || (field && icon.icon !== "instagram" && (!fieldTextValue(input, field) || !shouldUseTemplateField(input, sideId, field)))) {
    return undefined;
  }

  return {
    type: "icon",
    icon: aiIcon,
    ...templateBoxToMm(icon.box),
    color: icon.color,
    layer,
  };
}

function templateBackgroundColor(template: PrintTemplate, sideId: BusinessCardTemplateSideId) {
  const background = template.layout?.sides[sideId].background;

  if (!background?.enabled) {
    return "#ffffff";
  }

  return "color" in background && background.color ? background.color : "#ffffff";
}

export class AiBusinessCardDesignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiBusinessCardDesignError";
  }
}

export function createAiBusinessCardDesignFromTemplate(input: AiBusinessCardInput, template: PrintTemplate): AiBusinessCardDesign {
  const layout = input.productionOptions?.layout ?? template.layout;

  if (!layout) {
    throw new AiBusinessCardDesignError("관리자 명함 템플릿에 레이아웃 정보가 없어요.");
  }

  const sides = {
    front: { background: { color: templateBackgroundColor(template, "front") }, elements: [] as AiBusinessCardElement[] },
    back: { background: { color: templateBackgroundColor(template, "back") }, elements: [] as AiBusinessCardElement[] },
  };
  let layer = 20;

  for (const sideId of sideIds) {
    const side = layout.sides[sideId];
    const logoUrl = selectedLogoUrl(input, side.logo.assetType);

    if (side.logo.visible && logoUrl) {
      sides[sideId].elements.push({ type: "image", src: logoUrl, ...templateBoxToMm(side.logo.box), fit: "contain", imageFilter: side.logo.imageFilter, layer });
      layer += 1;
    }

    for (const icon of side.icons) {
      const element = iconElementFromTemplateIcon(input, sideId, icon, layer);

      if (element) {
        sides[sideId].elements.push(element);
        layer += 1;
      }
    }

    for (const field of side.fields) {
      const element = textElementFromTemplateField(input, sideId, side.icons, field, layer);

      if (element) {
        sides[sideId].elements.push(element);
        layer += 1;
      }
    }
  }

  if (sides.front.elements.length === 0 && sides.back.elements.length === 0) {
    throw new AiBusinessCardDesignError("관리자 템플릿에서 렌더링할 명함 요소를 찾지 못했어요.");
  }

  return {
    version: 1,
    canvas: { widthMm: 92, heightMm: 52, bleedMm: 0, safeMarginMm: 4 },
    sides,
  };
}
