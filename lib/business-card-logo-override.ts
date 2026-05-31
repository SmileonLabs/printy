import type { BusinessCardLogoImageOverride, ResolvedLogoOption } from "@/lib/types";

type ResolvedLogoWithImage = Extract<ResolvedLogoOption, { imageUrl: string }>;

export function logoOptionHasImage(logo: ResolvedLogoOption | undefined): logo is ResolvedLogoWithImage {
  return Boolean(logo && "imageUrl" in logo);
}

export function applyBusinessCardLogoImageOverride(logo: ResolvedLogoOption | undefined, override: BusinessCardLogoImageOverride | undefined): ResolvedLogoOption | undefined {
  if (!logoOptionHasImage(logo) || !override || override.logoId !== logo.id || !override.imageUrl.trim() || !override.originalImageUrl.trim()) {
    return logo;
  }

  return {
    ...logo,
    imageUrl: override.imageUrl,
    originalImageUrl: override.originalImageUrl,
    backgroundRemovedImageUrl: override.backgroundRemovedImageUrl,
  };
}
