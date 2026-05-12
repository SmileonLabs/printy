import { NextResponse } from "next/server";
import { createDefaultPrintShopBusinessCardRenderData } from "@/lib/print-shop-business-card-html";
import { generatePrintShopBusinessCardPdf } from "@/lib/print-shop-business-card-pdf";
import { generatePrepressBusinessCardPdf } from "@/lib/prepress/print-shop-business-card-prepress";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { getAdminBusinessCardTemplate } from "@/lib/server/business-card-template-store";
import { ChromiumUnavailableError } from "@/lib/server/chromium-renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PrintShopPdfRouteContext = {
  params: Promise<{ templateId: string }>;
};

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

function contentDispositionFileName(fileName: string) {
  const asciiFileName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-") || "printy-business-card-print-shop.pdf";

  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function chromiumUnavailableResponse(error: ChromiumUnavailableError) {
  return NextResponse.json({ reason: error.message, renderer: "chromium" }, { status: 503, headers: { "Cache-Control": "no-store", "X-Printy-PDF-Renderer": "chromium" } });
}

export async function GET(request: Request, context: PrintShopPdfRouteContext) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const { templateId } = await context.params;
  const template = await getAdminBusinessCardTemplate(templateId);

  if (!template) {
    return NextResponse.json({ reason: "Admin template not found." }, { status: 404 });
  }

  const searchParams = new URL(request.url).searchParams;
  const origin = new URL(request.url).origin;
  const variant = searchParams.get("variant");
  const checkOnly = searchParams.get("check") === "1";

  if (variant === "prepress") {
    let prepress: Awaited<ReturnType<typeof generatePrepressBusinessCardPdf>>;

    try {
      prepress = await generatePrepressBusinessCardPdf(template, { origin, renderData: createDefaultPrintShopBusinessCardRenderData() });
    } catch (error) {
      if (error instanceof ChromiumUnavailableError) {
        return chromiumUnavailableResponse(error);
      }

      throw error;
    }

    if (checkOnly || !prepress.bytes) {
      return NextResponse.json(
        {
          status: prepress.status,
          notes: prepress.notes,
          checks: prepress.checks,
          downloadable: Boolean(prepress.bytes) && prepress.status !== "validation-failed",
        },
        { status: prepress.bytes || checkOnly ? 200 : 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return new NextResponse(Buffer.from(prepress.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDispositionFileName(prepress.fileName),
        "Cache-Control": "no-store",
        "X-Printy-Prepress-Status": prepress.status,
        "X-Printy-PDF-Renderer": "chromium",
        "X-Printy-Print-Shop-PDF-Notes": prepress.notes.join(" | ").slice(0, 900),
      },
    });
  }

  let pdf: Awaited<ReturnType<typeof generatePrintShopBusinessCardPdf>>;

  try {
    pdf = await generatePrintShopBusinessCardPdf(template, { origin, renderData: createDefaultPrintShopBusinessCardRenderData() });
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
