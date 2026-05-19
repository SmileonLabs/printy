import type { AiBusinessCardInput } from "@/lib/ai-business-card/schema";
import type { BusinessCardColorPaletteId, BusinessCardProductionOptions, BusinessCardUserElementId, LogoShape, Member, ResolvedLogoOption } from "@/lib/types";

const logoShapes = new Set<LogoShape>(["circle", "square", "pill", "diamond", "arch", "spark"]);
const businessCardElementIds = new Set<BusinessCardUserElementId>(["logo", "brandName", "category", "name", "role", "phone", "mainPhone", "fax", "email", "website", "address", "account", "titleLine1", "titleLine2", "adLine1", "adLine2", "instagram", "instagramIcon", "qrCode"]);
const businessCardColorIds = new Set<BusinessCardColorPaletteId>(["black", "white", "green", "yellow", "blue", "red"]);

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

  return {
    id: readString(value, "id") || "ai-card-member",
    name: readString(value, "name"),
    role: readString(value, "role"),
    phone: readString(value, "phone"),
    mainPhone: readString(value, "mainPhone"),
    fax: readString(value, "fax"),
    email: readString(value, "email"),
    website: readString(value, "website"),
    address: readString(value, "address"),
    account: readString(value, "account"),
    titleLine1: readString(value, "titleLine1"),
    titleLine2: readString(value, "titleLine2"),
    adLine1: readString(value, "adLine1"),
    adLine2: readString(value, "adLine2"),
    instagram: readString(value, "instagram"),
    qrCodeImageUrl: readString(value, "qrCodeImageUrl"),
  };
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

function readElementIds(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is BusinessCardUserElementId => typeof item === "string" && businessCardElementIds.has(item as BusinessCardUserElementId)) : [];
}

function readProductionOptions(value: unknown): BusinessCardProductionOptions | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const frontElements = readElementIds(value.frontElements);
  const backElements = readElementIds(value.backElements);
  const color = readString(value, "color") as BusinessCardColorPaletteId;

  if (frontElements.length === 0 && backElements.length === 0 && !businessCardColorIds.has(color)) {
    return undefined;
  }

  return {
    frontElements,
    backElements,
    color: businessCardColorIds.has(color) ? color : "black",
  };
}

export function readAiBusinessCardInput(value: unknown): AiBusinessCardInput | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const brandName = readString(value, "brandName");
  const category = readString(value, "category");
  const member = readMember(value.member);

  if (!brandName || !category || !member) {
    return undefined;
  }

  return { brandName, category, member, mood: readString(value, "mood"), colors: readString(value, "colors"), referenceStyle: readString(value, "referenceStyle"), frontNote: readString(value, "frontNote"), backNote: readString(value, "backNote"), logo: readLogo(value.logo), templateId: readString(value, "templateId") || undefined, productionOptions: readProductionOptions(value.productionOptions) };
}

export function contentDispositionFileName(fileName: string) {
  const asciiFileName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-") || "printy-ai-business-card.pdf";

  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
