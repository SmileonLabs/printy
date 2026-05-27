import "server-only";

import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import type { AiBusinessCardInput, AiBusinessCardTextElement, AiBusinessCardTextField } from "@/lib/ai-business-card/schema";
import { normalizeBusinessCardText, normalizeMultilineBusinessCardText } from "@/lib/business-card-rendering";

type Glyph = {
  path: { toSVG: () => string };
};

type GlyphPosition = {
  xAdvance: number;
  xOffset: number;
  yOffset: number;
};

type Font = {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  layout: (text: string) => { glyphs: Glyph[]; positions: GlyphPosition[] };
};

type Fontkit = {
  create: (bytes: Uint8Array | Buffer) => Font;
};

const fontkitApi = fontkit as Fontkit;

const fontCandidates: Record<string, string[]> = {
  gothicRegular: [
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    "/usr/share/fonts/truetype/printy/GowunDodum-Regular.ttf",
    "C:/Windows/Fonts/malgun.ttf",
  ],
  gothicBold: [
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    "C:/Windows/Fonts/malgunbd.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    "C:/Windows/Fonts/malgun.ttf",
  ],
};

const fontCache = new Map<string, Promise<Font>>();

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function readFieldValue(field: AiBusinessCardTextField, input: AiBusinessCardInput) {
  const values: Record<AiBusinessCardTextField, string> = {
    brandName: input.brandName,
    category: input.category,
    name: input.member.name,
    role: input.member.role,
    phone: input.member.phone,
    mainPhone: input.member.mainPhone,
    fax: input.member.fax,
    email: input.member.email,
    website: input.member.website ?? "",
    address: input.member.address,
    account: input.member.account ?? "",
    instagram: input.member.instagram ?? "",
    qrCode: "",
  };

  if (field.startsWith("headline-") || field.startsWith("body-")) return "";
  return field.startsWith("body-") ? normalizeMultilineBusinessCardText(values[field]) : normalizeBusinessCardText(values[field]);
}

async function loadFirstAvailableFont(paths: string[]) {
  for (const path of paths) {
    try {
      return fontkitApi.create(await readFile(path));
    } catch {
      // Try the next configured Korean-capable font.
    }
  }

  throw new Error("A Korean-capable outline font is not available for AI business card PDF generation.");
}

function fontKey(element: AiBusinessCardTextElement) {
  return element.fontWeight === "bold" ? "gothicBold" : "gothicRegular";
}

async function loadOutlineFont(element: AiBusinessCardTextElement) {
  const key = fontKey(element);
  const cached = fontCache.get(key);

  if (cached) {
    return cached;
  }

  const promise = loadFirstAvailableFont(fontCandidates[key] ?? fontCandidates.gothicRegular);

  fontCache.set(key, promise);
  return promise;
}

function fixed(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
}

export async function renderTextElementAsOutline(element: AiBusinessCardTextElement, input: AiBusinessCardInput) {
  const value = readFieldValue(element.field, input);

  if (!value) {
    return "";
  }

  const font = await loadOutlineFont(element);
  const lines = value.split("\n");
  const fontSizeMm = element.fontSizePt * 25.4 / 72;
  const baseScaleMm = fontSizeMm / font.unitsPerEm;
  const scaleMm = baseScaleMm;
  const textHeightMm = (font.ascent - font.descent) * scaleMm;
  const lineHeightMm = textHeightMm * 1.25;
  const totalTextHeightMm = textHeightMm + lineHeightMm * (lines.length - 1);
  const firstBaselineMm = element.yMm + Math.max(0, (element.heightMm - totalTextHeightMm) / 2) + font.ascent * scaleMm;
  const paths = lines.map((line, lineIndex) => {
    const run = font.layout(line);
    const textWidthMm = run.positions.reduce((total, position) => total + position.xAdvance * scaleMm, 0);
    const xMm = element.align === "center" ? element.xMm + (element.widthMm - textWidthMm) / 2 : element.align === "right" ? element.xMm + element.widthMm - textWidthMm : element.xMm;
    const baselineMm = firstBaselineMm + lineHeightMm * lineIndex;
    let cursor = 0;

    return run.glyphs.map((glyph, index) => {
      const position = run.positions[index] ?? { xAdvance: 0, xOffset: 0, yOffset: 0 };
      const d = glyph.path.toSVG();
      const transform = `translate(${fixed(xMm + (cursor + position.xOffset) * scaleMm)} ${fixed(baselineMm - position.yOffset * scaleMm)}) scale(${fixed(scaleMm)} ${fixed(-scaleMm)})`;

      cursor += position.xAdvance;

      return d ? `<path d="${escapeHtml(d)}" transform="${transform}" />` : "";
    }).join("");
  }).join("");

  return `<svg class="text-outline" xmlns="http://www.w3.org/2000/svg" width="92mm" height="52mm" viewBox="0 0 92 52" preserveAspectRatio="none" style="z-index:${element.layer};"><g fill="${escapeHtml(element.color)}">${paths}</g></svg>`;
}
