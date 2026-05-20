import "server-only";

import { createCleanBusinessCardBackgrounds, type AiBusinessCardCleanBackgrounds } from "@/lib/ai-business-card/backgrounds";
import { buildAiBusinessCardHtml } from "@/lib/ai-business-card/renderer";
import type { AiBusinessCardDesign, AiBusinessCardInput } from "@/lib/ai-business-card/schema";
import { launchPrintyChromium } from "@/lib/server/chromium-renderer";

export type AiBusinessCardPdfResult = {
  bytes: Uint8Array;
  fileName: string;
  notes: string[];
};

function safePdfFileName(brandName: string) {
  const normalized = brandName.trim().replace(/[^a-zA-Z0-9가-힣._-]+/g, "-").slice(0, 80) || "business-card";
  const generatedAt = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  return `printy-ai-${normalized}-${generatedAt}.pdf`;
}

export async function generateAiBusinessCardPdf(design: AiBusinessCardDesign, input: AiBusinessCardInput, options: { origin?: string; includeProductionMarks?: boolean; mockupImageUrl?: string; cleanMockupImageUrl?: string; cleanBackgrounds?: AiBusinessCardCleanBackgrounds } = {}): Promise<AiBusinessCardPdfResult> {
  if (!options.cleanBackgrounds && !options.cleanMockupImageUrl) {
    throw new Error("클린 명함 목업 이미지가 필요해요. 목업을 다시 생성해 주세요.");
  }

  const cleanBackgrounds = options.cleanBackgrounds ?? await createCleanBusinessCardBackgrounds(options.cleanMockupImageUrl ?? "");
  const printHtml = await buildAiBusinessCardHtml(design, input, { origin: options.origin, includeProductionMarks: options.includeProductionMarks ?? true, cleanBackgrounds });
  const browser = await launchPrintyChromium();

  try {
    const page = await browser.newPage();

    await page.setContent(printHtml.html, { waitUntil: "domcontentloaded" });
    const bytes = await page.pdf({ printBackground: true, preferCSSPageSize: true, width: `${printHtml.mediaWidthMm}mm`, height: `${printHtml.mediaHeightMm}mm` });

    return { bytes, fileName: safePdfFileName(input.brandName), notes: printHtml.notes };
  } finally {
    await browser.close();
  }
}
