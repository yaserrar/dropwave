import type { GenerateSchema } from "@/schemas/files";
import axios from "@/lib/axios";

const filesService = {
  generate: async (data: GenerateSchema) => {
    return (await axios.post("/files/generate", data)).data as {
      fileId: string;
      uploadUrl: string;
    };
  },
  confirm: async (id: string) => {
    return (await axios.post(`/files/${id}/confirm`)).data as {
      fileId: string;
    };
  },
};

export default filesService;
