import "server-only";

import { readGeneratedLogoBytesByPublicUrl, saveBrandAssetImageBytes } from "@/lib/server/storage";
import type { BrandAsset } from "@/lib/types";

type BrandMockupInput = {
  brandId: string;
  brandName: string;
  category: string;
  logoImageUrl: string;
};

type MockupScene = {
  id: string;
  title: string;
  description: string;
  width: number;
  height: number;
  backgroundSvg: string;
  logoBox: { left: number; top: number; width: number; height: number };
};

function escapeSvgText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sceneSvg(width: number, height: number, content: string) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

function createScenes(brandName: string, category: string): MockupScene[] {
  const safeBrandName = escapeSvgText(brandName);
  const safeCategory = escapeSvgText(category || "Brand identity");

  return [
    {
      id: "paper-emboss",
      title: "프리미엄 종이 목업",
      description: "질감 있는 종이 위에 로고를 고급스럽게 얹은 적용 이미지",
      width: 1200,
      height: 800,
      backgroundSvg: sceneSvg(1200, 800, `<defs><linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7f4ee"/><stop offset="1" stop-color="#ded8cd"/></linearGradient><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.09"/></feComponentTransfer></filter></defs><rect width="1200" height="800" fill="url(#paper)"/><rect width="1200" height="800" filter="url(#noise)" opacity="0.55"/><text x="80" y="720" fill="#8d7a6d" font-family="Arial, sans-serif" font-size="28" font-weight="700">${safeBrandName}</text>`),
      logoBox: { left: 370, top: 210, width: 460, height: 280 },
    },
    {
      id: "signboard",
      title: "매장 간판 목업",
      description: "외부 사인보드에 로고를 배치한 브랜드 적용 이미지",
      width: 1200,
      height: 800,
      backgroundSvg: sceneSvg(1200, 800, `<defs><linearGradient id="wall" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ece8df"/><stop offset="1" stop-color="#bdb7ad"/></linearGradient><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="18" dy="24" stdDeviation="18" flood-color="#000" flood-opacity="0.22"/></filter></defs><rect width="1200" height="800" fill="url(#wall)"/><path d="M0 0h1200v210H0z" fill="#f7f5ef" opacity="0.65"/><rect x="260" y="160" width="680" height="430" rx="8" fill="#faf8f2" stroke="#24211f" stroke-width="16" filter="url(#shadow)"/><text x="80" y="730" fill="#5b524a" font-family="Arial, sans-serif" font-size="24" font-weight="700">Store sign mockup</text>`),
      logoBox: { left: 430, top: 265, width: 340, height: 210 },
    },
    {
      id: "package-cup",
      title: "컵과 포장지 목업",
      description: "카페 컵과 포장지에 로고를 적용한 실사용 이미지",
      width: 1200,
      height: 800,
      backgroundSvg: sceneSvg(1200, 800, `<defs><linearGradient id="table" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#efe6d8"/><stop offset="1" stop-color="#a57955"/></linearGradient><filter id="soft"><feDropShadow dx="0" dy="22" stdDeviation="18" flood-color="#000" flood-opacity="0.2"/></filter></defs><rect width="1200" height="800" fill="#f5efe7"/><rect y="520" width="1200" height="280" fill="url(#table)"/><path d="M635 460l360 90-55 150-430-95z" fill="#c89a6d" filter="url(#soft)"/><path d="M165 280h210l-36 300H201z" fill="#795f51" filter="url(#soft)"/><path d="M150 270h240v34H150z" fill="#5f4a40"/><text x="72" y="720" fill="#6a5144" font-family="Arial, sans-serif" font-size="24" font-weight="700">${safeCategory} packaging</text>`),
      logoBox: { left: 205, top: 375, width: 130, height: 95 },
    },
    {
      id: "mug",
      title: "머그컵 목업",
      description: "화이트 머그컵 중앙에 로고를 배치한 굿즈 적용 이미지",
      width: 1200,
      height: 800,
      backgroundSvg: sceneSvg(1200, 800, `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7f8f5"/><stop offset="1" stop-color="#dfe5de"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="22" flood-color="#000" flood-opacity="0.18"/></filter></defs><rect width="1200" height="800" fill="url(#bg)"/><circle cx="240" cy="190" r="120" fill="#5b7d49" opacity="0.18"/><ellipse cx="610" cy="640" rx="280" ry="50" fill="#9aa39a" opacity="0.25"/><rect x="410" y="220" width="360" height="420" rx="80" fill="#fff" filter="url(#shadow)"/><ellipse cx="590" cy="220" rx="178" ry="42" fill="#e9ece9"/><path d="M760 330c120-20 150 170 20 190" fill="none" stroke="#fff" stroke-width="52" stroke-linecap="round" filter="url(#shadow)"/>`),
      logoBox: { left: 515, top: 375, width: 150, height: 110 },
    },
    {
      id: "digital",
      title: "디지털 화면 목업",
      description: "모바일과 태블릿 화면에 로고를 적용한 디지털 브랜딩 이미지",
      width: 1200,
      height: 800,
      backgroundSvg: sceneSvg(1200, 800, `<defs><filter id="shadow"><feDropShadow dx="0" dy="26" stdDeviation="22" flood-color="#000" flood-opacity="0.18"/></filter></defs><rect width="1200" height="800" fill="#f4f4f2"/><rect x="230" y="235" width="600" height="360" rx="34" fill="#1f2224" filter="url(#shadow)"/><rect x="260" y="265" width="540" height="300" rx="16" fill="#fff"/><rect x="675" y="120" width="210" height="420" rx="36" fill="#202326" filter="url(#shadow)"/><rect x="696" y="155" width="168" height="340" rx="18" fill="#fff"/><text x="84" y="705" fill="#222" font-family="Arial, sans-serif" font-size="26" font-weight="700">Digital brand preview</text>`),
      logoBox: { left: 420, top: 365, width: 220, height: 145 },
    },
    {
      id: "business-card",
      title: "명함 목업",
      description: "브랜드 명함 앞면과 뒷면에 로고를 배치한 인쇄물 적용 이미지",
      width: 1200,
      height: 800,
      backgroundSvg: sceneSvg(1200, 800, `<defs><filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="18" flood-color="#000" flood-opacity="0.16"/></filter></defs><rect width="1200" height="800" fill="#f5f5f3"/><rect x="190" y="260" width="400" height="240" rx="10" fill="#fff" filter="url(#shadow)" transform="rotate(-8 390 380)"/><rect x="610" y="230" width="400" height="240" rx="10" fill="#fff" filter="url(#shadow)" transform="rotate(7 810 350)"/><text x="80" y="710" fill="#777" font-family="Arial, sans-serif" font-size="24" font-weight="700">Business card system</text>`),
      logoBox: { left: 710, top: 300, width: 200, height: 130 },
    },
  ];
}

async function createMockupImage(logoBytes: Uint8Array, scene: MockupScene) {
  const sharp = (await import("sharp")).default;
  const logo = await sharp(logoBytes).resize({ width: scene.logoBox.width, height: scene.logoBox.height, fit: "contain" }).png().toBuffer();

  return sharp(Buffer.from(scene.backgroundSvg))
    .composite([{ input: logo, left: scene.logoBox.left, top: scene.logoBox.top, blend: "over" }])
    .png()
    .toBuffer();
}

async function createBrandBoardImage(mockupBytes: Buffer[]) {
  const sharp = (await import("sharp")).default;
  const width = 1200;
  const tileHeight = 520;
  const gap = 24;
  const topPadding = 72;
  const bottomPadding = 72;
  const height = topPadding + mockupBytes.length * tileHeight + (mockupBytes.length - 1) * gap + bottomPadding;
  const background = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="#f8f7f4"/><text x="80" y="44" fill="#2d2926" font-family="Arial, sans-serif" font-size="28" font-weight="800">Brand mockup board</text></svg>`;
  const composites = await Promise.all(mockupBytes.map(async (bytes, index) => ({ input: await sharp(bytes).resize({ width, height: tileHeight, fit: "cover" }).png().toBuffer(), left: 0, top: topPadding + index * (tileHeight + gap) })));

  return sharp(Buffer.from(background)).composite(composites).png().toBuffer();
}

export async function generateBrandMockups(input: BrandMockupInput): Promise<BrandAsset[]> {
  const logoBytes = await readGeneratedLogoBytesByPublicUrl(input.logoImageUrl);

  if (!logoBytes) {
    throw new Error("Generated logo image is unavailable.");
  }

  const scenes = createScenes(input.brandName, input.category);
  const createdAt = new Date().toISOString();
  const mockupImages = await Promise.all(scenes.map((scene) => createMockupImage(logoBytes, scene)));
  const mockupAssets = await Promise.all(mockupImages.map(async (bytes, index): Promise<BrandAsset> => {
    const scene = scenes[index];
    const stored = await saveBrandAssetImageBytes(bytes);

    return {
      id: `brand-asset-${scene.id}-${Date.now()}-${index}`,
      brandId: input.brandId,
      sectionId: "style",
      productId: "brand-mockup",
      title: scene.title,
      description: scene.description,
      imageUrl: stored.publicUrl,
      assetType: "mockup",
      createdAt,
    };
  }));
  const boardBytes = await createBrandBoardImage(mockupImages);
  const storedBoard = await saveBrandAssetImageBytes(boardBytes);

  return [
    {
      id: `brand-asset-board-${Date.now()}`,
      brandId: input.brandId,
      sectionId: "style",
      productId: "brand-mockup-board",
      title: "브랜드 목업 보드",
      description: "생성된 목업 이미지를 한 번에 확인하는 세로형 브랜드 보드",
      imageUrl: storedBoard.publicUrl,
      assetType: "brand-board",
      createdAt,
    },
    ...mockupAssets,
  ];
}
