import axios from "axios";
import { toast } from "sonner";

export function toastSuccess(message: string, description?: string) {
  toast.success(message, { description });
}

export function toastError(message: string, description?: string) {
  toast.error(message, { description });
}

export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data;
    if (detail && typeof detail === "object" && "detail" in detail) {
      const d = (detail as { detail: unknown }).detail;
      if (typeof d === "string") return d;
      if (Array.isArray(d)) return d.map(String).join(", ");
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function toastApiError(err: unknown, fallback = "Something went wrong") {
  toast.error(fallback, { description: apiErrorMessage(err, fallback) });
}
