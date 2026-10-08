function publicVerifyUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export const kioskConfig = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3001",
  wsUrl: import.meta.env.VITE_WS_URL ?? import.meta.env.VITE_API_URL ?? "http://localhost:3001",
  verifyUrl: publicVerifyUrl(import.meta.env.VITE_VERIFY_URL),
  eventName: import.meta.env.VITE_EVENT_NAME ?? "TechFest 2026",
  idleTimeoutMs: 40_000
};
