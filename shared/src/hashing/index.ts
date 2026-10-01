// hashing — SHA-256 of exact bytes. Must match across kiosk/backend/verify.
// Browser: crypto.subtle.digest. Node: node:crypto. Same hex output, no 0x.
export async function sha256Bytes(data: Uint8Array): Promise<string> {
  // WebCrypto path (browser + Node 20 globalThis.crypto)
  if (globalThis.crypto?.subtle) {
    // @ts-ignore Buffer vs ArrayBuffer view
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data as BufferSource);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Node fallback
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(data).digest("hex");
}

export function toBytes32(hexNo0x: string): `0x${string}` {
  return `0x${hexNo0x}` as `0x${string}`;
}
