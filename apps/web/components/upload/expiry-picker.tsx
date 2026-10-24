"use client";

import * as React from "react";
import { addDays, addHours, format, startOfDay } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown2, Clock, Timer1 } from "iconsax-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MAX_EXPIRY_MS, MIN_EXPIRY_MS } from "@/lib/consts";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "1 hour", at: () => addHours(new Date(), 1) },
  { label: "1 day", at: () => addDays(new Date(), 1) },
  { label: "7 days", at: () => addDays(new Date(), 7) },
  { label: "30 days", at: () => new Date(Date.now() + MAX_EXPIRY_MS - 60_000) },
];

/** Picked day + "HH:mm" in the browser's local time zone. */
function combine(day: Date, time: string): Date {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const date = new Date(day);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function validate(date: Date): string | null {
  const fromNow = date.getTime() - Date.now();
  if (fromNow < MIN_EXPIRY_MS) return "Pick a time at least 5 minutes from now";
  if (fromNow > MAX_EXPIRY_MS) return "Links can last at most 30 days";
  return null;
}

/** Tomorrow at the next full hour: a sensible starting point for the custom picker. */
function defaultDraft(): Date {
  const date = addDays(new Date(), 1);
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date;
}

/**
 * Optional expiry for the next uploads: "Never" by default, a quick preset, or an
 * exact day and time. The value is a Date in the user's local time; it reaches the
 * API as an ISO (UTC) string.
 */
export function ExpiryPicker({ value, onChange }: { value: Date | null; onChange: (value: Date | null) => void }) {
  const [open, setOpen] = React.useState(false);
  const [draftDay, setDraftDay] = React.useState<Date | undefined>();
  const [draftTime, setDraftTime] = React.useState("12:00");

  // Each time the popover opens, start from the current value (or a default).
  const onOpenChange = (next: boolean) => {
    if (next) {
      const start = value ?? defaultDraft();
      setDraftDay(startOfDay(start));
      setDraftTime(format(start, "HH:mm"));
    }
    setOpen(next);
  };

  const candidate = draftDay ? combine(draftDay, draftTime) : null;
  const error = candidate ? validate(candidate) : "Pick a day";

  const apply = (date: Date | null) => {
    onChange(date);
    setOpen(false);
  };

  const today = startOfDay(new Date());
  const lastDay = new Date(Date.now() + MAX_EXPIRY_MS);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card/60 py-2 pr-2 pl-3 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand-muted">
          <Timer1 variant="Bulk" className="size-4" color="currentColor" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">Link expiry</p>
          <p className="truncate text-xs text-muted-foreground">
            {value ? `Stops working ${formatRelativeTime(value)}` : "Links work until you delete them"}
          </p>
        </div>
      </div>

      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5 font-normal">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={value ? value.toISOString() : "never"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className={cn(value && "font-medium text-brand-muted")}
              >
                {value ? format(value, "MMM d, HH:mm") : "Never"}
              </motion.span>
            </AnimatePresence>
            <ArrowDown2 className="size-3.5 text-muted-foreground" color="currentColor" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-auto p-0">
          <div className="grid grid-cols-4 gap-1.5 border-b p-3">
            {PRESETS.map((preset) => (
              <Button key={preset.label} variant="secondary" size="xs" onClick={() => apply(preset.at())}>
                {preset.label}
              </Button>
            ))}
          </div>

          <Calendar
            mode="single"
            selected={draftDay}
            onSelect={setDraftDay}
            disabled={[{ before: today }, { after: lastDay }]}
            startMonth={today}
            endMonth={lastDay}
            defaultMonth={draftDay}
          />

          <div className="flex items-center gap-2 border-t px-3 py-2.5">
            <Clock className="size-4 text-muted-foreground" color="currentColor" />
            <Input
              type="time"
              step={60}
              value={draftTime}
              onChange={(e) => setDraftTime(e.target.value)}
              aria-label="Expiry time"
              className="h-8 w-28 font-mono"
            />
            <span className="truncate text-2xs text-muted-foreground" title={timeZone}>
              {timeZone}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 border-t p-3">
            <Button variant="ghost" size="sm" onClick={() => apply(null)}>
              Never expire
            </Button>
            <Button
              size="sm"
              disabled={!!error}
              onClick={() => candidate && apply(candidate)}
              className="bg-brand text-brand-foreground hover:bg-brand-hover"
            >
              Set expiry
            </Button>
          </div>
          {error && draftDay && (
            <p role="alert" className="-mt-1 px-3 pb-3 text-right text-xs text-danger-muted">
              {error}
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
