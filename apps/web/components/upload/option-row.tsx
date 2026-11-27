import type * as React from "react";
import type { Icon } from "iconsax-react";
import { cn } from "@/lib/utils";

/**
 * One option of the upload panel: an icon, a title, what it does, and its control
 * on the right. `labelFor` turns the title into the control's label, so clicking
 * it toggles a switch. `children` go under the row (e.g. a field it reveals).
 */
export function OptionRow({
  icon: RowIcon,
  title,
  description,
  control,
  labelFor,
  active = false,
  children,
}: {
  icon: Icon;
  title: string;
  description: React.ReactNode;
  control: React.ReactNode;
  labelFor?: string;
  /** Highlights the icon while the option is on. */
  active?: boolean;
  children?: React.ReactNode;
}) {
  const Title = labelFor ? "label" : "p";

  return (
    <div className="py-2 pr-2 pl-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
              active ? "bg-brand text-brand-foreground" : "bg-brand-subtle text-brand-muted",
            )}
          >
            <RowIcon variant="Bulk" className="size-4" color="currentColor" />
          </div>
          <div className="min-w-0">
            <Title htmlFor={labelFor} className="block text-sm font-medium">
              {title}
            </Title>
            <p className="text-xs text-pretty text-muted-foreground">{description}</p>
          </div>
        </div>
        {control}
      </div>
      {children}
    </div>
  );
}
