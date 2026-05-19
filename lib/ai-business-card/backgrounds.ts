import "server-only";

import sharp from "sharp";
import type { AiBusinessCardSideId } from "@/lib/ai-business-card/schema";
import { readBrandAssetBytesByPublicUrl } from "@/lib/server/storage";

export type AiBusinessCardCleanBackgrounds = Record<AiBusinessCardSideId, string>;

const outputPixelWidth = 920;
const outputPixelHeight = 520;
const sideIds: AiBusinessCardSideId[] = ["front", "back"];

export class AiBusinessCardBackgroundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiBusinessCardBackgroundError";
  }
}

function cropBoundsFromSheetHalf(sideId: AiBusinessCardSideId, imageWidth: number, imageHeight: number) {
  const halfHeight = Math.floor(imageHeight / 2);

  if (halfHeight <= 0) {
    throw new AiBusinessCardBackgroundError("AI business card sheet crop bounds are invalid.");
  }

  return {
    left: 0,
    top: sideId === "front" ? 0 : halfHeight,
    width: imageWidth,
    height: sideId === "front" ? halfHeight : imageHeight - halfHeight,
  };
}

export async function createCleanBusinessCardBackgrounds(cleanMockupImageUrl: string): Promise<AiBusinessCardCleanBackgrounds | undefined> {
  if (!cleanMockupImageUrl) {
    return undefined;
  }

  const mockupBytes = await readBrandAssetBytesByPublicUrl(cleanMockupImageUrl);

  if (!mockupBytes) {
    throw new AiBusinessCardBackgroundError("AI business card clean mockup image could not be loaded.");
  }

  const image = sharp(mockupBytes).ensureAlpha();
  const metadata = await image.metadata();
  const imageWidth = metadata.width ?? 0;
  const imageHeight = metadata.height ?? 0;

  if (imageWidth <= 0 || imageHeight <= 0) {
    throw new AiBusinessCardBackgroundError("AI business card clean mockup image dimensions could not be read.");
  }

  const entries = await Promise.all(sideIds.map(async (sideId) => {
    const bounds = cropBoundsFromSheetHalf(sideId, imageWidth, imageHeight);
    const backgroundBytes = await sharp(mockupBytes)
      .extract(bounds)
      .resize(outputPixelWidth, outputPixelHeight, { fit: "fill" })
      .png()
      .toBuffer();

    return [sideId, `data:image/png;base64,${backgroundBytes.toString("base64")}`] as const;
  }));

  return Object.fromEntries(entries) as AiBusinessCardCleanBackgrounds;
}
