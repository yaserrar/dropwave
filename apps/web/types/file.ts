export type FileStatus = "PENDING" | "UPLOADING" | "DONE" | "ERROR";

export type File = {
  id: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
  status: FileStatus;
  downloadCount: number;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};
