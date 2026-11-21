"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeSlash, Lock, Trash } from "iconsax-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/consts";
import type { DropOptions } from "@/types/drop";
import { ExpiryPicker } from "./expiry-picker";
import { OptionRow } from "./option-row";

/**
 * Link options for the next drops: expiry, password and "delete after the first
 * download". Like the expiry, they apply to files dropped after they're set; each
 * drop keeps the options it was uploaded with.
 */
export function UploadOptions({ value, onChange }: { value: DropOptions; onChange: (value: DropOptions) => void }) {
  const set = (patch: Partial<DropOptions>) => onChange({ ...value, ...patch });

  return (
    <div className="divide-y rounded-xl border bg-card/60 backdrop-blur">
      <ExpiryPicker value={value.expiresAt} onChange={(expiresAt) => set({ expiresAt })} />
      <PasswordOption value={value.password} onChange={(password) => set({ password })} />
      <BurnOption value={value.burnAfterDownload} onChange={(burnAfterDownload) => set({ burnAfterDownload })} />
    </div>
  );
}

function PasswordOption({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
  // The switch opens the field (null → ""); turning it off drops the password.
  const enabled = value !== null;
  const [visible, setVisible] = React.useState(false);
  const switchId = React.useId();
  const inputId = React.useId();
  const hintId = `${inputId}-hint`;
  const tooShort = !!value && value.length < PASSWORD_MIN_LENGTH;

  return (
    <OptionRow
      icon={Lock}
      title="Password"
      labelFor={switchId}
      active={enabled}
      description={enabled ? "Recipients enter it before they see anything" : "Anyone with the link can open it"}
      control={<Switch id={switchId} checked={enabled} onCheckedChange={(next) => onChange(next ? "" : null)} />}
    >
      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            key="password"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            // The padding, offset by the negative margin, leaves room for the input's focus ring.
            className="-mx-1 -mb-1 overflow-hidden px-1 pb-1"
          >
            <div className="flex flex-col gap-1.5 pt-2.5 sm:pl-9.5">
              <label htmlFor={inputId} className="sr-only">
                Link password
              </label>
              <div className="relative">
                <Input
                  id={inputId}
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  spellCheck={false}
                  placeholder="Choose a password"
                  maxLength={PASSWORD_MAX_LENGTH}
                  value={value ?? ""}
                  onChange={(event) => onChange(event.target.value)}
                  aria-invalid={tooShort}
                  aria-describedby={hintId}
                  className="pr-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                >
                  {visible ? (
                    <EyeSlash variant="Bulk" className="size-3.5" color="currentColor" />
                  ) : (
                    <Eye variant="Bulk" className="size-3.5" color="currentColor" />
                  )}
                </Button>
              </div>
              <p
                id={hintId}
                aria-live="polite"
                className={tooShort ? "text-xs text-danger-muted" : "text-xs text-muted-foreground"}
              >
                {tooShort
                  ? `At least ${PASSWORD_MIN_LENGTH} characters`
                  : "Send it to them separately: Dropwave never emails it, and can't show it again."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </OptionRow>
  );
}

function BurnOption({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const switchId = React.useId();

  return (
    <OptionRow
      icon={Trash}
      title="Delete after the first download"
      labelFor={switchId}
      active={value}
      description={
        value
          ? "Works for one download, then the files are deleted. No previews; several files download as one zip."
          : "The link works for as many downloads as needed"
      }
      control={<Switch id={switchId} checked={value} onCheckedChange={onChange} />}
    />
  );
}
