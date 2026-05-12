import { NextResponse } from "next/server";
import { businessCardProductId, parseBusinessCardTemplateInput } from "@/lib/business-card-templates";
import { createDefaultPrintShopBusinessCardRenderData } from "@/lib/print-shop-business-card-html";
import { generatePrintShopBusinessCardPdf } from "@/lib/print-shop-business-card-pdf";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { ChromiumUnavailableError } from "@/lib/server/chromium-renderer";
import type { PrintTemplate } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

function contentDispositionFileName(fileName: string) {
  const asciiFileName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-") || "printy-business-card-draft-print-shop.pdf";

  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function chromiumUnavailableResponse(error: ChromiumUnavailableError) {
  return NextResponse.json({ reason: error.message, renderer: "chromium" }, { status: 503, headers: { "Cache-Control": "no-store", "X-Printy-PDF-Renderer": "chromium" } });
}

export async function POST(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => undefined);
  const input = parseBusinessCardTemplateInput(body);

  if (!input) {
    return NextResponse.json({ reason: "Invalid business-card template draft." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const template: PrintTemplate = {
    id: "draft-preview",
    productId: businessCardProductId,
    title: input.title,
    summary: input.summary,
    tags: input.tags,
    orientation: input.orientation,
    previewVariant: input.previewVariant,
    status: input.status,
    source: "admin",
    layout: input.layout,
    createdAt: now,
    updatedAt: now,
  };
  let pdf: Awaited<ReturnType<typeof generatePrintShopBusinessCardPdf>>;

  try {
    pdf = await generatePrintShopBusinessCardPdf(template, { origin: new URL(request.url).origin, renderData: createDefaultPrintShopBusinessCardRenderData() });
  } catch (error) {
    if (error instanceof ChromiumUnavailableError) {
      return chromiumUnavailableResponse(error);
    }

    throw error;
  }

  return new NextResponse(Buffer.from(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDispositionFileName(pdf.fileName),
      "Cache-Control": "no-store",
      "X-Printy-PDF-Renderer": "chromium",
      "X-Printy-Print-Shop-PDF-Notes": pdf.notes.join(" | ").slice(0, 900),
    },
  });
}
