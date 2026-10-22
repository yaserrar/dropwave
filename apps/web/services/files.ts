import type { GenerateSchema } from "@/schemas/files";
import axios from "@/lib/axios";
import axiosBase from "axios";
import { GenerateResponse, ConfirmResponse } from "@/types/file";

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
};

export default filesService;
