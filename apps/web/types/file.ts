//------------------------------------------------
export type UploadArgs = {
  file: File;
  /** When the share link stops working; omit for a link that never expires. */
  expiresAt?: Date;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

export type ShareArgs = { fileId: string; emails: string[] };

//------------------------------------------------

export type GenerateResponse = { fileId: string; uploadUrl: string };
export type ConfirmResponse = { fileId: string };

export type PreviewResponse = { kind: "image" | "pdf" | "text"; url: string };

/** How many emails went out, and the addresses SES refused. */
export type ShareResponse = { sent: number; failed: string[] };

export type FileStatus =
  "PENDING" | "EXPIRED" | "SCANNING" | "REMOVED" | "DELETED" | "UPLOADED";

export type FileInfo = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  status: FileStatus;
  createdAt: string;
  expiresAt: string | null;
};
