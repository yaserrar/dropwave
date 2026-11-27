import { qk } from "@/lib/query-keys";
import { errorMessage } from "@/lib/utils";
import dropsService from "@/services/drops";
import type { DropInfo, ShareArgs } from "@/types/drop";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

export const useShareDrop = () =>
  useMutation({
    mutationFn: ({ dropId, emails }: ShareArgs) => dropsService.share(dropId, { emails }),
    onError: (error) => toast.error(String(errorMessage(error))),
  });

// Only fetched while the preview dialog is open. The URL is valid for an hour,
// so cache it a bit less than that and reopening the dialog is instant.
export const useGetPreview = (dropId: string, fileId: string, enabled: boolean) =>
  useQuery({
    queryKey: [...qk.drops.byId(dropId), "preview", fileId],
    queryFn: () => dropsService.getPreview(dropId, fileId),
    enabled,
    staleTime: 50 * 60 * 1000,
    retry: false,
  });

export const useGetPreviewText = (url: string | undefined) =>
  useQuery({
    queryKey: ["preview-text", url],
    queryFn: () => dropsService.getText(url!),
    enabled: !!url,
    staleTime: Infinity,
    retry: false,
  });

const isChecking = (drop: DropInfo | undefined) =>
  !!drop && !drop.locked && drop.files.some((file) => file.status === "SCANNING");

export const useGetDrop = (dropId: string) =>
  useQuery({
    queryKey: qk.drops.byId(dropId),
    queryFn: () => dropsService.getDrop(dropId),
    refetchOnWindowFocus: false,
    // The file check takes seconds: poll quickly until it's done, then every minute
    // (to notice an expiry or a burn-after-download link being used).
    refetchInterval: (query) => (isChecking(query.state.data) ? 5 * 1000 : 60 * 1000),
    // A 4xx (wrong link, expired) won't change on retry; only retry server/network errors.
    retry: (failureCount, error) => {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status && status < 500) return false;
      return failureCount < 1;
    },
  });

/** Sends the password; the API answers with an httpOnly cookie, then the drop is refetched open. */
export const useUnlockDrop = (dropId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => dropsService.unlock(dropId, password),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.drops.byId(dropId) }),
  });
};
