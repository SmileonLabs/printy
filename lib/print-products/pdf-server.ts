import "server-only";

import { buildPrintProductPdfHtml } from "@/lib/print-products/pdf-html";
import { normalizePrintProductLayout } from "@/lib/print-products/adapters";
import { launchPrintyChromium } from "@/lib/server/chromium-renderer";
import type { PrintProductProductionLayout, PrintProductProductionType } from "@/lib/types";

function safeFileName(value: string, fallback: string) {
  return value.trim().replace(/[^a-zA-Z0-9가-힣._-]+/g, "-").slice(0, 80) || fallback;
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
