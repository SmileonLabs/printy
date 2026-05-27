import type { Brand, Member, PrintProductProductionField, PrintProductProductionLayout, PrintProductProductionType } from "@/lib/types";

export type PrintProductSize = {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
};

export type PrintProductAdapter = {
  productType: PrintProductProductionType;
  productId: string;
  sectionId: "banners" | "signage" | "promotions";
  title: string;
  shortTitle: string;
  description: string;
  sizes: PrintProductSize[];
  mockupPrompt: string;
  cleanPrompt: string;
  editPrompt: string;
};

export const printProductAdapters: Record<PrintProductProductionType, PrintProductAdapter> = {
  flyer: {
    productType: "flyer",
    productId: "flyer",
    sectionId: "promotions",
    title: "홍보물",
    shortTitle: "홍보물",
    description: "전단지, 쿠폰, 행사 안내용 홍보물을 제작해요.",
    sizes: [
      { id: "flyer-a5", label: "전단지 A5 148 x 210mm", widthMm: 148, heightMm: 210 },
      { id: "flyer-a4", label: "전단지 A4 210 x 297mm", widthMm: 210, heightMm: 297 },
      { id: "coupon-90x50", label: "쿠폰 90 x 50mm", widthMm: 90, heightMm: 50 },
    ],
    mockupPrompt: "Create a flat, front-facing printable promotional flyer background. Use a polished retail/event promotion mood, but do not include readable text, logos, QR codes, coupons, prices, people, hands, paper perspective, or mockup scenes. Leave clean open areas where Printy will overlay the user's actual headline, details, contact, and logo later.",
    cleanPrompt: "Keep only the clean printable promotional background artwork without any text, logo, QR code, crop mark, or guide line.",
    editPrompt: "Edit only the printable promotional background color, texture, gradient, decorative shapes, or mood. Do not add text, logos, QR codes, people, products, prices, crop marks, or perspective mockups.",
  },
  banner: {
    productType: "banner",
    productId: "banner",
    sectionId: "banners",
    title: "배너 / 현수막",
    shortTitle: "배너",
    description: "매장 앞, 행사장, 외부 게시용 배너와 현수막을 제작해요.",
    sizes: [
      { id: "banner-230x80", label: "가로 현수막 230 x 80mm", widthMm: 230, heightMm: 80 },
      { id: "banner-55x170-vertical", label: "세로 현수막 55 x 170mm", widthMm: 55, heightMm: 170 },
      { id: "banner-55x170", label: "미니 배너 55 x 170mm", widthMm: 55, heightMm: 170 },
      { id: "banner-600x1800", label: "배너 600 x 1800mm", widthMm: 600, heightMm: 1800 },
      { id: "banner-900x1800", label: "현수막 900 x 1800mm", widthMm: 900, heightMm: 1800 },
      { id: "banner-3000x900", label: "가로 현수막 3000 x 900mm", widthMm: 3000, heightMm: 900 },
    ],
    mockupPrompt: "Create a single seamless vertical abstract background artwork. Use the selected background color as the main mood and make the whole image feel premium, modern, and uninterrupted from top to bottom.",
    cleanPrompt: "Keep only the complete printable banner background artwork.",
    editPrompt: "Edit the complete printable banner background so it matches the selected background color and the user's message content.",
  },
  signage: {
    productType: "signage",
    productId: "signage",
    sectionId: "signage",
    title: "간판",
    shortTitle: "간판",
    description: "매장 외부 사인과 정면 제작 시안을 분리해서 준비해요.",
    sizes: [
      { id: "signage-200x80", label: "간판 200 x 80mm", widthMm: 200, heightMm: 80 },
      { id: "signage-2400x600", label: "가로 간판 2400 x 600mm", widthMm: 2400, heightMm: 600 },
      { id: "signage-3000x800", label: "대형 간판 3000 x 800mm", widthMm: 3000, heightMm: 800 },
      { id: "signage-600x900", label: "입간판 600 x 900mm", widthMm: 600, heightMm: 900 },
    ],
    mockupPrompt: "Create a flat, front-facing Korean signboard production design preview. This is not an installation mockup. Use a clean printable sign background only, no readable text, no logo, no QR code, no icons, no building facade, no perspective, no 3D. Leave open space where Printy will overlay the user's actual sign text and logo later.",
    cleanPrompt: "Remove every text, icon, QR code, logo, guide line, and crop mark. Keep only the clean front-facing signboard background artwork.",
    editPrompt: "Edit only the flat signboard background material, color, lighting-like gradient, texture, or decorative shapes. Do not add text, icons, QR codes, logos, buildings, perspective, crop marks, or guide lines.",
  },
};

const defaultFieldBoxes: Record<string, PrintProductProductionField["box"]> = {
  headline: { x: 12, y: 20, width: 76, height: 16 },
  body: { x: 18, y: 43, width: 64, height: 18 },
  phone: { x: 18, y: 72, width: 30, height: 8 },
  website: { x: 50, y: 72, width: 32, height: 8 },
  address: { x: 18, y: 82, width: 64, height: 8 },
  qrCode: { x: 82, y: 72, width: 10, height: 10 },
};

const fieldLabels: Record<string, string> = {
  headline: "문구 1",
  body: "상세 안내 1",
  phone: "전화번호",
  website: "웹사이트",
  address: "주소",
  qrCode: "QR 코드",
};

function defaultFieldFontSize(id: PrintProductProductionField["id"], widthMm: number) {
  if (id === "headline") return Math.min(Math.max(13, widthMm * 0.07), 120);
  if (id === "body") return Math.min(Math.max(5.5, widthMm * 0.025), 60);
  if (id === "qrCode") return 4.5;
  return Math.min(Math.max(4.5, widthMm * 0.018), 42);
}

function makeField(id: PrintProductProductionField["id"], value: string, widthMm: number, visible = true): PrintProductProductionField {
  const isHeadline = id === "headline";

  return {
    id,
    label: fieldLabels[id] ?? id,
    value,
    visible,
    box: defaultFieldBoxes[id] ?? defaultFieldBoxes.body,
    fontFamily: "sans",
    fontSize: defaultFieldFontSize(id, widthMm),
    color: "#111827",
    fontWeight: isHeadline ? "bold" : "regular",
    italic: false,
    align: "center",
  };
}

function defaultText(brand: Brand, members: Member[]) {
  const member = members[0] ?? brand.members[0];

  return {
    headline: brand.name,
    subheadline: brand.category,
    body: brand.designRequest,
    phone: member?.mainPhone || member?.phone || "",
    website: member?.website ?? "",
    address: member?.address ?? "",
    qrCode: member?.qrCodeImageUrl ?? "",
  };
}

export function createDefaultPrintProductLayout(productType: PrintProductProductionType, brand: Brand, members: Member[] = []): PrintProductProductionLayout {
  const adapter = printProductAdapters[productType];
  const size = adapter.sizes[0];
  const text = defaultText(brand, members);

  return {
    productType,
    sizeId: size.id,
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    backgroundColor: "#ffffff",
    fields: [
      makeField("headline", text.headline, size.widthMm),
      makeField("body", text.body, size.widthMm, Boolean(text.body)),
      makeField("phone", text.phone, size.widthMm, Boolean(text.phone)),
      makeField("website", text.website, size.widthMm, Boolean(text.website)),
      makeField("address", text.address, size.widthMm, Boolean(text.address)),
      makeField("qrCode", text.qrCode, size.widthMm, Boolean(text.qrCode)),
    ],
    logo: { visible: true, box: { x: 41, y: 7, width: 18, height: 10 }, assetType: "svg" },
    promptShapes: [],
  };
}

export function applyPrintProductSize(layout: PrintProductProductionLayout, sizeId: string): PrintProductProductionLayout {
  const size = printProductAdapters[layout.productType].sizes.find((item) => item.id === sizeId) ?? printProductAdapters[layout.productType].sizes[0];

  return { ...layout, sizeId: size.id, widthMm: size.widthMm, heightMm: size.heightMm };
}

export function normalizePrintProductLayout(layout: PrintProductProductionLayout): PrintProductProductionLayout {
  const adapter = printProductAdapters[layout.productType];
  const size = adapter.sizes.find((item) => item.id === layout.sizeId) ?? adapter.sizes[0];
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
  const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;

  return {
    ...layout,
    sizeId: size.id,
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    backgroundColor: /^#[0-9a-fA-F]{6}$/.test(layout.backgroundColor) ? layout.backgroundColor : "#ffffff",
    fields: layout.fields.filter((field) => field.id !== "subheadline").map((field) => ({
      ...field,
      id: text(field.id, "body"),
      label: field.id === "headline" ? "문구 1" : field.id === "body" ? "상세 안내 1" : text(field.label, field.id),
      value: text(field.value),
      visible: field.visible !== false,
      box: {
        x: clamp(field.box.x, 0, 100),
        y: clamp(field.box.y, 0, 100),
        width: clamp(field.box.width, 2, 100),
        height: clamp(field.box.height, 2, 100),
      },
      fontFamily: field.fontFamily ?? "sans",
      fontSize: clamp(field.fontSize, 0.5, 200),
      color: /^#[0-9a-fA-F]{6}$/.test(field.color) || field.color.startsWith("gradient:") ? field.color : "#111827",
      fontWeight: field.fontWeight === "bold" ? "bold" : "regular",
      italic: Boolean(field.italic),
      align: field.align === "left" || field.align === "right" || field.align === "center" ? field.align : "center",
    })),
    logo: {
      ...layout.logo,
      box: {
        x: clamp(layout.logo.box.x, 0, 100),
        y: clamp(layout.logo.box.y, 0, 100),
        width: clamp(layout.logo.box.width, 2, 100),
        height: clamp(layout.logo.box.height, 2, 100),
      },
    },
    promptShapes: (layout.promptShapes ?? []).map((shape) => ({
      ...shape,
      id: text(shape.id, `prompt-shape-${Date.now()}`),
      label: text(shape.label, "기본 아이콘"),
      prompt: text(shape.prompt),
      visible: shape.visible !== false,
      fillColor: /^#[0-9a-fA-F]{6}$/.test(text(shape.fillColor)) ? shape.fillColor : "#ffffff",
      strokeColor: /^#[0-9a-fA-F]{6}$/.test(text(shape.strokeColor)) ? shape.strokeColor : "#111827",
      textColor: /^#[0-9a-fA-F]{6}$/.test(text(shape.textColor)) ? shape.textColor : "#111827",
      glyph: text(shape.glyph, "AI").trim().slice(0, 3) || "AI",
      box: {
        x: clamp(shape.box.x, 0, 100),
        y: clamp(shape.box.y, 0, 100),
        width: clamp(shape.box.width, 2, 100),
        height: clamp(shape.box.height, 2, 100),
      },
    })),
  };
}
