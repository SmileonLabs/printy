import "server-only";

import { readGeneratedLogoBytesByPublicUrl, saveBrandAssetImageBytes } from "@/lib/server/storage";
import type { BrandAsset } from "@/lib/types";

type BrandMockupInput = {
  brandId: string;
  brandName: string;
  category: string;
  logoImageUrl: string;
  sceneId: string;
};

type MockupScene = {
  id: string;
  title: string;
  description: string;
  width: number;
  height: number;
  backgroundSvg: string;
  logoBox: { left: number; top: number; width: number; height: number };
  effect: "emboss" | "ink" | "vinyl" | "screen" | "stamp";
};

function escapeSvgText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sceneSvg(width: number, height: number, content: string) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

function createScenes(brandName: string, category: string): MockupScene[] {
  const safeCategory = escapeSvgText(category || "Brand identity");

  return [
    {
      id: "paper-emboss",
      title: "프리미엄 종이 목업",
      description: "질감 있는 종이 위에 로고를 고급스럽게 얹은 적용 이미지",
      width: 1200,
      height: 800,
      backgroundSvg: sceneSvg(1200, 800, `<defs><linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7f4ee"/><stop offset="1" stop-color="#ded8cd"/></linearGradient><radialGradient id="light" cx="35%" cy="24%" r="78%"><stop stop-color="#fff" stop-opacity="0.68"/><stop offset="1" stop-color="#9b8d7b" stop-opacity="0.12"/></radialGradient><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.1"/></feComponentTransfer></filter></defs><rect width="1200" height="800" fill="url(#paper)"/><rect width="1200" height="800" fill="url(#light)"/><rect width="1200" height="800" filter="url(#noise)" opacity="0.75"/><path d="M0 635c260-30 520-10 1200-70v235H0z" fill="#c8bca9" opacity="0.24"/>`),
      logoBox: { left: 370, top: 210, width: 460, height: 280 },
      effect: "emboss",
    },
    {
      id: "signboard",
      title: "매장 간판 목업",
      description: "외부 사인보드에 로고를 배치한 브랜드 적용 이미지",
      width: 1200,
      height: 800,
      backgroundSvg: sceneSvg(1200, 800, `<defs><linearGradient id="wall" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ece8df"/><stop offset="1" stop-color="#bdb7ad"/></linearGradient><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="18" dy="24" stdDeviation="18" flood-color="#000" flood-opacity="0.22"/></filter><filter id="grain"><feTurbulence baseFrequency="0.55" numOctaves="3"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.06"/></feComponentTransfer></filter></defs><rect width="1200" height="800" fill="url(#wall)"/><rect width="1200" height="800" filter="url(#grain)"/><path d="M0 0h1200v210H0z" fill="#f7f5ef" opacity="0.65"/><rect x="260" y="160" width="680" height="430" rx="8" fill="#faf8f2" stroke="#24211f" stroke-width="16" filter="url(#shadow)"/>`),
      logoBox: { left: 430, top: 265, width: 340, height: 210 },
      effect: "vinyl",
    },
    {
      id: "package-cup",
      title: "컵과 포장지 목업",
      description: "카페 컵과 포장지에 로고를 적용한 실사용 이미지",
      width: 1200,
      height: 800,
      backgroundSvg: sceneSvg(1200, 800, `<defs><linearGradient id="table" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#efe6d8"/><stop offset="1" stop-color="#a57955"/></linearGradient><linearGradient id="cup" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#5f493f"/><stop offset="0.45" stop-color="#8a6a5b"/><stop offset="1" stop-color="#4d3a33"/></linearGradient><filter id="soft"><feDropShadow dx="0" dy="22" stdDeviation="18" flood-color="#000" flood-opacity="0.2"/></filter><filter id="bagNoise"><feTurbulence baseFrequency="0.8" numOctaves="3"/><feColorMatrix type="saturate" values="0.25"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.12"/></feComponentTransfer></filter></defs><rect width="1200" height="800" fill="#f5efe7"/><rect y="520" width="1200" height="280" fill="url(#table)"/><path d="M635 460l360 90-55 150-430-95z" fill="#c89a6d" filter="url(#soft)"/><path d="M635 460l360 90-55 150-430-95z" filter="url(#bagNoise)"/><path d="M165 280h210l-36 300H201z" fill="url(#cup)" filter="url(#soft)"/><path d="M150 270h240v34H150z" fill="#5f4a40"/><text x="72" y="720" fill="#6a5144" font-family="Arial, sans-serif" font-size="24" font-weight="700">${safeCategory} packaging</text>`),
      logoBox: { left: 205, top: 375, width: 130, height: 95 },
      effect: "stamp",
    },
    {
      id: "mug",
      title: "머그컵 목업",
      description: "화이트 머그컵 중앙에 로고를 배치한 굿즈 적용 이미지",
      width: 1200,
      height: 800,
      backgroundSvg: sceneSvg(1200, 800, `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7f8f5"/><stop offset="1" stop-color="#dfe5de"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="22" flood-color="#000" flood-opacity="0.18"/></filter></defs><rect width="1200" height="800" fill="url(#bg)"/><circle cx="240" cy="190" r="120" fill="#5b7d49" opacity="0.18"/><ellipse cx="610" cy="640" rx="280" ry="50" fill="#9aa39a" opacity="0.25"/><rect x="410" y="220" width="360" height="420" rx="80" fill="#fff" filter="url(#shadow)"/><ellipse cx="590" cy="220" rx="178" ry="42" fill="#e9ece9"/><path d="M760 330c120-20 150 170 20 190" fill="none" stroke="#fff" stroke-width="52" stroke-linecap="round" filter="url(#shadow)"/>`),
      logoBox: { left: 515, top: 375, width: 150, height: 110 },
      effect: "ink",
    },
    {
      id: "digital",
      title: "디지털 화면 목업",
      description: "모바일과 태블릿 화면에 로고를 적용한 디지털 브랜딩 이미지",
      width: 1200,
      height: 800,
      backgroundSvg: sceneSvg(1200, 800, `<defs><filter id="shadow"><feDropShadow dx="0" dy="26" stdDeviation="22" flood-color="#000" flood-opacity="0.18"/></filter></defs><rect width="1200" height="800" fill="#f4f4f2"/><rect x="230" y="235" width="600" height="360" rx="34" fill="#1f2224" filter="url(#shadow)"/><rect x="260" y="265" width="540" height="300" rx="16" fill="#fff"/><rect x="675" y="120" width="210" height="420" rx="36" fill="#202326" filter="url(#shadow)"/><rect x="696" y="155" width="168" height="340" rx="18" fill="#fff"/><text x="84" y="705" fill="#222" font-family="Arial, sans-serif" font-size="26" font-weight="700">Digital brand preview</text>`),
      logoBox: { left: 420, top: 365, width: 220, height: 145 },
      effect: "screen",
    },
    {
      id: "business-card",
      title: "명함 목업",
      description: "브랜드 명함 앞면과 뒷면에 로고를 배치한 인쇄물 적용 이미지",
      width: 1200,
      height: 800,
      backgroundSvg: sceneSvg(1200, 800, `<defs><filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="18" flood-color="#000" flood-opacity="0.16"/></filter></defs><rect width="1200" height="800" fill="#f5f5f3"/><rect x="190" y="260" width="400" height="240" rx="10" fill="#fff" filter="url(#shadow)" transform="rotate(-8 390 380)"/><rect x="610" y="230" width="400" height="240" rx="10" fill="#fff" filter="url(#shadow)" transform="rotate(7 810 350)"/><text x="80" y="710" fill="#777" font-family="Arial, sans-serif" font-size="24" font-weight="700">Business card system</text>`),
      logoBox: { left: 710, top: 300, width: 200, height: 130 },
      effect: "ink",
    },
  ];
}

function solidColorSvg(width: number, height: number, color: string, opacity = 1) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="${color}" fill-opacity="${opacity}"/></svg>`);
}

async function createMaskedLayer(mask: Buffer, width: number, height: number, color: string, opacity = 1, blur = 0) {
  const sharp = (await import("sharp")).default;
  let image = sharp(solidColorSvg(width, height, color, opacity)).composite([{ input: mask, blend: "dest-in" }]);

  if (blur > 0) {
    image = image.blur(blur);
  }

  return image.png().toBuffer();
}

async function createLogoComposites(logoBytes: Uint8Array, scene: MockupScene) {
  const sharp = (await import("sharp")).default;
  const { width, height } = scene.logoBox;
  const mask = await sharp(logoBytes).resize({ width, height, fit: "contain" }).ensureAlpha().extractChannel("alpha").png().toBuffer();
  const layers: Array<{ input: Buffer; left: number; top: number; blend?: "over" | "multiply" | "screen" }> = [];

  if (scene.effect === "emboss") {
    layers.push({ input: await createMaskedLayer(mask, width, height, "#2f241c", 0.3, 1.2), left: scene.logoBox.left + 5, top: scene.logoBox.top + 7, blend: "multiply" });
    layers.push({ input: await createMaskedLayer(mask, width, height, "#ffffff", 0.62, 0.6), left: scene.logoBox.left - 4, top: scene.logoBox.top - 5, blend: "screen" });
    layers.push({ input: await createMaskedLayer(mask, width, height, "#806b5d", 0.22), left: scene.logoBox.left, top: scene.logoBox.top, blend: "multiply" });
    return layers;
  }

  if (scene.effect === "vinyl") {
    layers.push({ input: await createMaskedLayer(mask, width, height, "#000000", 0.22, 3), left: scene.logoBox.left + 10, top: scene.logoBox.top + 12, blend: "multiply" });
    layers.push({ input: await createMaskedLayer(mask, width, height, "#6e5143", 0.96), left: scene.logoBox.left, top: scene.logoBox.top, blend: "over" });
    layers.push({ input: await createMaskedLayer(mask, width, height, "#ffffff", 0.28, 0.8), left: scene.logoBox.left - 2, top: scene.logoBox.top - 3, blend: "screen" });
    return layers;
  }

  if (scene.effect === "screen") {
    layers.push({ input: await createMaskedLayer(mask, width, height, "#7a6255", 0.9), left: scene.logoBox.left, top: scene.logoBox.top, blend: "over" });
    return layers;
  }

  if (scene.effect === "stamp") {
    layers.push({ input: await createMaskedLayer(mask, width, height, "#2a1f1a", 0.28, 1.1), left: scene.logoBox.left + 2, top: scene.logoBox.top + 4, blend: "multiply" });
    layers.push({ input: await createMaskedLayer(mask, width, height, "#f7f1e7", 0.88), left: scene.logoBox.left, top: scene.logoBox.top, blend: "over" });
    return layers;
  }

  layers.push({ input: await createMaskedLayer(mask, width, height, "#6f574b", 0.82), left: scene.logoBox.left, top: scene.logoBox.top, blend: "multiply" });
  layers.push({ input: await createMaskedLayer(mask, width, height, "#000000", 0.12, 1.6), left: scene.logoBox.left + 2, top: scene.logoBox.top + 3, blend: "multiply" });
  return layers;
}

async function createMockupImage(logoBytes: Uint8Array, scene: MockupScene) {
  const sharp = (await import("sharp")).default;
  const composites = await createLogoComposites(logoBytes, scene);

  return sharp(Buffer.from(scene.backgroundSvg))
    .composite(composites)
    .png()
    .toBuffer();
}

export async function generateBrandMockup(input: BrandMockupInput): Promise<BrandAsset> {
  const logoBytes = await readGeneratedLogoBytesByPublicUrl(input.logoImageUrl);

  if (!logoBytes) {
    throw new Error("Generated logo image is unavailable.");
  }

  const scenes = createScenes(input.brandName, input.category);
  const scene = scenes.find((item) => item.id === input.sceneId);

  if (!scene) {
    throw new Error("Unknown brand mockup scene.");
  }

  const createdAt = new Date().toISOString();
  const mockupImage = await createMockupImage(logoBytes, scene);
  const stored = await saveBrandAssetImageBytes(mockupImage);

  return {
    id: `brand-asset-${scene.id}-${Date.now()}`,
    brandId: input.brandId,
    sectionId: "style",
    productId: `brand-mockup-${scene.id}`,
    title: scene.title,
    description: scene.description,
    imageUrl: stored.publicUrl,
    assetType: "mockup",
    createdAt,
  };
}
