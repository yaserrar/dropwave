"use client";

import * as React from "react";
import axios from "axios";
import { motion } from "motion/react";
import { Eye, EyeSlash, Lock, Unlock } from "iconsax-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUnlockDrop } from "@/hooks/drops";
import { PASSWORD_MAX_LENGTH } from "@/lib/consts";
import { errorMessage } from "@/lib/utils";
import type { LockedDrop } from "@/types/drop";
import { IconTile, LinkFacts, PrivacyFooter, ShareCardFrame, rise, stagger } from "./share-actions";

/** What went wrong, in words: a wrong password says how many tries are left. */
function unlockError(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.data?.reason === "wrong-password") {
    const left = Number(error.response.data.attemptsLeft);
    if (left === 0) return "Wrong password. That was the last try for now: wait a few minutes.";
    return `Wrong password. ${left} ${left === 1 ? "try" : "tries"} left.`;
  }
  return String(errorMessage(error));
}

/**
 * A password-protected link before the password: only that it's protected, and
 * when it expires. The API sets an httpOnly cookie on success, then the page
 * fetches the link again, this time open.
 */
export function UnlockCard({ drop }: { drop: LockedDrop }) {
  const [password, setPassword] = React.useState("");
  const [visible, setVisible] = React.useState(false);
  const { mutate: unlock, isPending, error, reset } = useUnlockDrop(drop.id);
  const inputId = React.useId();
  const hintId = `${inputId}-hint`;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || isPending) return;
    unlock(password, { onError: () => setPassword("") });
  };

  return (
    <ShareCardFrame>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative flex flex-col items-center px-6 pt-10 pb-6 text-center sm:px-10"
      >
        <motion.div variants={rise}>
          <IconTile icon={Lock} />
        </motion.div>
        <motion.span
          variants={rise}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-brand-subtle px-2.5 py-0.5 text-xs font-medium text-brand-muted"
        >
          Protected link
        </motion.span>
        <motion.h1
          variants={rise}
          className="mt-3 font-heading text-2xl leading-tight font-medium tracking-tight sm:text-[28px]"
        >
          Enter the password
        </motion.h1>
        <motion.p variants={rise} className="mt-2 max-w-sm text-sm leading-relaxed text-pretty text-muted-foreground">
          The sender protected this link. Ask them for the password if you don&apos;t have it.
        </motion.p>

        <LinkFacts expiresAt={drop.expiresAt} isProtected={false} burnAfterDownload={drop.burnAfterDownload} />

        <motion.form
          variants={rise}
          onSubmit={submit}
          noValidate
          className="mt-8 flex w-full flex-col gap-1.5 text-left"
        >
          <label htmlFor={inputId} className="sr-only">
            Password
          </label>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Input
                id={inputId}
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                spellCheck={false}
                placeholder="Password"
                maxLength={PASSWORD_MAX_LENGTH}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) reset();
                }}
                readOnly={isPending}
                aria-invalid={!!error}
                aria-describedby={hintId}
                className="h-11 pr-10 pl-3"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
              >
                {visible ? (
                  <EyeSlash variant="Bulk" className="size-4" color="currentColor" />
                ) : (
                  <Eye variant="Bulk" className="size-4" color="currentColor" />
                )}
              </Button>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={!password || isPending}
              className="h-11 min-w-24 rounded-lg bg-brand text-brand-foreground hover:bg-brand-hover"
            >
              <Unlock variant="Bulk" className="size-4" color="currentColor" />
              {isPending ? "Checking" : "Unlock"}
            </Button>
          </div>
          <p
            id={hintId}
            aria-live="polite"
            className={error ? "px-0.5 text-xs text-danger-muted" : "px-0.5 text-xs text-muted-foreground"}
          >
            {error ? unlockError(error) : "File names and previews appear once the link is unlocked."}
          </p>
        </motion.form>
      </motion.div>

      <PrivacyFooter>Stored privately · protected by a password</PrivacyFooter>
    </ShareCardFrame>
  );
}
