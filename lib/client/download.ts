export function readDownloadFileName(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const asciiMatch = /filename="?([^";]+)"?/i.exec(disposition);

  return encodedMatch?.[1] ? decodeURIComponent(encodedMatch[1]) : asciiMatch?.[1] ?? fallback;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function downloadUrl(url: string, fileName: string) {
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
