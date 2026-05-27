export type * from "@/lib/design-projects/types";
export { normalizeDesignLayout, normalizeDesignMockup, normalizeDesignProject } from "@/lib/design-projects/normalizers";
export { aiBusinessCardMockupToDesignMockup, businessCardDraftToDesignProject, businessCardLayoutToDesignLayout } from "@/lib/design-projects/adapters/business-card";
export { printProductDraftToDesignProject, printProductLayoutToDesignLayout, printProductMockupToDesignMockup } from "@/lib/design-projects/adapters/print-product";
export { buildLegacyDesignProjectsForBrand, countDesignProjectsByProduct } from "@/lib/design-projects/project-list";
export { cssUrl, designBackgroundStyle, designBoxStyle, designCleanMockupPageStyle, designElementValue, designLayoutAspectRatio, designPageFrameStyle, designTextStyle, visibleDesignElements } from "@/lib/design-projects/rendering";
export type { DesignElementValues } from "@/lib/design-projects/rendering";
export { canvasBoxesIntersect, canvasBoxStyle, clampCanvasValue, moveCanvasBox, readCanvasSelectionBox, resizeCanvasBox, resizeCanvasTextBoxToContent, roundCanvasPercent, snapCanvasPercent, updateCanvasBoxValue } from "@/lib/design-projects/canvas-geometry";
export type { CanvasResizeCorner, CanvasSelectionBox } from "@/lib/design-projects/canvas-geometry";
