export type FileStatus = "PENDING" | "EXPIRED" | "SCANNING" | "REMOVED" | "DELETED" | "UPLOADED";

//------------------------------------------------
/** Options chosen before dropping; they apply to the whole link. */
export type DropOptions = {
  /** When the share link stops working; null for a link that never expires. */
  expiresAt: Date | null;
  /** Null while the Password switch is off; "" when it's on but nothing is typed yet. */
  password: string | null;
  burnAfterDownload: boolean;
};

export type CreateDropRequest = {
  files: { path: string; contentType: string; size: number }[];
  expiresAt?: Date;
  password?: string;
  burnAfterDownload?: boolean;
};

export type ShareArgs = { dropId: string; emails: string[] };

//------------------------------------------------

export type CreateDropResponse = {
  dropId: string;
  /** Sent back on the upload routes; only this browser can add files to the drop. */
  uploadToken: string;
  /** In the order they were sent. */
  files: { id: string; path: string; uploadUrl: string }[];
};
export type UploadUrlResponse = { uploadUrl: string };
export type ConfirmResponse = { fileId: string; status: FileStatus };

export type PreviewResponse = { kind: "image" | "pdf" | "text"; url: string };

/** How many emails went out, and the addresses SES refused. */
export type ShareResponse = { sent: number; failed: string[] };

export type UnlockResponse = { unlockedUntil: string };

export type DropFile = {
  id: string;
  /** "photos/2024/a.jpg" inside a folder, or just the name. */
  path: string;
  filename: string;
  contentType: string;
  size: number;
  /** SCANNING while the file check runs; REMOVED when it failed. */
  status: Extract<FileStatus, "SCANNING" | "UPLOADED" | "REMOVED">;
};

type DropSummary = {
  id: string;
  protected: boolean;
  burnAfterDownload: boolean;
  expiresAt: string | null;
};

/** A password-protected link before the password: no names, sizes or count. */
export type LockedDrop = DropSummary & { locked: true };

export type OpenDrop = DropSummary & {
  locked: false;
  /** When this browser's unlock ends; null for a link without a password. */
  unlockedUntil: string | null;
  createdAt: string;
  files: DropFile[];
};

export type DropInfo = LockedDrop | OpenDrop;
