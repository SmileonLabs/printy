import { NextResponse } from "next/server";
import { generatePrintProductPdf } from "@/lib/print-products/server";
import type { PrintProductProductionLayout, PrintProductProductionType } from "@/lib/types";

export const runtime = "nodejs";

function isProductType(value: unknown): value is PrintProductProductionType {
  return value === "banner" || value === "signage" || value === "flyer";
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ reason: "PDF 요청이 올바르지 않아요." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const productType = record.productType;
  const brandName = typeof record.brandName === "string" ? record.brandName.trim() : "";
  const backgroundImageUrl = typeof record.backgroundImageUrl === "string" ? record.backgroundImageUrl : undefined;
  const logoImageUrl = typeof record.logoImageUrl === "string" ? record.logoImageUrl : undefined;
  const logoVectorSvgUrl = typeof record.logoVectorSvgUrl === "string" ? record.logoVectorSvgUrl : undefined;

  if (!isProductType(productType) || !brandName || typeof record.layout !== "object" || record.layout === null) {
    return NextResponse.json({ reason: "브랜드, 상품, 레이아웃 정보가 필요해요." }, { status: 400 });
  }

  try {
    const origin = new URL(request.url).origin;
    const result = await generatePrintProductPdf({ brandName, productType, layout: record.layout as PrintProductProductionLayout, backgroundImageUrl, logoImageUrl, logoVectorSvgUrl, origin });

    return new NextResponse(Buffer.from(result.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
      },
    });
  } catch (error) {
    console.error("Print product PDF generation failed", { errorName: error instanceof Error ? error.name : "UnknownError" });

    return NextResponse.json({ reason: "PDF를 만들지 못했어요." }, { status: 500 });
  }
}
