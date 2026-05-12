import "server-only";

import sharp from "sharp";

function escapeSvgAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function vectorizeGeneratedLogo(bytes: Uint8Array) {
  const normalizedPng = await sharp(bytes).resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const metadata = await sharp(normalizedPng).metadata();
  const width = metadata.width ?? 1024;
  const height = metadata.height ?? 1024;
  const imageHref = `data:image/png;base64,${normalizedPng.toString("base64")}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img"><image width="${width}" height="${height}" href="${escapeSvgAttribute(imageHref)}" preserveAspectRatio="xMidYMid meet"/></svg>`;
}
