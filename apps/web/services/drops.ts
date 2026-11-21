import type { ShareSchema } from "@/schemas/drops";
import axios from "@/lib/axios";
import axiosBase from "axios";
import type {
  ConfirmResponse,
  CreateDropRequest,
  CreateDropResponse,
  DropInfo,
  PreviewResponse,
  ShareResponse,
  UnlockResponse,
  UploadUrlResponse,
} from "@/types/drop";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const uploadHeaders = (uploadToken: string) => ({ "x-upload-token": uploadToken });

const dropsService = {
  create: async (data: CreateDropRequest) => {
    return (await axios.post("/drops", data)).data as CreateDropResponse;
  },
  uploadUrl: async (dropId: string, fileId: string, uploadToken: string) => {
    return (
      await axios.post(`/drops/${dropId}/files/${fileId}/upload-url`, null, {
        headers: uploadHeaders(uploadToken),
      })
    ).data as UploadUrlResponse;
  },
  uploadToS3: async (
    uploadUrl: string,
    file: File,
    contentType: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ) => {
    // Plain axios: this is a presigned S3 URL, not our API.
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
  confirm: async (dropId: string, fileId: string, uploadToken: string) => {
    return (
      await axios.post(`/drops/${dropId}/files/${fileId}/confirm`, null, {
        headers: uploadHeaders(uploadToken),
      })
    ).data as ConfirmResponse;
  },
  removeFile: async (dropId: string, fileId: string, uploadToken: string) => {
    await axios.delete(`/drops/${dropId}/files/${fileId}`, { headers: uploadHeaders(uploadToken) });
  },

  getDrop: async (id: string) => {
    return (await axios.get(`/drops/${id}`)).data as DropInfo;
  },
  unlock: async (id: string, password: string) => {
    return (await axios.post(`/drops/${id}/unlock`, { password })).data as UnlockResponse;
  },
  getPreview: async (dropId: string, fileId: string) => {
    return (await axios.get(`/drops/${dropId}/files/${fileId}/preview`)).data as PreviewResponse;
  },
  // Plain axios: this is a presigned S3 URL, not our API.
  getText: async (url: string) => {
    return (await axiosBase.get(url, { responseType: "text" })).data as string;
  },
  share: async (id: string, data: ShareSchema) => {
    return (await axios.post(`/drops/${id}/share`, data)).data as ShareResponse;
  },

  // Plain links: the API redirects (one file) or streams a zip (all files), and the
  // browser sends the unlock cookie with them like with any request to the API.
  fileDownloadUrl: (dropId: string, fileId: string) => `${API_URL}/drops/${dropId}/files/${fileId}/download`,
  zipDownloadUrl: (dropId: string) => `${API_URL}/drops/${dropId}/download`,
};

export default dropsService;
