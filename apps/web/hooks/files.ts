import { errorMessage } from "@/lib/utils";
import filesService from "@/services/files";
import { UploadArgs } from "@/types/file";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

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
    onError: (error) => {
      // Removing a file mid-upload aborts it; that's not a failure worth a toast.
      if (axios.isCancel(error)) return;
      toast.error(errorMessage(error));
    },
  });

export const useGetFileInfo = (fileId: string) =>
  useQuery({
    queryKey: ["fileInfo", fileId],
    queryFn: () => filesService.getFileInfo(fileId),
  });
