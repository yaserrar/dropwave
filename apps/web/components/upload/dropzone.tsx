"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { DocumentUpload, Folder2 } from "iconsax-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { MAX_DROP_SIZE, MAX_FILE_SIZE, MAX_FILES_PER_DROP } from "@/lib/consts";
import {
  filesFromInput,
  readDataTransfer,
  walkEntries,
  type PickedFile,
} from "@/lib/drop-files";
import { cn } from "@/lib/utils";

const hasFiles = (e: DragEvent) =>
  e.dataTransfer?.types.includes("Files") ?? false;

/**
 * Drop target for the whole page: files and folders dropped (or pasted)
 * anywhere are accepted, and the zone lights up as soon as a file is dragged
 * into the window. Clicking or pressing Enter/Space opens the file picker; a
 * second button picks a whole folder.
 *
 * Everything dropped or picked at once goes to `onFiles` together, to share one
 * link. `tooMany` is set when a dropped folder held more than MAX_FILES_PER_DROP
 * files: the walk stops there instead of reading the rest.
 */
export function Dropzone({
  onFiles,
}: {
  onFiles: (files: PickedFile[], tooMany: boolean) => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const [burst, setBurst] = React.useState(0);
  const zoneRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const hintId = React.useId();

  // Window listeners are attached once; read the latest callback through a ref.
  const onFilesRef = React.useRef(onFiles);
  React.useEffect(() => {
    onFilesRef.current = onFiles;
  }, [onFiles]);

  // Empty results go through too: an empty folder deserves a word, not silence.
  const accept = React.useCallback((files: PickedFile[], tooMany = false) => {
    if (files.length) setBurst((n) => n + 1);
    onFilesRef.current(files, tooMany);
  }, []);

  React.useEffect(() => {
    // dragenter/dragleave fire for every child element, so count depth.
    let depth = 0;
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    // Without preventDefault the browser opens the file instead of dropping it.
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (!e.dataTransfer) return;
      // Read now: the browser empties the DataTransfer once this handler returns.
      const { entries, files } = readDataTransfer(e.dataTransfer);
      if (entries.length === 0) {
        accept(files.map((file) => ({ file, path: file.name })));
        return;
      }
      walkEntries(entries, MAX_FILES_PER_DROP).then(
        ({ files: walked, tooMany }) => accept(walked, tooMany),
        // A folder the browser won't let us read: fall back to the loose files.
        () => accept(files.map((file) => ({ file, path: file.name }))),
      );
    };
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length)
        accept(files.map((file) => ({ file, path: file.name })));
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [accept]);

  // Spotlight follows the pointer via CSS variables (no re-render per move).
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const zone = zoneRef.current;
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    zone.style.setProperty("--x", `${e.clientX - rect.left}px`);
    zone.style.setProperty("--y", `${e.clientY - rect.top}px`);
  };

  return (
    <div className="frame-double">
      <motion.div
        ref={zoneRef}
        onPointerMove={onPointerMove}
        animate={{ scale: dragging ? 1.015 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className={cn(
          "group relative isolate overflow-hidden rounded-[13px] border bg-card transition-[border-color,box-shadow] duration-300",
          "hover:border-brand-border has-focus-visible:border-brand has-focus-visible:ring-3 has-focus-visible:ring-ring/40",
          dragging && "border-gradient-animated shadow-lg",
        )}
      >
        <div
          aria-hidden
          className="bg-dot-grid mask-radial pointer-events-none absolute inset-0 opacity-70"
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
            dragging && "opacity-100",
          )}
          style={{
            background:
              "radial-gradient(420px circle at var(--x, 50%) var(--y, 40%), color-mix(in oklch, var(--brand) 16%, transparent), transparent 65%)",
          }}
        />
        <AnimatePresence>
          {dragging && (
            <motion.div
              aria-hidden
              key="wash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 bg-brand-subtle/40"
            />
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-describedby={hintId}
          className="relative z-10 flex w-full flex-col items-center gap-5 px-6 pt-14 pb-4 text-center outline-none sm:pt-20 sm:pb-5"
        >
          <IconTile dragging={dragging} burst={burst} />

          <div className="flex min-h-12 flex-col items-center gap-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={dragging ? "drag" : "idle"}
                initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                transition={{ duration: 0.18 }}
                className="flex flex-col items-center gap-1"
              >
                {dragging ? (
                  <>
                    <span className="font-heading text-lg font-medium tracking-tight text-brand-muted">
                      Release to drop your files
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Anywhere on the page works
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-heading text-lg font-medium tracking-tight text-foreground">
                      Drop files here
                    </span>
                    <span className="text-sm text-muted-foreground">
                      or{" "}
                      <span className="font-medium text-foreground underline decoration-brand-border underline-offset-4 transition-colors group-hover:decoration-brand-muted">
                        browse your computer
                      </span>
                    </span>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <p
            id={hintId}
            className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
          >
            <span>Up to {MAX_FILES_PER_DROP} files per link</span>
            <span
              aria-hidden
              className="size-1 rounded-full bg-border-strong"
            />
            <span>
              {formatBytes(MAX_FILE_SIZE, 0)} each,{" "}
              {formatBytes(MAX_DROP_SIZE, 0)} in all
            </span>
            <span
              aria-hidden
              className="size-1 rounded-full bg-border-strong max-sm:hidden"
            />
            <span className="max-sm:hidden">
              Paste with{" "}
              <kbd className="rounded-sm border bg-muted px-1 py-px font-mono text-2xs text-foreground">
                ⌘V
              </kbd>
            </span>
          </p>
        </button>

        <div className="relative z-10 flex justify-center px-6 pb-12 sm:pb-16">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => folderInputRef.current?.click()}
          >
            <Folder2 variant="Bulk" className="size-3.5" color="currentColor" />
            Choose a folder
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) accept(filesFromInput(e.target.files));
            e.target.value = "";
          }}
        />
        <input
          // webkitdirectory isn't in React's types; set it on the element.
          ref={(input) => {
            folderInputRef.current = input;
            input?.setAttribute("webkitdirectory", "");
          }}
          type="file"
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) accept(filesFromInput(e.target.files));
            e.target.value = "";
          }}
        />
      </motion.div>
    </div>
  );
}

/** Upload icon that floats at rest, lifts while dragging, and sends out waves. */
function IconTile({ dragging, burst }: { dragging: boolean; burst: number }) {
  return (
    <div className="relative">
      {/* Continuous waves while a file is over the page. */}
      <AnimatePresence>
        {dragging &&
          [0, 1, 2].map((i) => (
            <motion.span
              key={`wave-${i}`}
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl border border-brand/50 bg-brand/5"
              initial={{ scale: 1, opacity: 0 }}
              animate={{ scale: [1, 3.2], opacity: [0.7, 0] }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                delay: i * 0.8,
                ease: "easeOut",
              }}
            />
          ))}
      </AnimatePresence>

      {/* One splash per drop. */}
      <AnimatePresence>
        {burst > 0 && (
          <motion.span
            key={`burst-${burst}`}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-brand/30"
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={
          dragging
            ? { y: -10, scale: 1.1, rotate: -6 }
            : { y: [0, -5, 0], scale: 1, rotate: 0 }
        }
        transition={
          dragging
            ? { type: "spring", stiffness: 320, damping: 18 }
            : {
                y: { duration: 3.2, repeat: Infinity, ease: "easeInOut" },
                scale: { duration: 0.3 },
                rotate: { duration: 0.3 },
              }
        }
        className={cn(
          "relative flex size-16 items-center justify-center rounded-2xl border bg-card shadow-md transition-colors duration-300",
          dragging
            ? "border-brand-border text-brand-muted"
            : "text-muted-foreground group-hover:text-brand-muted",
        )}
      >
        <DocumentUpload
          variant="Bulk"
          className="size-8"
          color="currentColor"
        />
      </motion.div>
    </div>
  );
}
