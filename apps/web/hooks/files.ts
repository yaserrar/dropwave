import { errorMessage } from "@/lib/utils";
import type { GenerateSchema } from "@/schemas/files";
import filesService from "@/services/files";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export const useGenerate = () => {
  return useMutation({
    mutationFn: (data: GenerateSchema) => filesService.generate(data),
    onSuccess: () => {
      toast.success("File generated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to generate file: ${errorMessage(error)}`);
    },
  });
};
