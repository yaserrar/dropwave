"use client";

import * as React from "react";
import axios from "axios";
import { AnimatePresence } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetDrop } from "@/hooks/drops";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { SharedBundleCard } from "./shared-bundle-card";
import { SharedDropSkeleton, SharedFileCard } from "./shared-file-card";
import { SharedFileUnavailable, type UnavailableReason } from "./shared-file-unavailable";
import { UnlockCard } from "./unlock-card";

/** Maps API errors to the screen to show: 404/400 → not found, 410 → expired or already used. */
function reasonFor(error: unknown): UnavailableReason {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 404 || status === 400) return "not-found";
    if (status === 410) return error.response?.data?.reason === "consumed" ? "consumed" : "expired";
  }
  return "error";
}

/** The share page: a link's files, its password prompt, or why it can't be opened. */
export function SharedDrop({ id }: { id: string }) {
  const { data, isPending, error, refetch } = useGetDrop(id);
  const queryClient = useQueryClient();

  // The unlock cookie lasts 15 minutes; when it runs out, show the password prompt again.
  const unlockedUntil = data && !data.locked ? data.unlockedUntil : null;
  React.useEffect(() => {
    if (!unlockedUntil) return;
    const timer = setTimeout(
      () => queryClient.invalidateQueries({ queryKey: qk.drops.byId(id) }),
      Math.max(0, new Date(unlockedUntil).getTime() - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [id, queryClient, unlockedUntil]);

  // Right before the one download of a burn-after-download link: if someone else
  // just used it, the refetch fails with 410 and the page says so instead.
  const stillAvailable = React.useCallback(async () => {
    const result = await refetch();
    return !result.isError && !!result.data && !result.data.locked;
  }, [refetch]);

  const bundle = !!data && !data.locked && data.files.length > 1 && !error;

  return (
    <div className={cn("mx-auto w-full", bundle ? "max-w-2xl" : "max-w-md")}>
      <AnimatePresence mode="wait">
        {isPending ? (
          <SharedDropSkeleton key="loading" />
        ) : error || !data ? (
          <SharedFileUnavailable key="unavailable" reason={reasonFor(error)} onRetry={() => refetch()} />
        ) : data.locked ? (
          <UnlockCard key="locked" drop={data} />
        ) : bundle ? (
          <SharedBundleCard key="bundle" drop={data} beforeBurn={stillAvailable} />
        ) : (
          <SharedFileCard key="file" drop={data} file={data.files[0]!} beforeBurn={stillAvailable} />
        )}
      </AnimatePresence>
    </div>
  );
}
