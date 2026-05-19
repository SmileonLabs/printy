import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import sharp from "sharp";

const generatedLogoBucket = "generated-logos";
const generatedLogoPurpose = "generated-logo";

function readProductionDatabaseUrl() {
  return fs.readFile(".env.production.local", "utf8").then((envText) => {
    const value = envText
      .split(/\r?\n/)
      .map((line) => /^PRINTY_PRODUCTION_DATABASE_URL=(.*)$/.exec(line)?.[1]?.trim())
      .find(Boolean);

    if (!value) {
      throw new Error("PRINTY_PRODUCTION_DATABASE_URL is missing.");
    }

    return value;
  });
}

function colorDistance(a, b) {
  return Math.sqrt((a.red - b.red) ** 2 + (a.green - b.green) ** 2 + (a.blue - b.blue) ** 2);
}

function clampByte(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function readPixel(data, pixelIndex) {
  const offset = pixelIndex * 4;
  return {
    red: data[offset] ?? 0,
    green: data[offset + 1] ?? 0,
    blue: data[offset + 2] ?? 0,
    alpha: data[offset + 3] ?? 0,
  };
}

function pixelLuminance({ red, green, blue }) {
  return red * 0.299 + green * 0.587 + blue * 0.114;
}

function isSafeGeneratedLogoBackgroundForTransparency(backgroundColor) {
  const maxChannel = Math.max(backgroundColor.red, backgroundColor.green, backgroundColor.blue);
  const minChannel = Math.min(backgroundColor.red, backgroundColor.green, backgroundColor.blue);

  return pixelLuminance(backgroundColor) >= 150 && maxChannel - minChannel <= 72;
}

function isNearWhiteOpaquePixel(data, pixelIndex) {
  const { red, green, blue, alpha } = readPixel(data, pixelIndex);

  return alpha > 180 && colorDistance({ red, green, blue }, { red: 255, green: 255, blue: 255 }) < 52;
}

function isDarkLogoPixel(data, pixelIndex) {
  const { red, green, blue, alpha } = readPixel(data, pixelIndex);

  return alpha > 180 && pixelLuminance({ red, green, blue }) < 95;
}

function isNonWhiteOpaquePixel(data, pixelIndex) {
  const { red, green, blue, alpha } = readPixel(data, pixelIndex);

  return alpha > 180 && colorDistance({ red, green, blue }, { red: 255, green: 255, blue: 255 }) > 72;
}

function estimateEdgeBackgroundColor(data, width, height) {
  const buckets = new Map();
  const addPixel = (pixelIndex) => {
    const { red, green, blue, alpha } = readPixel(data, pixelIndex);

    if (alpha < 180) {
      return;
    }

    const key = `${Math.round(red / 16)},${Math.round(green / 16)},${Math.round(blue / 16)}`;
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  };

  for (let x = 0; x < width; x += 1) {
    addPixel(x);
    addPixel((height - 1) * width + x);
  }

  for (let y = 0; y < height; y += 1) {
    addPixel(y * width);
    addPixel(y * width + width - 1);
  }

  const dominantBucket = Array.from(buckets.values()).sort((a, b) => b.count - a.count)[0];

  if (!dominantBucket) {
    return { red: 255, green: 255, blue: 255 };
  }

  return {
    red: dominantBucket.red / dominantBucket.count,
    green: dominantBucket.green / dominantBucket.count,
    blue: dominantBucket.blue / dominantBucket.count,
  };
}

function isNearBackgroundPixel(data, pixelIndex, backgroundColor) {
  const { red, green, blue, alpha } = readPixel(data, pixelIndex);
  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);

  return alpha > 40 && colorDistance({ red, green, blue }, backgroundColor) < 96 && maxChannel - minChannel <= 72;
}

function removeBackgroundMatteFromPixel(data, pixelIndex, backgroundColor) {
  const offset = pixelIndex * 4;
  const { red, green, blue, alpha: currentAlpha } = readPixel(data, pixelIndex);
  const distanceFromBackground = colorDistance({ red, green, blue }, backgroundColor);

  if (distanceFromBackground < 32) {
    data[offset + 3] = 0;
    return true;
  }

  if (distanceFromBackground >= 150) {
    return false;
  }

  const alphaRatio = (distanceFromBackground - 32) / (150 - 32);
  const softenedAlphaRatio = Math.pow(Math.max(0, alphaRatio), 1.75);
  const nextAlpha = Math.min(currentAlpha, Math.max(0, Math.round(softenedAlphaRatio * currentAlpha)));
  data[offset + 3] = nextAlpha;

  if (nextAlpha > 0) {
    const normalizedAlpha = nextAlpha / 255;
    data[offset] = clampByte((red - backgroundColor.red * (1 - normalizedAlpha)) / normalizedAlpha);
    data[offset + 1] = clampByte((green - backgroundColor.green * (1 - normalizedAlpha)) / normalizedAlpha);
    data[offset + 2] = clampByte((blue - backgroundColor.blue * (1 - normalizedAlpha)) / normalizedAlpha);
  }

  return nextAlpha !== currentAlpha;
}

function isLikelyBackgroundMattePixel(data, pixelIndex, backgroundColor) {
  const { red, green, blue, alpha } = readPixel(data, pixelIndex);

  if (alpha === 0) {
    return false;
  }

  const distanceFromBackground = colorDistance({ red, green, blue }, backgroundColor);
  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);

  return distanceFromBackground < 185 && maxChannel - minChannel <= 96;
}

function softenPixelsNearTransparentBackground(data, width, height, backgroundColor) {
  let changedPixels = 0;

  for (let pass = 0; pass < 3; pass += 1) {
    const alphaSnapshot = Buffer.alloc(width * height);
    for (let offset = 0, pixel = 0; offset < data.length; offset += 4, pixel += 1) {
      alphaSnapshot[pixel] = data[offset + 3] ?? 0;
    }

    let passChangedPixels = 0;

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const pixelIndex = y * width + x;
        const currentAlpha = alphaSnapshot[pixelIndex] ?? 0;

        if (currentAlpha === 0 || !isLikelyBackgroundMattePixel(data, pixelIndex, backgroundColor)) {
          continue;
        }

        const minNeighborAlpha = Math.min(alphaSnapshot[pixelIndex - 1] ?? 255, alphaSnapshot[pixelIndex + 1] ?? 255, alphaSnapshot[pixelIndex - width] ?? 255, alphaSnapshot[pixelIndex + width] ?? 255);
        const alphaLimit = pass === 0 ? 48 : pass === 1 ? 96 : 144;
        if (minNeighborAlpha >= alphaLimit) {
          continue;
        }

        passChangedPixels += removeBackgroundMatteFromPixel(data, pixelIndex, backgroundColor) ? 1 : 0;
      }
    }

    changedPixels += passChangedPixels;

    if (passChangedPixels === 0) {
      break;
    }
  }

  return changedPixels;
}

function shouldRemoveEnclosedWhiteComponent(data, width, height, pixels, bounds) {
  const area = pixels.length;
  const boxWidth = bounds.maxX - bounds.minX + 1;
  const boxHeight = bounds.maxY - bounds.minY + 1;
  const aspectRatio = boxWidth / Math.max(1, boxHeight);

  if (area < Math.max(2, width * height * 0.000005) || area > width * height * 0.015) return false;
  if (boxWidth > width * 0.18 || boxHeight > height * 0.15 || aspectRatio < 0.2 || aspectRatio > 5) return false;

  let borderPixels = 0;
  let nonWhiteBorderPixels = 0;
  let transparentBorderPixels = 0;
  const inspectNeighbor = (neighborIndex) => {
    const alpha = data[neighborIndex * 4 + 3] ?? 0;
    if (alpha === 0) {
      transparentBorderPixels += 1;
      return;
    }
    borderPixels += 1;
    nonWhiteBorderPixels += isNonWhiteOpaquePixel(data, neighborIndex) ? 1 : 0;
  };

  for (const pixelIndex of pixels) {
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0 && !isNearWhiteOpaquePixel(data, pixelIndex - 1)) inspectNeighbor(pixelIndex - 1);
    if (x < width - 1 && !isNearWhiteOpaquePixel(data, pixelIndex + 1)) inspectNeighbor(pixelIndex + 1);
    if (y > 0 && !isNearWhiteOpaquePixel(data, pixelIndex - width)) inspectNeighbor(pixelIndex - width);
    if (y < height - 1 && !isNearWhiteOpaquePixel(data, pixelIndex + width)) inspectNeighbor(pixelIndex + width);
  }

  if (borderPixels === 0 || transparentBorderPixels > 0 || nonWhiteBorderPixels / borderPixels <= 0.82) return false;

  const ringRadius = Math.max(1, Math.round(Math.min(boxWidth, boxHeight) * 0.08));
  const startX = Math.max(0, bounds.minX - ringRadius);
  const endX = Math.min(width - 1, bounds.maxX + ringRadius);
  const startY = Math.max(0, bounds.minY - ringRadius);
  const endY = Math.min(height - 1, bounds.maxY + ringRadius);
  let ringPixels = 0;
  let opaqueRingPixels = 0;
  let darkRingPixels = 0;
  let nonWhiteRingPixels = 0;

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) continue;

      ringPixels += 1;
      const pixelIndex = y * width + x;
      const alpha = data[pixelIndex * 4 + 3] ?? 0;
      if (alpha === 0) continue;

      opaqueRingPixels += 1;
      darkRingPixels += isDarkLogoPixel(data, pixelIndex) ? 1 : 0;
      nonWhiteRingPixels += isNonWhiteOpaquePixel(data, pixelIndex) ? 1 : 0;
    }
  }

  return opaqueRingPixels > 0 && nonWhiteRingPixels / opaqueRingPixels > 0.7 && (darkRingPixels / Math.max(1, ringPixels) > 0.08 || nonWhiteRingPixels / Math.max(1, ringPixels) > 0.18);
}

function removeEnclosedWhiteComponents(data, width, height) {
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  let removedPixels = 0;

  for (let startPixel = 0; startPixel < pixelCount; startPixel += 1) {
    if (visited[startPixel] || !isNearWhiteOpaquePixel(data, startPixel)) continue;

    const queue = [startPixel];
    const pixels = [];
    const bounds = { minX: width, minY: height, maxX: 0, maxY: 0 };
    visited[startPixel] = 1;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const pixelIndex = queue[cursor] ?? 0;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      pixels.push(pixelIndex);
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);

      const enqueue = (neighborIndex) => {
        if (visited[neighborIndex] || !isNearWhiteOpaquePixel(data, neighborIndex)) return;
        visited[neighborIndex] = 1;
        queue.push(neighborIndex);
      };

      if (x > 0) enqueue(pixelIndex - 1);
      if (x < width - 1) enqueue(pixelIndex + 1);
      if (y > 0) enqueue(pixelIndex - width);
      if (y < height - 1) enqueue(pixelIndex + width);
    }

    if (!shouldRemoveEnclosedWhiteComponent(data, width, height, pixels, bounds)) continue;

    for (const pixelIndex of pixels) {
      data[pixelIndex * 4 + 3] = 0;
      removedPixels += 1;
    }
  }

  return removedPixels;
}

async function makeGeneratedLogoBackgroundTransparent(bytes) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;
  const backgroundColor = estimateEdgeBackgroundColor(data, info.width, info.height);

  if (!isSafeGeneratedLogoBackgroundForTransparency(backgroundColor)) {
    return { bytes, changed: false, reason: "unsafe-background" };
  }

  const visited = new Uint8Array(pixelCount);
  const queue = [];
  let transparentPixels = 0;
  const enqueue = (pixelIndex) => {
    if (pixelIndex < 0 || pixelIndex >= pixelCount || visited[pixelIndex] || !isNearBackgroundPixel(data, pixelIndex, backgroundColor)) return;
    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  };

  for (let x = 0; x < info.width; x += 1) {
    enqueue(x);
    enqueue((info.height - 1) * info.width + x);
  }

  for (let y = 0; y < info.height; y += 1) {
    enqueue(y * info.width);
    enqueue(y * info.width + info.width - 1);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pixelIndex = queue[cursor] ?? 0;
    const x = pixelIndex % info.width;
    const y = Math.floor(pixelIndex / info.width);
    data[pixelIndex * 4 + 3] = 0;
    transparentPixels += 1;
    if (x > 0) enqueue(pixelIndex - 1);
    if (x < info.width - 1) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - info.width);
    if (y < info.height - 1) enqueue(pixelIndex + info.width);
  }

  const softenedPixels = transparentPixels > 0 ? softenPixelsNearTransparentBackground(data, info.width, info.height, backgroundColor) : 0;
  const enclosedWhitePixels = removeEnclosedWhiteComponents(data, info.width, info.height);

  if (transparentPixels === 0 && softenedPixels === 0 && enclosedWhitePixels === 0) {
    return { bytes, changed: false, reason: "no-change" };
  }

  const output = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return { bytes: output, changed: true, transparentPixels, softenedPixels, enclosedWhitePixels };
}

function safeBackupName(objectKey) {
  return objectKey.replace(/[^A-Za-z0-9_.-]/g, "_");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const databaseUrl = await readProductionDatabaseUrl();
  const backupDir = path.join("backups", `generated-logo-reprocess-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const manifest = { applied: apply, createdAt: new Date().toISOString(), rows: [] };

  await fs.mkdir(backupDir, { recursive: true });
  await client.connect();

  try {
    const result = await client.query(
      `select file.id, file.object_key, file.public_url, file.size, blob.bytes
       from uploaded_files file
       join uploaded_file_blobs blob on blob.uploaded_file_id = file.id
       where file.bucket = $1 and file.purpose = $2 and file.content_type = 'image/png'
       order by file.created_at asc`,
      [generatedLogoBucket, generatedLogoPurpose],
    );

    console.log(`Matched=${result.rowCount}`);

    for (const row of result.rows) {
      const original = Buffer.from(row.bytes);
      const backupName = safeBackupName(row.object_key);
      const backupPath = path.join(backupDir, backupName);
      await fs.writeFile(backupPath, original);

      const processed = await makeGeneratedLogoBackgroundTransparent(original);
      const entry = {
        id: row.id,
        objectKey: row.object_key,
        publicUrl: row.public_url,
        backupPath,
        originalSize: original.byteLength,
        nextSize: processed.bytes.byteLength,
        changed: processed.changed,
        transparentPixels: processed.transparentPixels ?? 0,
        softenedPixels: processed.softenedPixels ?? 0,
        enclosedWhitePixels: processed.enclosedWhitePixels ?? 0,
        reason: processed.reason,
      };
      manifest.rows.push(entry);

      if (apply && processed.changed) {
        await client.query("begin");
        try {
          await client.query("update uploaded_file_blobs set bytes = $2, updated_at = now() where uploaded_file_id = $1", [row.id, processed.bytes]);
          await client.query("update uploaded_files set size = $2, updated_at = now() where id = $1", [row.id, processed.bytes.byteLength]);
          await client.query("commit");
        } catch (error) {
          await client.query("rollback");
          throw error;
        }
      }

      console.log(`${processed.changed && apply ? "Updated" : processed.changed ? "WouldUpdate" : "Skipped"}=${row.object_key}`);
    }
  } finally {
    await fs.writeFile(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    await client.end();
  }

  const changedCount = manifest.rows.filter((row) => row.changed).length;
  console.log(`Changed=${changedCount}`);
  console.log(`BackupDir=${backupDir}`);
}

await main();
