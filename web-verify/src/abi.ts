/** Minimal read-only ABI for the deployed GraffitiWall contract. */
export const graffitiWallAbi = [
  { type: "function", name: "artworks", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [
    { name: "creator", type: "address" }, { name: "nickname", type: "string" }, { name: "ipfsCID", type: "string" },
    { name: "artworkHash", type: "bytes32" }, { name: "timestamp", type: "uint64" },
  ] },
  { type: "function", name: "verify", stateMutability: "view", inputs: [
    { name: "id", type: "uint256" }, { name: "candidateHash", type: "bytes32" },
  ], outputs: [{ name: "", type: "bool" }] },
] as const;
