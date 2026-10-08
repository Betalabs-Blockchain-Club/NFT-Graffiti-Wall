import { Wallet } from "ethers";

/**
 * Generates a minter wallet + a spare, offline. Prints both so they can be
 * copied into a password manager and a local .env (never committed).
 *
 * Usage: npx hardhat run scripts/create-wallets.ts
 */
function main() {
  const minter = Wallet.createRandom();
  const spare = Wallet.createRandom();

  console.log("Generated two wallets. Store the private keys in a password manager now — this is the only time they're printed.\n");

  console.log("MINTER (set as MINTER_PRIVATE_KEY, used by the backend to deploy + call mint()):");
  console.log(`  address:     ${minter.address}`);
  console.log(`  private key: ${minter.privateKey}\n`);

  console.log("SPARE (backup minter key, same role, kept cold — fund it too):");
  console.log(`  address:     ${spare.address}`);
  console.log(`  private key: ${spare.privateKey}\n`);

  console.log("Next steps:");
  console.log("  1. Fund the deployer/minter address with POL from a Polygon Amoy faucet.");
  console.log("  2. Put MINTER_PRIVATE_KEY in the local .env (gitignored) — never commit it.");
  console.log("  3. Deploying with the minter key as the deployer account auto-grants it MINTER_ROLE (see GraffitiWall constructor).");
}

main();
