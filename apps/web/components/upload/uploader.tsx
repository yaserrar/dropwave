"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flash, Link21, ShieldTick, type Icon } from "iconsax-react";
import { Button } from "@/components/ui/button";
import { MAX_FILE_SIZE } from "@/lib/consts";
import { formatBytes } from "@/lib/format";
import { Dropzone } from "./dropzone";
import { FileRow, type UploadItem } from "./file-row";

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
  const uploading = items.some((i) => i.status === "uploading");

  React.useEffect(() => {
    if (!uploading) return;
    const timer = setInterval(
      () => setItems((prev) => prev.map(tick)),
      TICK_MS,
    );
    return () => clearInterval(timer);
  }, [uploading]);

  const addFiles = React.useCallback((files: File[]) => {
    // Newest first, so fresh drops appear right under the zone.
    setItems((prev) => [...files.map(createItem).reverse(), ...prev]);
  }, []);

  const remove = (id: string) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

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
                onClick={() => setItems([])}
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
