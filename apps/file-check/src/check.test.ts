import { fileTypeFromBuffer } from "file-type";
import { describe, expect, it } from "vitest";
import { checkFileType, normalizeType } from "./check.js";

// Real file signatures, so the tests go through file-type exactly like the Lambda does.
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00,
]);
const PDF = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\n");
const ELF = Uint8Array.from([
  0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01,
  ...Array.from({ length: 57 }, () => 0),
]);
const TEXT = new TextEncoder().encode("Hello from Dropwave, just a plain text file.\n");

async function verdict(declared: string, bytes: Uint8Array) {
  return checkFileType(declared, await fileTypeFromBuffer(bytes));
}

describe("checkFileType", () => {
  it("accepts files whose content matches the declared type", async () => {
    expect(await verdict("image/png", PNG)).toEqual({ ok: true });
    expect(await verdict("application/pdf", PDF)).toEqual({ ok: true });
  });

  it("accepts text, which has no signature", async () => {
    expect(await verdict("text/plain", TEXT)).toEqual({ ok: true });
    expect(await verdict("text/csv; charset=utf-8", TEXT)).toEqual({ ok: true });
  });

  it("rejects content that contradicts the declared type", async () => {
    const result = await verdict("application/pdf", PNG);
    expect(result).toEqual({
      ok: false,
      reason: "declared application/pdf but the content is image/png",
    });
  });

  it("rejects a signed type whose content has no signature", async () => {
    expect((await verdict("image/png", TEXT)).ok).toBe(false);
  });

  it("rejects executables whatever they claim to be", async () => {
    for (const declared of ["application/pdf", "application/octet-stream", "text/plain"]) {
      expect(await verdict(declared, ELF)).toEqual({
        ok: false,
        reason: "executable content (elf)",
      });
    }
  });

  it("accepts any non-executable content declared as generic binary", async () => {
    expect(await verdict("application/octet-stream", PNG)).toEqual({ ok: true });
  });

  it("treats office documents and zip archives as the same family", () => {
    const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    expect(checkFileType(docx, { ext: "zip", mime: "application/zip" })).toEqual({ ok: true });
  });
});

describe("normalizeType", () => {
  it("lowercases, drops parameters and resolves aliases", () => {
    expect(normalizeType("Image/JPG; q=1")).toBe("image/jpeg");
    expect(normalizeType("application/x-zip-compressed")).toBe("application/zip");
    expect(normalizeType(undefined)).toBe("application/octet-stream");
  });
});
