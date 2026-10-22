import {
  Archive,
  Document,
  DocumentCode,
  DocumentText,
  Gallery,
  Music,
  VideoPlay,
  type Icon,
} from "iconsax-react";

const ARCHIVE_EXTENSIONS = ["zip", "rar", "7z", "tar", "gz"];
const CODE_EXTENSIONS = ["js", "ts", "tsx", "json", "html", "css", "py", "go", "rs", "sh"];
const TEXT_EXTENSIONS = ["pdf", "doc", "docx", "md", "txt", "rtf"];

/** Icon for a file, from its MIME type first and its extension as a fallback. */
export function iconForFile(filename: string, contentType: string): Icon {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (contentType.startsWith("image/")) return Gallery;
  if (contentType.startsWith("video/")) return VideoPlay;
  if (contentType.startsWith("audio/")) return Music;
  if (ARCHIVE_EXTENSIONS.includes(ext)) return Archive;
  if (CODE_EXTENSIONS.includes(ext)) return DocumentCode;
  if (contentType.startsWith("text/") || TEXT_EXTENSIONS.includes(ext)) return DocumentText;
  return Document;
}
