export function getBackendUrl(): string {
  const url = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error("BACKEND_URL or NEXT_PUBLIC_API_URL must be set");
  }
  return url;
}
