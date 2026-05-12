import type { BrandDetailSectionId } from "@/lib/types";

export function getProductForSection(sectionId: BrandDetailSectionId) {
  const productBySection: Record<BrandDetailSectionId, string> = {
    style: "business-card",
    team: "business-card",
    cards: "business-card",
    promotions: "flyer",
    banners: "banner",
    signage: "poster",
    files: "sticker",
  };

  return productBySection[sectionId];
}
