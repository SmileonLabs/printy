import { NextResponse } from "next/server";
import { isPublishedBusinessCardTemplate } from "@/lib/business-card-templates";
import { generatePrintShopBusinessCardPdf } from "@/lib/print-shop-business-card-pdf";
import { getAdminBusinessCardTemplate } from "@/lib/server/business-card-template-store";
import { ChromiumUnavailableError } from "@/lib/server/chromium-renderer";
import type { LogoShape, Member, ResolvedLogoOption } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicBusinessCardPdfRouteContext = {
  params: Promise<{ templateId: string }>;
};

const logoShapes = new Set<LogoShape>(["circle", "square", "pill", "diamond", "arch", "spark"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" ? field.trim() : "";
}

function readMember(value: unknown): Member | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const member: Member = {
    id: readString(value, "id") || "preview-member",
    name: readString(value, "name"),
    role: readString(value, "role"),
    phone: readString(value, "phone"),
    mainPhone: readString(value, "mainPhone"),
    fax: readString(value, "fax"),
    email: readString(value, "email"),
    website: readString(value, "website"),
    address: readString(value, "address"),
  };

  return member.name || member.role || member.phone || member.mainPhone || member.fax || member.email || member.website || member.address ? member : undefined;
}

function readLogo(value: unknown): ResolvedLogoOption | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readString(value, "id");
  const name = readString(value, "name");
  const label = readString(value, "label");
  const description = readString(value, "description");
  const imageUrl = readString(value, "imageUrl");

  if (id && name && label && description && imageUrl && (imageUrl.startsWith("data:image/png;base64,") || imageUrl.startsWith("/"))) {
    return { id, name, label, description, imageUrl, source: "openai" };
  }

  const initial = readString(value, "initial");
  const shape = readString(value, "shape");
  const accent = readString(value, "accent");
  const background = readString(value, "background");

  if (id && name && label && initial && logoShapes.has(shape as LogoShape) && accent && background && description) {
    return { id, name, label, initial, shape: shape as LogoShape, accent, background, description };
  }

  return undefined;
}

function safePdfFileName(templateTitle: string) {
  const normalizedTitle = templateTitle.trim().replace(/[^a-zA-Z0-9가-힣._-]+/g, "-").slice(0, 80) || "business-card";

  return `printy-${normalizedTitle}.pdf`;
}

function contentDispositionFileName(fileName: string) {
  const asciiFileName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-") || "printy-business-card.pdf";

  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function chromiumUnavailableResponse(error: ChromiumUnavailableError) {
  return NextResponse.json({ reason: error.message, renderer: "chromium" }, { status: 503, headers: { "Cache-Control": "no-store", "X-Printy-PDF-Renderer": "chromium" } });
}

export async function POST(request: Request, context: PublicBusinessCardPdfRouteContext) {
  const { templateId } = await context.params;
  const template = await getAdminBusinessCardTemplate(templateId);

  if (!template || !isPublishedBusinessCardTemplate(template) || !template.layout) {
    return NextResponse.json({ reason: "다운로드할 수 있는 공개 명함 템플릿을 찾지 못했어요." }, { status: 404 });
  }

  const body = await request.json().catch(() => undefined);

  if (!isRecord(body)) {
    return NextResponse.json({ reason: "명함 PDF에 넣을 정보를 확인해 주세요." }, { status: 400 });
  }

  const brandName = readString(body, "brandName");
  const category = readString(body, "category");
  const member = readMember(body.member);
  const logo = readLogo(body.logo);

  if (!brandName || !category || !member || !logo) {
    return NextResponse.json({ reason: "명함 PDF에 넣을 정보를 확인해 주세요." }, { status: 400 });
  }

  let pdf: Awaited<ReturnType<typeof generatePrintShopBusinessCardPdf>>;

  try {
    pdf = await generatePrintShopBusinessCardPdf(template, { origin: new URL(request.url).origin, renderData: { brandName, category, member, logo } });
  } catch (error) {
    if (error instanceof ChromiumUnavailableError) {
      return chromiumUnavailableResponse(error);
    }

    throw error;
  }

  const fileName = safePdfFileName(template.title);

  return new NextResponse(Buffer.from(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDispositionFileName(fileName),
      "Cache-Control": "no-store",
      "X-Printy-PDF-Renderer": "chromium",
      "X-Printy-Print-Shop-PDF-Notes": pdf.notes.join(" | ").slice(0, 900),
    },
  });
}
