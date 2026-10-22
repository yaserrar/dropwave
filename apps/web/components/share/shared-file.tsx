"use client";

import * as React from "react";
import axios, { AxiosError, type AxiosResponse } from "axios";
import { AnimatePresence } from "motion/react";
import type { FileInfo } from "@/types/file";
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
  // TODO: replace with your hook, e.g. `const { data, isPending, error, refetch } = useFileInfo(id);`
  const { data, isPending, error, refetch } = usePreviewFileInfo(id);

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

// ─── Preview data — delete everything below once your hook is in place ─────
// Add ?preview=missing | expired | error to the URL to see the other states.

function usePreviewFileInfo(id: string) {
  const [state, setState] = React.useState<{ data?: FileInfo; error?: unknown; isPending: boolean }>({ isPending: true });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    const preview = new URLSearchParams(window.location.search).get("preview");
    const timer = setTimeout(() => {
      const status = { missing: 404, expired: 410, error: 500 }[preview ?? ""];
      if (status) {
        const response = { status } as AxiosResponse;
        setState({ isPending: false, error: new AxiosError("Preview error", undefined, undefined, undefined, response) });
      } else {
        setState({
          isPending: false,
          data: {
            id,
            filename: "Q3 product report.pdf",
            contentType: "application/pdf",
            size: 2_480_000,
            createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(),
          },
        });
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [id, attempt]);

  const refetch = () => {
    setState({ isPending: true });
    setAttempt((n) => n + 1);
  };

  return { ...state, refetch };
}
