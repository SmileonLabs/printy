import "server-only";

import sharp from "sharp";
import { Worker } from "worker_threads";

const maxVectorGridSize = 128;
const transparentAlphaThreshold = 24;
const whiteDistanceThreshold = 28;
const highQualityTimeoutMs = 25_000;

type Rgba = { r: number; g: number; b: number; a: number };

function assertVectorSvg(svg: string) {
  if (!/<path\b/i.test(svg) || /<image\b/i.test(svg)) {
    throw new Error("Vectorization did not produce path-only SVG output.");
  }
}

function isNearWhite(pixel: Rgba) {
  return 255 - pixel.r < whiteDistanceThreshold && 255 - pixel.g < whiteDistanceThreshold && 255 - pixel.b < whiteDistanceThreshold;
}

function isForegroundPixel(pixel: Rgba, hasTransparency: boolean) {
  if (pixel.a <= transparentAlphaThreshold) {
    return false;
  }

  return hasTransparency || !isNearWhite(pixel);
}

function colorToHex(pixel: Rgba) {
  return `#${[pixel.r, pixel.g, pixel.b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function quantizeColor(pixel: Rgba) {
  const quantize = (value: number) => Math.round(value / 32) * 32;
  const clamped = (value: number) => Math.min(value, 255);

  return colorToHex({ r: clamped(quantize(pixel.r)), g: clamped(quantize(pixel.g)), b: clamped(quantize(pixel.b)), a: pixel.a });
}

function appendRunPath(pathData: string[], x: number, y: number, width: number) {
  pathData.push(`M${x} ${y}h${width}v1H${x}z`);
}

export async function vectorizeGeneratedLogo(bytes: Uint8Array) {
  const { data, info } = await sharp(bytes)
    .resize({ width: maxVectorGridSize, height: maxVectorGridSize, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hasTransparency = Array.from({ length: info.width * info.height }).some((_, index) => data[index * 4 + 3] < 250);
  const pathsByColor = new Map<string, string[]>();
  let foregroundCount = 0;

  for (let y = 0; y < info.height; y += 1) {
    let runColor = "";
    let runStart = 0;
    let runWidth = 0;

    const flushRun = () => {
      if (!runColor || runWidth === 0) {
        return;
      }

      const pathData = pathsByColor.get(runColor) ?? [];
      appendRunPath(pathData, runStart, y, runWidth);
      pathsByColor.set(runColor, pathData);
      foregroundCount += runWidth;
      runColor = "";
      runWidth = 0;
    };

    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * 4;
      const pixel: Rgba = { r: data[index], g: data[index + 1], b: data[index + 2], a: data[index + 3] };

      if (!isForegroundPixel(pixel, hasTransparency)) {
        flushRun();
        continue;
      }

      const color = quantizeColor(pixel);

      if (color === runColor) {
        runWidth += 1;
        continue;
      }

      flushRun();
      runColor = color;
      runStart = x;
      runWidth = 1;
    }

    flushRun();
  }

  if (foregroundCount === 0) {
    throw new Error("Vectorization found no visible logo pixels.");
  }

  const paths = Array.from(pathsByColor.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([color, pathData]) => `<path fill="${color}" d="${pathData.join("")}"/>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${info.width} ${info.height}" shape-rendering="geometricPrecision">${paths}</svg>`;

  assertVectorSvg(svg);

  return svg;
}

function highQualityWorkerSource() {
  return `
    const { parentPort, workerData } = require("worker_threads");
    const sharp = require("sharp");
    const { posterize, trace } = require("potrace");

    function stripRasterImages(svg) {
      return svg.replace(/<image\\b[^>]*>/gi, "").replace(/<\\/image>/gi, "");
    }

    function assertVectorSvg(svg) {
      if (!/<path\\b/i.test(svg) || /<image\\b/i.test(svg)) {
        throw new Error("Vectorization did not produce path-only SVG output.");
      }
    }

    function posterizeToSvg(bytes) {
      return new Promise((resolve, reject) => {
        posterize(bytes, { steps: 4, background: "transparent", optCurve: true, optTolerance: 0.18, turdSize: 4 }, (error, svg) => error ? reject(error) : resolve(svg));
      });
    }

    function traceToSvg(bytes) {
      return new Promise((resolve, reject) => {
        trace(bytes, { background: "transparent", blackOnWhite: false, optCurve: true, optTolerance: 0.18, threshold: 170, turdSize: 4 }, (error, svg) => error ? reject(error) : resolve(svg));
      });
    }

    async function run() {
      const normalizedPng = await sharp(Buffer.from(workerData.bytes)).resize({ width: 384, height: 384, fit: "inside", withoutEnlargement: true }).png().toBuffer();
      let svg = "";
      try {
        svg = stripRasterImages(await posterizeToSvg(normalizedPng));
      } catch {
        svg = stripRasterImages(await traceToSvg(normalizedPng));
      }
      assertVectorSvg(svg);
      parentPort.postMessage({ svg });
    }

    run().catch((error) => parentPort.postMessage({ error: error instanceof Error ? error.message : "High quality vectorization failed." }));
  `;
}

export async function vectorizeGeneratedLogoHighQuality(bytes: Uint8Array) {
  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(highQualityWorkerSource(), { eval: true, workerData: { bytes: Buffer.from(bytes) } });
    const timeout = setTimeout(() => {
      void worker.terminate();
      reject(new Error("고품질 SVG 변환 시간이 초과됐어요. 빠른 SVG 또는 SVG 업로드를 사용해 주세요."));
    }, highQualityTimeoutMs);

    worker.once("message", (message: unknown) => {
      clearTimeout(timeout);
      void worker.terminate();

      if (typeof message === "object" && message !== null && "svg" in message && typeof (message as { svg?: unknown }).svg === "string") {
        resolve((message as { svg: string }).svg);
        return;
      }

      const reason = typeof message === "object" && message !== null && "error" in message && typeof (message as { error?: unknown }).error === "string" ? (message as { error: string }).error : "고품질 SVG 변환에 실패했어요.";
      reject(new Error(reason));
    });

    worker.once("error", (error) => {
      clearTimeout(timeout);
      void worker.terminate();
      reject(error);
    });
  });
}
