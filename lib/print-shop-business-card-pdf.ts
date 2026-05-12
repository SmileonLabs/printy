import "server-only";

import { buildPrintShopBusinessCardHtml, type PrintShopBusinessCardRenderData } from "@/lib/print-shop-business-card-html";
import { launchPrintyChromium } from "@/lib/server/chromium-renderer";
import type { PrintTemplate } from "@/lib/types";

type PrintShopBusinessCardPdfResult = {
  bytes: Uint8Array;
  fileName: string;
  notes: string[];
};

type GeneratePrintShopBusinessCardPdfOptions = {
  origin?: string;
  includeProductionMarks?: boolean;
  renderData?: PrintShopBusinessCardRenderData;
};

function safePdfFileName(template: PrintTemplate) {
  const safeId = template.id.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80) || "template";

  return `printy-business-card-${safeId}-print-shop.pdf`;
}

export async function generatePrintShopBusinessCardPdf(template: PrintTemplate, options: GeneratePrintShopBusinessCardPdfOptions = {}): Promise<PrintShopBusinessCardPdfResult> {
  const printHtml = buildPrintShopBusinessCardHtml({ template, origin: options.origin, includeProductionMarks: options.includeProductionMarks, renderData: options.renderData });
  const browser = await launchPrintyChromium();

  try {
    const page = await browser.newPage();

    await page.setContent(printHtml.html, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(images.map((image) => (image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      }))));
      await document.fonts.ready;
    });

    const bytes = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      width: `${printHtml.mediaWidthMm}mm`,
      height: `${printHtml.mediaHeightMm}mm`,
    });

    return {
      bytes,
      fileName: safePdfFileName(template),
      notes: printHtml.notes,
    };
  } finally {
    await browser.close();
  }
}
