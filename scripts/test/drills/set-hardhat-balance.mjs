#!/usr/bin/env node
// Set the local Hardhat minter balance for the out-of-gas drill.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Wallet } from "ethers";

createRequire(import.meta.url)("dotenv").config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const privateKey = process.env.MINTER_PRIVATE_KEY;
if (!privateKey) throw new Error("MINTER_PRIVATE_KEY is required to derive the local account address");
const address = new Wallet(privateKey).address;
const balance = process.argv[2];
if (!balance || !/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(balance)) {
  throw new Error("usage: set-hardhat-balance.mjs <wei|hex>");
}
const balanceHex = balance.startsWith("0x") ? balance : `0x${BigInt(balance).toString(16)}`;
const response = await fetch(rpcUrl, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", method: "hardhat_setBalance", params: [address, balanceHex], id: 1 }),
  signal: AbortSignal.timeout(10_000)
});
const payload = await response.json();
if (!response.ok || payload.error || payload.result !== true) throw new Error("Hardhat rejected the balance change");
console.log(JSON.stringify({ account: address, balanceWei: BigInt(balanceHex).toString(), updated: true }));
