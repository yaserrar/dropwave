"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const pad = (n: number) => String(n).padStart(2, "0");

function parse(value: string): [number, number] {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return [hours, minutes];
}

/** One scrollable column of numbers; scrolls the selected one into the middle when shown. */
function Column({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: number[];
  selected: number;
  onSelect: (value: number) => void;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>("[aria-selected=true]");
    if (list && item) list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2;
    // Only on mount: don't jump around while the user is scrolling and clicking.
  }, []);

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={label}
      className="relative flex h-48 w-12 flex-col gap-0.5 overflow-y-auto overscroll-contain [scrollbar-width:none]"
    >
      {items.map((item) => {
        const isSelected = item === selected;
        return (
          <button
            key={item}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(item)}
            className={cn(
              "shrink-0 rounded-md py-1 font-mono text-sm tabular-nums transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
              isSelected && "bg-brand text-brand-foreground hover:bg-brand-hover",
            )}
          >
            {pad(item)}
          </button>
        );
      })}
    </div>
  );
}

/** Styled replacement for `<input type="time">`. Value is "HH:mm" (24h). */
export function TimePicker({
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const [hours, minutes] = parse(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={ariaLabel ? `${ariaLabel}: ${pad(hours)}:${pad(minutes)}` : undefined}
          className={cn("font-mono font-normal tabular-nums", className)}
        >
          {pad(hours)}:{pad(minutes)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto flex-row gap-1 p-1.5">
        <Column label="Hours" items={HOURS} selected={hours} onSelect={(h) => onChange(`${pad(h)}:${pad(minutes)}`)} />
        <div className="w-px bg-border" />
        <Column
          label="Minutes"
          items={MINUTES}
          selected={minutes}
          onSelect={(m) => onChange(`${pad(hours)}:${pad(m)}`)}
        />
      </PopoverContent>
    </Popover>
  );
}
