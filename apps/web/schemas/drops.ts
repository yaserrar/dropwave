import { MAX_SHARE_RECIPIENTS } from "@/lib/consts";
import { z } from "zod";

export const shareSchema = z.object({
  emails: z
    .array(z.email())
    .min(1, "Enter at least one email address")
    .max(MAX_SHARE_RECIPIENTS, `Up to ${MAX_SHARE_RECIPIENTS} addresses at a time`),
});

export type ShareSchema = z.infer<typeof shareSchema>;
