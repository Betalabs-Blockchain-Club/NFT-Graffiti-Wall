export const kioskConfig = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3001",
  wsUrl: import.meta.env.VITE_WS_URL ?? import.meta.env.VITE_API_URL ?? "http://localhost:3001",
  verifyUrl: import.meta.env.VITE_VERIFY_URL ?? window.location.origin,
  eventName: import.meta.env.VITE_EVENT_NAME ?? "TechFest 2026",
  idleTimeoutMs: 40_000
};
