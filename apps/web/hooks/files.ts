import { qk } from "@/lib/query-keys";
import { errorMessage } from "@/lib/utils";
import filesService from "@/services/files";
import { UploadArgs } from "@/types/file";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

export const useUploadFile = () =>
  useMutation({
    mutationFn: async ({ file, expiresAt, onProgress, signal }: UploadArgs) => {
      const contentType = file.type || "application/octet-stream";
      const { fileId, uploadUrl } = await filesService.generate({
        filename: file.name,
        contentType,
        size: file.size,
        expiresAt,
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

// Only fetched while the preview dialog is open. The URL is valid for an hour,
// so cache it a bit less than that and reopening the dialog is instant.
export const useGetPreview = (fileId: string, enabled: boolean) =>
  useQuery({
    queryKey: [...qk.files.byId(fileId), "preview"],
    queryFn: () => filesService.getPreview(fileId),
    enabled,
    staleTime: 50 * 60 * 1000,
    retry: false,
  });

export const useGetPreviewText = (url: string | undefined) =>
  useQuery({
    queryKey: ["preview-text", url],
    queryFn: () => filesService.getText(url!),
    enabled: !!url,
    staleTime: Infinity,
    retry: false,
  });

export const useGetFileInfo = (fileId: string) =>
  useQuery({
    queryKey: qk.files.byId(fileId),
    queryFn: () => filesService.getFileInfo(fileId),
    refetchOnWindowFocus: false,
    refetchInterval: 60 * 1000, // 5 minutes
    // A 4xx (wrong link, expired) won't change on retry; only retry server/network errors.
    retry: (failureCount, error) => {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      if (status && status < 500) return false;
      return failureCount < 1;
    },
  });
