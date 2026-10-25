/** What file-type found in the file's first bytes; undefined when there's no known signature. */
export type Detected = { ext: string; mime: string } | undefined;

export type Verdict = { ok: true } | { ok: false; reason: string };

// Keep in sync with MAX_FILE_SIZE in apps/api/src/lib/consts.ts.
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const toMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * The real size of what landed in S3. The API only validated the size the client
 * declared, and a presigned PUT accepts any size, so this catches uploads that lied
 * about it even if the client never calls /confirm.
 */
export function checkFileSize(size: number, maxSize = MAX_FILE_SIZE): Verdict {
  if (size <= 0) return { ok: false, reason: "the file is empty" };
  if (size > maxSize) {
    return { ok: false, reason: `the file is ${toMb(size)}, over the ${toMb(maxSize)} limit` };
  }
  return { ok: true };
}

// Programs that run on Windows, Linux or macOS. Rejected whatever type they claim.
const EXECUTABLES = new Set(["exe", "elf", "macho"]);

// Declared types that always start with a signature, so "no signature" means the
// content isn't what it claims. Text formats have none, so they're not listed.
const SIGNED_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "audio/mpeg",
]);

// Office documents are zip archives; from the first bytes alone they may only be
// recognisable as a zip, so any of these may be detected as any other.
const ZIP_FAMILY = new Set([
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/epub+zip",
]);

// Browsers and operating systems use different names for the same type.
const ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "application/x-zip-compressed": "application/zip",
  "audio/mp3": "audio/mpeg",
};

/** "Image/PNG; charset=x" → "image/png", with aliases resolved. */
export function normalizeType(contentType: string | undefined): string {
  const type = (contentType ?? "").split(";")[0]!.trim().toLowerCase();
  return ALIASES[type] ?? (type || "application/octet-stream");
}

/**
 * Does the content match the type the uploader declared? This catches renamed
 * files (an .exe sent as a PDF) and executables; it is not a virus scan.
 */
export function checkFileType(declaredType: string | undefined, detected: Detected): Verdict {
  const declared = normalizeType(declaredType);

  if (detected && EXECUTABLES.has(detected.ext)) {
    return { ok: false, reason: `executable content (${detected.ext})` };
  }

  if (!detected) {
    return SIGNED_TYPES.has(declared)
      ? { ok: false, reason: `declared ${declared} but the file has no ${declared} signature` }
      : { ok: true };
  }

  const actual = normalizeType(detected.mime);
  if (actual === declared) return { ok: true };
  if (ZIP_FAMILY.has(declared) && ZIP_FAMILY.has(actual)) return { ok: true };
  // "Some binary file" contradicts nothing; executables were already rejected above.
  if (declared === "application/octet-stream") return { ok: true };

  return { ok: false, reason: `declared ${declared} but the content is ${actual}` };
}
