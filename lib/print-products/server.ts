import "server-only";

import OpenAI from "openai";
import { buildPrintProductPdfHtml } from "@/lib/print-products/pdf-html";
import { normalizePrintProductLayout, printProductAdapters } from "@/lib/print-products/adapters";
import { runLimitedImageGeneration, readOpenAIImageModel } from "@/lib/ai-business-card/image-generation";
import { launchPrintyChromium } from "@/lib/server/chromium-renderer";
import { getPrintProductPromptSettings } from "@/lib/server/print-product-settings";
import { saveBrandAssetImageBytes } from "@/lib/server/storage";
import type { BrandAsset, PrintProductMockup, PrintProductProductionLayout, PrintProductProductionType } from "@/lib/types";

type MockupRequest = {
  brandId: string;
  productType: PrintProductProductionType;
  brandName: string;
  category: string;
  request: string;
  layout: PrintProductProductionLayout;
  promptOverride?: string;
};

function assertProductType(value: string): asserts value is PrintProductProductionType {
  if (value !== "banner" && value !== "signage" && value !== "flyer") {
    throw new Error("지원하지 않는 제작 상품이에요.");
  }
}

function safeFileName(value: string, fallback: string) {
  return value.trim().replace(/[^a-zA-Z0-9가-힣._-]+/g, "-").slice(0, 80) || fallback;
}

export function parsePrintProductMockupRequest(value: unknown): MockupRequest {
  if (typeof value !== "object" || value === null) {
    throw new Error("제작 요청이 올바르지 않아요.");
  }

  const record = value as Record<string, unknown>;
  const brandId = typeof record.brandId === "string" ? record.brandId.trim() : "";
  const productType = typeof record.productType === "string" ? record.productType.trim() : "";
  const brandName = typeof record.brandName === "string" ? record.brandName.trim() : "";
  const category = typeof record.category === "string" ? record.category.trim() : "";
  const request = typeof record.request === "string" ? record.request.trim() : "";
  const promptOverride = typeof record.promptOverride === "string" ? record.promptOverride.trim() : undefined;

  assertProductType(productType);

  if (!brandId || !brandName || typeof record.layout !== "object" || record.layout === null) {
    throw new Error("브랜드와 레이아웃 정보가 필요해요.");
  }

  return { brandId, productType, brandName, category, request, layout: normalizePrintProductLayout(record.layout as PrintProductProductionLayout), promptOverride };
}

export async function buildPrintProductMockupPrompt(input: MockupRequest) {
  const adapter = printProductAdapters[input.productType];
  const promptSettings = await getPrintProductPromptSettings().catch(() => undefined);
  const override = promptSettings?.[input.productType].mockupInstructions.trim();

  return [
    adapter.mockupPrompt,
    `Canvas ratio reference: ${input.layout.widthMm}mm x ${input.layout.heightMm}mm vertical artwork.`,
    `Selected background color: ${input.layout.backgroundColor}.`,
    input.category ? `Brand category for visual mood only: ${input.category}.` : "Use a polished commercial visual mood.",
    input.request ? `User background style request: ${input.request}` : "",
    override ? `Admin additional instructions for this product only: ${override}` : "",
    "The image should be one uninterrupted surface with smooth gradients, soft lighting, subtle texture, gentle depth, and abstract decoration.",
    "Keep the composition fluid and organic from top to bottom. Avoid any structured advertising-design look.",
  ].filter(Boolean).join("\n");
}

export async function generatePrintProductMockup(input: MockupRequest): Promise<{ mockup: PrintProductMockup; asset: BrandAsset }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI 이미지 생성 환경이 설정되지 않았어요.");
  }

  const adapter = printProductAdapters[input.productType];
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = input.promptOverride?.trim() || await buildPrintProductMockupPrompt(input);
  const response = await runLimitedImageGeneration((signal) => client.images.generate({ model: readOpenAIImageModel(), prompt, n: 1, size: "1024x1024", output_format: "png" }, { signal }));
  const imageData = response.data?.[0]?.b64_json;

  if (!imageData) {
    throw new Error("AI 이미지 생성 결과가 비어 있어요.");
  }

  const createdAt = new Date().toISOString();
  const stored = await saveBrandAssetImageBytes(Buffer.from(imageData, "base64"));
  const title = `${adapter.title} 배경 후보`;
  const mockup: PrintProductMockup = { id: `print-product-mockup-${Date.now()}`, imageUrl: stored.publicUrl, cleanImageUrl: stored.publicUrl, title, createdAt };
  const asset: BrandAsset = { id: `brand-asset-${input.productType}-${Date.now()}`, brandId: input.brandId, sectionId: adapter.sectionId, productId: adapter.productId, title, description: input.request || adapter.description, imageUrl: stored.publicUrl, assetType: "mockup", createdAt };

  return { mockup, asset };
}

export async function generatePrintProductPdf(input: { brandName: string; productType: PrintProductProductionType; layout: PrintProductProductionLayout; backgroundImageUrl?: string; logoImageUrl?: string; logoVectorSvgUrl?: string; origin?: string }) {
  const layout = normalizePrintProductLayout(input.layout);
  const html = buildPrintProductPdfHtml({ layout, backgroundImageUrl: input.backgroundImageUrl, logoImageUrl: input.logoImageUrl, logoVectorSvgUrl: input.logoVectorSvgUrl, origin: input.origin });
  const browser = await launchPrintyChromium();

  try {
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const bytes = await page.pdf({ printBackground: true, preferCSSPageSize: true, width: `${layout.widthMm}mm`, height: `${layout.heightMm}mm` });
    const fileName = `printy-${input.productType}-${safeFileName(input.brandName, input.productType)}-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}.pdf`;

    return { bytes, fileName };
  } finally {
    await browser.close();
  }
}
