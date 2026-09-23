export function getWsBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_WS_URL;
  if (!configured) {
    throw new Error("NEXT_PUBLIC_WS_URL must be set");
  }
  return configured;
}
