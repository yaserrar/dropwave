"use client";

import * as React from "react";
import { Send2 } from "iconsax-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShareFile } from "@/hooks/files";
import { MAX_SHARE_RECIPIENTS } from "@/lib/consts";
import { shareSchema } from "@/schemas/files";
import { cn } from "@/lib/utils";

/** "a@x.com, b@y.com c@z.com" → the unique addresses, or what's wrong with the list. */
function parseEmails(value: string): { emails: string[] } | { error: string } {
  const emails = [
    ...new Set(
      value
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map((email) => email.toLowerCase()),
    ),
  ];
  const result = shareSchema.safeParse({ emails });
  if (result.success) return result.data;

  const issue = result.error.issues[0]!;
  // An issue with one address has the path ["emails", index].
  const index = issue.path[1];
  return {
    error: typeof index === "number" ? `"${emails[index]}" isn't a valid email address` : issue.message,
  };
}

export function ShareByEmail({ fileId, onSent }: { fileId: string; onSent: () => void }) {
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const { mutate: share, isPending } = useShareFile();
  const inputId = React.useId();
  const hintId = `${inputId}-hint`;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseEmails(value);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }

    share(
      { fileId, emails: parsed.emails },
      {
        onSuccess: ({ sent, failed }) => {
          toast.success(sent === 1 ? "Email sent" : `Sent to ${sent} people`, {
            description: "They'll get a link to this file.",
          });
          if (failed.length > 0) {
            toast.warning(`Couldn't send to ${failed.join(", ")}`, {
              description: "Check the address and try again.",
            });
            // Leave the failed addresses in the field, ready to fix and resend.
            setValue(failed.join(", "));
            return;
          }
          onSent();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-1.5">
      <label htmlFor={inputId} className="sr-only">
        Email addresses
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          type="text"
          inputMode="email"
          autoComplete="off"
          autoFocus
          placeholder="name@example.com"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          readOnly={isPending}
          aria-invalid={!!error}
          aria-describedby={hintId}
        />
        <Button type="submit" disabled={isPending} className="min-w-22">
          <Send2 className="size-3.5" color="currentColor" />
          {isPending ? "Sending" : "Send"}
        </Button>
      </div>
      <p
        id={hintId}
        aria-live="polite"
        className={cn("px-0.5 text-xs", error ? "text-danger-muted" : "text-muted-foreground")}
      >
        {error ?? `Up to ${MAX_SHARE_RECIPIENTS} addresses, separated by commas. Each gets a link to this file.`}
      </p>
    </form>
  );
}
