export { cn } from "cn";

export const errorMessage = (error: any) => {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error?.message) {
    return error.message;
  }

  return "An unknown error occurred";
};
