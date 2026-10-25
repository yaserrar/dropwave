import type { GenerateSchema, ShareSchema } from "@/schemas/files";
import axios from "@/lib/axios";
import axiosBase from "axios";
import {
  GenerateResponse,
  ConfirmResponse,
  FileInfo,
  PreviewResponse,
  ShareResponse,
} from "@/types/file";

const filesService = {
  generate: async (data: GenerateSchema) => {
    return (await axios.post("/files/generate", data)).data as GenerateResponse;
  },
  uploadToS3: async (
    uploadUrl: string,
    file: File,
    contentType: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ) => {
    await axiosBase.put(uploadUrl, file, {
      headers: {
        "Content-Type": contentType,
      },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress((event.loaded / event.total) * 100);
        }
      },
      signal,
    });
  },
  confirm: async (id: string) => {
    return (await axios.post(`/files/${id}/confirm`)).data as ConfirmResponse;
  },

  getFileInfo: async (id: string) => {
    return (await axios.get(`/files/${id}`)).data as FileInfo;
  },
  getPreview: async (id: string) => {
    return (await axios.get(`/files/${id}/preview`)).data as PreviewResponse;
  },
  // Plain axios: this is a presigned S3 URL, not our API.
  getText: async (url: string) => {
    return (await axiosBase.get(url, { responseType: "text" })).data as string;
  },
  share: async (id: string, data: ShareSchema) => {
    return (await axios.post(`/files/${id}/share`, data)).data as ShareResponse;
  },
  download: async (id: string) => {
    return (await axios.get(`/files/${id}/download`, { responseType: "blob" }))
      .data as Blob;
  },
};

export default filesService;
