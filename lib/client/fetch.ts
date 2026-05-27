export function readApiReason(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "reason" in value && typeof value.reason === "string" ? value.reason : fallback;
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}
