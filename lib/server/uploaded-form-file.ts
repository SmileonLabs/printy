import "server-only";

export type UploadedFormFile = {
  name?: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export function isUploadedFormFile(value: unknown): value is UploadedFormFile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.type === "string" && typeof record.size === "number" && Number.isFinite(record.size) && typeof record.arrayBuffer === "function" && (record.name === undefined || typeof record.name === "string");
}

export function readUploadedFormFileName(file: UploadedFormFile, fallback: string) {
  const name = file.name?.trim();

  return name && name.length <= 255 ? name : fallback;
}
