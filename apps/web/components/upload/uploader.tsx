"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flash, Link21, ShieldTick, type Icon } from "iconsax-react";
import { Button } from "@/components/ui/button";
import { MAX_FILE_SIZE } from "@/lib/consts";
import { formatBytes } from "@/lib/format";
import { Dropzone } from "./dropzone";
import { FileRow, type UploadItem } from "./file-row";
import { errorMessage } from "@/lib/utils";
import { useUploadFile } from "@/hooks/files";
import axios from "axios";

function createItem(file: File): UploadItem {
  const base = { id: crypto.randomUUID(), file, percent: 0, shareUrl: "" };

  if (file.size > MAX_FILE_SIZE) {
    return {
      ...base,
      status: "error",
      error: `Larger than ${formatBytes(MAX_FILE_SIZE, 0)}`,
    };
  }
  if (file.size === 0) {
    return { ...base, status: "error", error: "This file is empty" };
  }
  return { ...base, status: "uploading" };
}

export function Uploader() {
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const { mutateAsync: uploadFile } = useUploadFile();
  // One AbortController per upload in progress, so Remove / Clear all can cancel it.
  const controllers = React.useRef(new Map<string, AbortController>());

  const update = React.useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const startUpload = React.useCallback(
    (item: UploadItem) => {
      const controller = new AbortController();
      controllers.current.set(item.id, controller);

      uploadFile({
        file: item.file,
        signal: controller.signal,
        // Hold at 99% until confirm succeeds, so 100% means "really done".
        onProgress: (percent) =>
          update(item.id, { percent: Math.min(percent, 99) }),
      })
        .then(({ fileId }) =>
          update(item.id, {
            status: "done",
            percent: 100,
            shareUrl: `${window.location.origin}/s/${fileId}`,
          }),
        )
        .catch((error) => {
          if (axios.isCancel(error)) return; // removed by the user, not a failure
          update(item.id, {
            status: "error",
            error: String(errorMessage(error)),
          });
        })
        .finally(() => controllers.current.delete(item.id));
    },
    [uploadFile, update],
  );

  const addFiles = React.useCallback(
    (files: File[]) => {
      const newItems = files.map(createItem).reverse();
      setItems((prev) => [...newItems, ...prev]);
      newItems.filter((i) => i.status === "uploading").forEach(startUpload);
    },
    [startUpload],
  );

  const remove = (id: string) => {
    controllers.current.get(id)?.abort();
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearAll = () => {
    controllers.current.forEach((c) => c.abort());
    setItems([]);
  };

  // Cancel uploads still running if the user leaves the page.
  React.useEffect(() => {
    const map = controllers.current;
    return () => map.forEach((c) => c.abort());
  }, []);

  const ready = items.filter((i) => i.status === "done").length;

  return (
    <div className="flex flex-col gap-6">
      <Dropzone onFiles={addFiles} />

      <AnimatePresence mode="popLayout" initial={false}>
        {items.length > 0 ? (
          <motion.section
            key="list"
            aria-label="Your files"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                <span className="font-medium text-foreground">
                  {items.length}
                </span>{" "}
                {items.length === 1 ? "file" : "files"}
                {ready > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-success-muted">
                      {ready} ready
                    </span>
                  </>
                )}
              </p>
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                onClick={clearAll}
              >
                Clear all
              </Button>
            </div>
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <FileRow
                    key={item.id}
                    item={item}
                    onRemove={() => remove(item.id)}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>
        ) : (
          <motion.ul
            key="features"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid gap-3 sm:grid-cols-3"
          >
            <Feature
              icon={ShieldTick}
              title="Private by default"
              body="Files sit in a private bucket. Only your link opens them."
            />
            <Feature
              icon={Flash}
              title="Straight to storage"
              body="Uploads go directly to S3, so big files don't wait on a server."
            />
            <Feature
              icon={Link21}
              title="One link to send"
              body="Copy it the moment your upload finishes. No account needed."
            />
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Feature({
  icon: FeatureIcon,
  title,
  body,
}: {
  icon: Icon;
  title: string;
  body: string;
}) {
  return (
    <li className="group rounded-xl border bg-card/60 p-4 backdrop-blur transition-colors hover:border-border-strong">
      <div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-brand-subtle text-brand-muted transition-transform duration-300 group-hover:-translate-y-0.5">
        <FeatureIcon variant="Bulk" className="size-4.5" color="currentColor" />
      </div>
      <h3 className="text-sm">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-pretty text-muted-foreground">
        {body}
      </p>
    </li>
  );
}
