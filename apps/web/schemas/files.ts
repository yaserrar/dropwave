import { MAX_FILE_SIZE } from "@/lib/constants";
import { z } from "zod";

export const generateSchema = z.object({
  filename: z.string().max(255),
  contentType: z.string(),
  size: z.number().min(1).max(MAX_FILE_SIZE),
});

export type GenerateSchema = z.infer<typeof generateSchema>;
