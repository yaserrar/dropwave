"use client";

import * as React from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  MAX_FILE_SIZE,
  MIN_EXPIRY_MS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  UPLOAD_CONCURRENCY,
  UPLOAD_URL_FRESH_MS,
} from "@/lib/consts";
import type { PickedFile } from "@/lib/drop-files";
import { formatBytes } from "@/lib/format";
import { createLimiter } from "@/lib/limit";
import { errorMessage } from "@/lib/utils";
import dropsService from "@/services/drops";
import type { CreateDropResponse, DropOptions } from "@/types/drop";

export type UploadFile = {
  id: string;
  file: File;
  path: string;
  status: "waiting" | "uploading" | "done" | "error";
  percent: number;
  error?: string;
  /** Being deleted from its link (an uploaded file the user took out). */
  removing?: boolean;
};

/** Everything dropped at once: one link, whatever the number of files. */
export type UploadDrop = {
  id: string;
  status: "uploading" | "done" | "error";
  files: UploadFile[];
  /** The API's id for the drop, once it's created. */
  dropId: string;
  shareUrl: string;
  /** The options it was uploaded with; the password itself isn't kept. */
  expiresAt: Date | null;
  protected: boolean;
  burnAfterDownload: boolean;
  error?: string;
};

/** Why these options can't be used, or null. */
function optionsError(options: DropOptions): string | null {
  // A preset like "1 hour" can go stale if the page stays open; the API would reject it.
  if (options.expiresAt && options.expiresAt.getTime() - Date.now() < MIN_EXPIRY_MS) {
    return "Expiry time has passed. Pick a new one";
  }
  if (options.password === null) return null;
  // The switch says the link is protected: never let it go out without a password.
  if (options.password === "") return "Enter a password, or turn Password off";
  const { length } = options.password;
  if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) {
    return `The password needs ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters`;
  }
  return null;
}

function createFile({ file, path }: PickedFile): UploadFile {
  const base = { id: crypto.randomUUID(), file, path, percent: 0 };
  if (file.size > MAX_FILE_SIZE) {
    return { ...base, status: "error", error: `Larger than ${formatBytes(MAX_FILE_SIZE, 0)}` };
  }
  if (file.size === 0) return { ...base, status: "error", error: "This file is empty" };
  return { ...base, status: "waiting" };
}

const contentTypeOf = (file: File) => file.type || "application/octet-stream";

/**
 * The upload page's state: each drop's files, their progress, and the link once
 * they're in. Files upload straight to S3, UPLOAD_CONCURRENCY at a time across
 * the page; a file that fails is taken out of its drop, and the link opens with
 * the files that made it.
 */
export function useDropUploads() {
  const [drops, setDrops] = React.useState<UploadDrop[]>([]);
  // The latest list, for event handlers that act on it (side effects stay out of setState).
  const dropsRef = React.useRef(drops);
  React.useEffect(() => {
    dropsRef.current = drops;
  }, [drops]);

  // Per file: cancels its upload when it's removed.
  const controllers = React.useRef(new Map<string, AbortController>());
  // Files and drops removed by the user while their upload was still running.
  const removed = React.useRef(new Set<string>());
  // Per drop and per file, once the API created them.
  const createdDrops = React.useRef(new Map<string, { dropId: string; uploadToken: string }>());
  const createdFiles = React.useRef(new Map<string, { id: string; uploadUrl: string }>());
  const [limit] = React.useState(() => createLimiter(UPLOAD_CONCURRENCY));

  const updateDrop = React.useCallback((id: string, update: (drop: UploadDrop) => UploadDrop) => {
    setDrops((prev) => prev.map((drop) => (drop.id === id ? update(drop) : drop)));
  }, []);

  const updateFile = React.useCallback(
    (dropKey: string, fileKey: string, patch: Partial<UploadFile>) => {
      updateDrop(dropKey, (drop) => ({
        ...drop,
        files: drop.files.map((file) => (file.id === fileKey ? { ...file, ...patch } : file)),
      }));
    },
    [updateDrop],
  );

  /**
   * Takes a file out of its drop on the API, so the link opens without it. Best
   * effort: if this fails, the file never finished, and its drop stays hidden.
   */
  const removeOnServer = React.useCallback((dropKey: string, fileKey: string) => {
    const drop = createdDrops.current.get(dropKey);
    const file = createdFiles.current.get(fileKey);
    if (!drop || !file) return;
    dropsService.removeFile(drop.dropId, file.id, drop.uploadToken).catch(() => {});
  }, []);

  const uploadOne = React.useCallback(
    async (dropKey: string, file: UploadFile, issuedAt: number) => {
      const drop = createdDrops.current.get(dropKey)!;
      const serverFile = createdFiles.current.get(file.id)!;
      // Removed while the drop was being created, or while waiting for its turn.
      if (removed.current.has(file.id) || removed.current.has(dropKey)) {
        removeOnServer(dropKey, file.id);
        return;
      }

      const controller = new AbortController();
      controllers.current.set(file.id, controller);
      updateFile(dropKey, file.id, { status: "uploading" });
      try {
        // Waited too long for its turn: the first URL is about to expire.
        const uploadUrl =
          Date.now() - issuedAt < UPLOAD_URL_FRESH_MS
            ? serverFile.uploadUrl
            : (await dropsService.uploadUrl(drop.dropId, serverFile.id, drop.uploadToken)).uploadUrl;
        await dropsService.uploadToS3(
          uploadUrl,
          file.file,
          contentTypeOf(file.file),
          // Hold at 99% until confirm succeeds, so 100% means "really done".
          (percent) => updateFile(dropKey, file.id, { percent: Math.min(percent, 99) }),
          controller.signal,
        );
        await dropsService.confirm(drop.dropId, serverFile.id, drop.uploadToken);
        updateFile(dropKey, file.id, { status: "done", percent: 100 });
      } catch (error) {
        if (axios.isCancel(error)) return; // removed by the user, not a failure
        updateFile(dropKey, file.id, { status: "error", error: String(errorMessage(error)) });
        removeOnServer(dropKey, file.id);
      } finally {
        controllers.current.delete(file.id);
      }
    },
    [removeOnServer, updateFile],
  );

  const run = React.useCallback(
    async (drop: UploadDrop, options: DropOptions) => {
      const waiting = drop.files.filter((file) => file.status === "waiting");
      let response: CreateDropResponse;
      try {
        response = await dropsService.create({
          files: waiting.map(({ file, path }) => ({ path, contentType: contentTypeOf(file), size: file.size })),
          expiresAt: options.expiresAt ?? undefined,
          password: options.password ?? undefined,
          burnAfterDownload: options.burnAfterDownload || undefined,
        });
      } catch (error) {
        updateDrop(drop.id, (d) => ({ ...d, status: "error", error: String(errorMessage(error)) }));
        return;
      }
      const { dropId, uploadToken } = response;
      createdDrops.current.set(drop.id, { dropId, uploadToken });
      // The API answers in the order the files were sent.
      waiting.forEach((file, index) => createdFiles.current.set(file.id, response.files[index]!));
      updateDrop(drop.id, (d) => ({ ...d, dropId }));

      const issuedAt = Date.now();
      await Promise.all(waiting.map((file) => limit(() => uploadOne(drop.id, file, issuedAt))));

      updateDrop(drop.id, (d) => {
        if (d.files.some((file) => file.status === "done")) {
          return { ...d, status: "done", shareUrl: `${window.location.origin}/s/${dropId}` };
        }
        const error = d.files.length === 1 ? d.files[0]!.error : "None of the files could be uploaded";
        return { ...d, status: "error", error };
      });
    },
    [limit, updateDrop, uploadOne],
  );

  /** Starts one drop (one link) with everything dropped at once. */
  const addDrop = React.useCallback(
    (picked: PickedFile[], options: DropOptions) => {
      const files = picked.map(createFile);
      const problem =
        optionsError(options) ??
        (files.every((file) => file.status === "error")
          ? files.length === 1
            ? files[0]!.error
            : "None of these files can be uploaded"
          : null);
      const drop: UploadDrop = {
        id: crypto.randomUUID(),
        status: problem ? "error" : "uploading",
        files,
        dropId: "",
        shareUrl: "",
        expiresAt: options.expiresAt,
        protected: options.password !== null,
        burnAfterDownload: options.burnAfterDownload,
        error: problem ?? undefined,
      };
      setDrops((prev) => [drop, ...prev]);
      if (!problem) void run(drop, options);
    },
    [run],
  );

  const dropFileFromList = React.useCallback((dropKey: string, fileKey: string) => {
    setDrops((prev) =>
      prev.flatMap((drop) => {
        if (drop.id !== dropKey) return [drop];
        const files = drop.files.filter((file) => file.id !== fileKey);
        return files.length > 0 ? [{ ...drop, files }] : [];
      }),
    );
  }, []);

  /**
   * Deletes an uploaded file from its link, and only then from the list: unlike
   * a cancelled upload, it's already part of what the link shares.
   */
  const removeUploaded = React.useCallback(
    async (dropKey: string, fileKey: string) => {
      const drop = createdDrops.current.get(dropKey);
      const file = createdFiles.current.get(fileKey);
      if (!drop || !file) return;
      updateFile(dropKey, fileKey, { removing: true });
      try {
        await dropsService.removeFile(drop.dropId, file.id, drop.uploadToken);
        dropFileFromList(dropKey, fileKey);
      } catch (error) {
        updateFile(dropKey, fileKey, { removing: false });
        toast.error("Couldn't remove the file", { description: String(errorMessage(error)) });
      }
    },
    [dropFileFromList, updateFile],
  );

  /**
   * Takes one file out of a drop. One still on its way is cancelled (the last one
   * takes the drop with it); one already uploaded is deleted from the link.
   */
  const removeFile = React.useCallback(
    (dropKey: string, fileKey: string) => {
      const file = dropsRef.current.find((d) => d.id === dropKey)?.files.find((f) => f.id === fileKey);
      if (file?.status === "done") {
        void removeUploaded(dropKey, fileKey);
        return;
      }
      removed.current.add(fileKey);
      controllers.current.get(fileKey)?.abort();
      removeOnServer(dropKey, fileKey);
      dropFileFromList(dropKey, fileKey);
    },
    [dropFileFromList, removeOnServer, removeUploaded],
  );

  /** Removes a drop from the list. One still uploading is cancelled, files and all. */
  const removeDrop = React.useCallback(
    (dropKey: string) => {
      const drop = dropsRef.current.find((d) => d.id === dropKey);
      removed.current.add(dropKey);
      if (drop?.status === "uploading") {
        for (const file of drop.files) {
          controllers.current.get(file.id)?.abort();
          removeOnServer(dropKey, file.id);
        }
      }
      setDrops((prev) => prev.filter((d) => d.id !== dropKey));
    },
    [removeOnServer],
  );

  const clearAll = React.useCallback(() => {
    dropsRef.current.forEach((drop) => removeDrop(drop.id));
  }, [removeDrop]);

  // Cancel uploads still running if the user leaves the page.
  React.useEffect(() => {
    const map = controllers.current;
    return () => map.forEach((controller) => controller.abort());
  }, []);

  return { drops, addDrop, removeFile, removeDrop, clearAll };
}
