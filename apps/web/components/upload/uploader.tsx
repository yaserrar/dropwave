"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flash, Link21, ShieldTick, type Icon } from "iconsax-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDropUploads } from "@/hooks/use-drop-uploads";
import { MAX_DROP_SIZE, MAX_FILES_PER_DROP } from "@/lib/consts";
import { withUniquePaths, type PickedFile } from "@/lib/drop-files";
import { formatBytes } from "@/lib/format";
import type { DropOptions } from "@/types/drop";
import { DropRow } from "./drop-row";
import { Dropzone } from "./dropzone";
import { UploadOptions } from "./upload-options";

export function Uploader() {
  const { drops, addDrop, removeFile, removeDrop, clearAll } = useDropUploads();
  // Apply to files dropped after they're set; each drop keeps the options it was uploaded with.
  const [options, setOptions] = React.useState<DropOptions>({
    expiresAt: null,
    password: null,
    burnAfterDownload: false,
  });

  const onFiles = (files: PickedFile[], tooMany: boolean) => {
    if (tooMany || files.length > MAX_FILES_PER_DROP) {
      toast.error(`Up to ${MAX_FILES_PER_DROP} files per link`, {
        description: "Zip the folder, or send it in a few smaller drops.",
      });
      return;
    }
    if (files.length === 0) {
      toast.error("Nothing to upload", { description: "That folder is empty, or only holds hidden files." });
      return;
    }
    const total = files.reduce((sum, { file }) => sum + file.size, 0);
    if (total > MAX_DROP_SIZE) {
      toast.error(`Up to ${formatBytes(MAX_DROP_SIZE, 0)} per link`, {
        description: `These files add up to ${formatBytes(total)}. Send them in a few smaller drops.`,
      });
      return;
    }
    addDrop(withUniquePaths(files), options);
  };

  const ready = drops.filter((drop) => drop.status === "done").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Dropzone onFiles={onFiles} />
        <UploadOptions value={options} onChange={setOptions} />
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        {drops.length > 0 ? (
          <motion.section
            key="list"
            aria-label="Your links"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                <span className="font-medium text-foreground">{drops.length}</span>{" "}
                {drops.length === 1 ? "link" : "links"}
                {ready > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-success-muted">{ready} ready</span>
                  </>
                )}
              </p>
              <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={clearAll}>
                Clear all
              </Button>
            </div>
            <ul className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {drops.map((drop) => (
                  <DropRow
                    key={drop.id}
                    drop={drop}
                    onRemove={() => removeDrop(drop.id)}
                    onRemoveFile={(fileKey) => removeFile(drop.id, fileKey)}
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
              body="Files sit in a private bucket. Only your link opens them, with a password if you add one."
            />
            <Feature
              icon={Flash}
              title="Straight to storage"
              body="Uploads go directly to S3, so big files don't wait on a server."
            />
            <Feature
              icon={Link21}
              title="One link to send"
              body="A file, a few, or a whole folder: one link, ready the moment the upload finishes."
            />
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Feature({ icon: FeatureIcon, title, body }: { icon: Icon; title: string; body: string }) {
  return (
    <li className="group rounded-xl border bg-card/60 p-4 backdrop-blur transition-colors hover:border-border-strong">
      <div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-brand-subtle text-brand-muted transition-transform duration-300 group-hover:-translate-y-0.5">
        <FeatureIcon variant="Bulk" className="size-4.5" color="currentColor" />
      </div>
      <h3 className="text-sm">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-pretty text-muted-foreground">{body}</p>
    </li>
  );
}
