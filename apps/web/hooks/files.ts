import { errorMessage } from "@/lib/utils";
import type { GenerateSchema } from "@/schemas/files";
import filesService from "@/services/files";
import { UploadArgs } from "@/types/file";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export const useGenerate = () => {
  return useMutation({
    mutationFn: (data: GenerateSchema) => filesService.generate(data),
    onSuccess: () => {
      toast.success("File generated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to generate file: ${errorMessage(error)}`);
    },
  });
};

export const useUploadFile = () =>
  useMutation({
    mutationFn: async ({ file, onProgress, signal }: UploadArgs) => {
      const contentType = file.type || "application/octet-stream";
      const { fileId, uploadUrl } = await filesService.generate({
        filename: file.name,
        contentType,
        size: file.size,
      });
      await filesService.uploadToS3(
        uploadUrl,
        file,
        contentType,
        onProgress,
        signal,
      );
      return filesService.confirm(fileId);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
export const useConfirm = () => {
  return useMutation({
    mutationFn: (id: string) => filesService.confirm(id),
    onSuccess: () => {
      toast.success("File confirmed successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to confirm file: ${errorMessage(error)}`);
    },
  });
};
