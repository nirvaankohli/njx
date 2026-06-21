import { sha256Hex } from "./docshield-signing";

const SUPPORTED_EXTENSIONS = [".pdf", ".docx"] as const;
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function isSupportedDocumentFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension)) || SUPPORTED_MIME_TYPES.has(file.type);
}

export async function fingerprintDocumentFile(file: File) {
  return sha256Hex(await file.arrayBuffer());
}

export function inferDocumentMimeType(file: File) {
  if (file.type) return file.type;
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

export function buildDocumentId(fingerprint: string) {
  const normalized = fingerprint.replace(/^sha256:/, "");
  const suffix = normalized.replace(/[^a-f0-9]/gi, "").slice(0, 16);
  return `doc_${suffix || "document"}`;
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"] as const;
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 0; index < units.length; index += 1) {
    unit = units[index];
    if (value < 1024 || index === units.length - 1) break;
    value /= 1024;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}
