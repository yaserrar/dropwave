import type { GenerateSchema } from "@/schemas/files";
import axios from "@/lib/axios";

const filesService = {
  generate: async (data: GenerateSchema) => {
    return axios.post("/files/generate", data);
  },
};

export default filesService;
