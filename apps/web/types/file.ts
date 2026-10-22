// export type FileStatus = "PENDING" | "UPLOADING" | "DONE" | "ERROR";

// export type File = {
//   id: string;
//   key: string;
//   filename: string;
//   contentType: string;
//   size: number;
//   status: FileStatus;
//   downloadCount: number;
//   expiresAt?: Date;
//   createdAt: Date;
//   updatedAt: Date;
// };

//------------------------------------------------
export type UploadArgs = {
  file: File;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
};

//------------------------------------------------

export type GenerateResponse = { fileId: string; uploadUrl: string };
export type ConfirmResponse = { fileId: string };
