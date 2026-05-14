import "server-only";

import { getPublishedBrandMockupTemplate } from "@/lib/server/brand-mockup-template-store";
import { readAdminMockupTemplateBytesByPublicUrl, readGeneratedLogoBytesByPublicUrl, saveBrandAssetImageBytes } from "@/lib/server/storage";
import type { BrandAsset } from "@/lib/types";

type BrandMockupInput = {
  brandId: string;
  brandName: string;
  category: string;
  logoImageUrl: string;
  templateId: string;
};

async function createMockupImage(logoBytes: Uint8Array, templateBytes: Uint8Array, placement: { left: number; top: number; width: number; height: number; rotation: number }) {
  const sharp = (await import("sharp")).default;
  const background = sharp(templateBytes);
  const metadata = await background.metadata();
  const backgroundWidth = metadata.width ?? 1200;
  const backgroundHeight = metadata.height ?? 800;
  const logoWidth = Math.max(1, Math.round(backgroundWidth * (placement.width / 100)));
  const logoHeight = Math.max(1, Math.round(backgroundHeight * (placement.height / 100)));
  const logoLeft = Math.round(backgroundWidth * (placement.left / 100));
  const logoTop = Math.round(backgroundHeight * (placement.top / 100));
  const logoLayer = await sharp(logoBytes)
    .resize({ width: logoWidth, height: logoHeight, fit: "contain" })
    .rotate(placement.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return background
    .composite([{ input: logoLayer, left: logoLeft, top: logoTop, blend: "over" }])
    .png()
    .toBuffer();
}

export async function generateBrandMockup(input: BrandMockupInput): Promise<BrandAsset> {
  const logoBytes = await readGeneratedLogoBytesByPublicUrl(input.logoImageUrl);

  if (!logoBytes) {
    throw new Error("Generated logo image is unavailable.");
  }

  const template = await getPublishedBrandMockupTemplate(input.templateId);

  if (!template) {
    throw new Error("Unknown brand mockup template.");
  }

  const templateImage = await readAdminMockupTemplateBytesByPublicUrl(template.imageUrl);

  if (!templateImage) {
    throw new Error("Brand mockup template image is unavailable.");
  }

  const createdAt = new Date().toISOString();
  const mockupImage = await createMockupImage(logoBytes, templateImage.bytes, template.placement);
  const stored = await saveBrandAssetImageBytes(mockupImage);

  return {
    id: `brand-asset-${template.id}-${Date.now()}`,
    brandId: input.brandId,
    sectionId: "style",
    productId: `brand-mockup-${template.id}`,
    title: template.title,
    description: template.description,
    imageUrl: stored.publicUrl,
    assetType: "mockup",
    createdAt,
  };
}
