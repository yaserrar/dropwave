//------------------------------------------------
export type UploadArgs = {
  file: File;
  /** When the share link stops working; omit for a link that never expires. */
  expiresAt?: Date;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

//------------------------------------------------

export type GenerateResponse = { fileId: string; uploadUrl: string };
export type ConfirmResponse = { fileId: string };

export type PreviewResponse = { kind: "image" | "pdf" | "text"; url: string };

export type FileInfo = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
  expiresAt: string | null;
};
