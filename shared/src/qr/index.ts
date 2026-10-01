export function buildVerifyUrl(base: string, tokenId: number | string): string {
  return `${base.replace(/\/$/, "")}/#/token/${tokenId}`;
}

export function parseTokenId(urlOrHash: string): number | null {
  const m = urlOrHash.match(/token\/(\d+)/);
  return m ? Number(m[1]) : null;
}
