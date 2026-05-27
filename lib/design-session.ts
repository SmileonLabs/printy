import { createBusinessCardLayoutFromSelection } from "@/lib/business-card-layout-generator";
import type { BusinessCardProductionOptions, BusinessCardTemplateLayout } from "@/lib/types";

export type DesignSessionMode = "new" | "draft" | "edit";

export type BusinessCardSizeOption = {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
};

export const businessCardSizeOptions: BusinessCardSizeOption[] = [
  { id: "business-card-90x50", label: "일반 명함 90 x 50mm", widthMm: 90, heightMm: 50 },
  { id: "business-card-50x90", label: "세로 명함 50 x 90mm", widthMm: 50, heightMm: 90 },
];

export const defaultBusinessCardSizeId = businessCardSizeOptions[0].id;

export function resolveBusinessCardSize(sizeId: string | undefined, fallbackLayout?: BusinessCardTemplateLayout) {
  const exact = businessCardSizeOptions.find((size) => size.id === sizeId);

  if (exact) {
    return exact;
  }

  if (fallbackLayout) {
    const { widthMm, heightMm } = fallbackLayout.canvas.trim;
    const fromLayout = businessCardSizeOptions.find((size) => size.widthMm === widthMm && size.heightMm === heightMm);

    if (fromLayout) {
      return fromLayout;
    }
  }

  return businessCardSizeOptions[0];
}

export function sizeBusinessCardLayout(layout: BusinessCardTemplateLayout, sizeId: string | undefined) {
  const size = resolveBusinessCardSize(sizeId, layout);

  return {
    ...layout,
    canvas: {
      ...layout.canvas,
      trim: { widthMm: size.widthMm, heightMm: size.heightMm },
    },
  } satisfies BusinessCardTemplateLayout;
}

export function createSizedBusinessCardLayout(options: Pick<BusinessCardProductionOptions, "frontElements" | "backElements" | "sizeId">) {
  return sizeBusinessCardLayout(createBusinessCardLayoutFromSelection(options), options.sizeId);
}

export function businessCardProductionSizeFields(sizeId: string | undefined, layout?: BusinessCardTemplateLayout) {
  const size = resolveBusinessCardSize(sizeId, layout);

  return { sizeId: size.id, widthMm: size.widthMm, heightMm: size.heightMm };
}

export function editSessionTitle(title: string) {
  return `${title} 수정본`;
}

export function designSessionMessage(productTitle: string, mode: DesignSessionMode, title?: string) {
  if (mode === "new") {
    return `새 ${productTitle} 디자인을 시작했어요.`;
  }

  if (mode === "edit") {
    return `${title ?? productTitle} 디자인 수정본을 만들었어요.`;
  }

  return `${title ?? productTitle} 디자인을 불러왔어요.`;
}
