import "server-only";

const defaultOpenAIImageModel = "gpt-image-2";
const maxConcurrentImageRequests = 2;
const imageRequestTimeoutMs = 240_000;

let runningImageRequests = 0;
const imageRequestQueue: Array<() => void> = [];

export class AiBusinessCardImageTimeoutError extends Error {
  constructor() {
    super("AI image generation timed out.");
    this.name = "AiBusinessCardImageTimeoutError";
  }
}

export function readOpenAIImageModel() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || defaultOpenAIImageModel;
}

function releaseImageSlot() {
  runningImageRequests = Math.max(0, runningImageRequests - 1);
  imageRequestQueue.shift()?.();
}

async function acquireImageSlot() {
  if (runningImageRequests < maxConcurrentImageRequests) {
    runningImageRequests += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    imageRequestQueue.push(() => {
      runningImageRequests += 1;
      resolve();
    });
  });
}

export async function runLimitedImageGeneration<T>(operation: (signal: AbortSignal) => Promise<T>) {
  await acquireImageSlot();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), imageRequestTimeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AiBusinessCardImageTimeoutError();
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    releaseImageSlot();
  }
}
