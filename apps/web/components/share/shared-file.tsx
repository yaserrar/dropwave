"use client";

import axios from "axios";
import { AnimatePresence } from "motion/react";
import { useGetFileInfo } from "@/hooks/files";
import { SharedFileCard, SharedFileSkeleton } from "./shared-file-card";
import { SharedFileUnavailable, type UnavailableReason } from "./shared-file-unavailable";

/** Maps API errors to the screen to show: 404/400 → not found, 410 → expired. */
function reasonFor(error: unknown): UnavailableReason {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 404 || status === 400) return "not-found";
    if (status === 410) return "expired";
  }
  return "error";
}

export function SharedFile({ id }: { id: string }) {
  const { data, isPending, error, refetch } = useGetFileInfo(id);

  // The API redirects this URL to a short-lived S3 download link.
  const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL}/files/${id}/download`;

  return (
    <AnimatePresence mode="wait">
      {isPending ? (
        <SharedFileSkeleton key="loading" />
      ) : error || !data ? (
        <SharedFileUnavailable key="unavailable" reason={reasonFor(error)} onRetry={() => refetch()} />
      ) : (
        <SharedFileCard key="file" file={data} downloadUrl={downloadUrl} />
      )}
    </AnimatePresence>
  );
}
