import "server-only";

import { access } from "fs/promises";
import { chromium, type Browser } from "playwright-core";

const chromiumPathCandidates = [
  process.env.PRINTY_CHROMIUM_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
].filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);

export class ChromiumUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChromiumUnavailableError";
  }
}

async function pathExists(filePath: string) {
  await access(filePath);
  return filePath;
}

export async function resolveChromiumExecutablePath() {
  for (const candidate of chromiumPathCandidates) {
    const resolved = await pathExists(candidate).catch(() => undefined);

    if (resolved) {
      return resolved;
    }
  }

  throw new ChromiumUnavailableError(`Chromium is unavailable. Set PRINTY_CHROMIUM_PATH to a Chromium/Chrome executable. Tried: ${chromiumPathCandidates.join(", ") || "no candidates"}.`);
}

export async function launchPrintyChromium(): Promise<Browser> {
  const executablePath = await resolveChromiumExecutablePath();

  return chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown Chromium launch error.";
    throw new ChromiumUnavailableError(`Chromium failed to launch from ${executablePath}: ${message}`);
  });
}
