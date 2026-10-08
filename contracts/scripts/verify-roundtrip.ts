import { ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

/**
 * Mints one test artwork on the current --network and calls verify() twice:
 * once with the correct hash (expect true) and once with a tampered hash
 * (expect false). Proves deployments/<network>.json's {address, abi} are
 * usable by a plain ethers client, not just within this Hardhat project.
 *
 * Usage: npx hardhat run scripts/verify-roundtrip.ts --network <localhost|base-sepolia>
 */
async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found at ${deploymentPath} — run scripts/deploy.ts first.`);
  }
  const { address, abi } = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const [signer] = await ethers.getSigners();
  const contract = new ethers.Contract(address, abi, signer);

  const nickname = "RoundTripBot";
  const ipfsCID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
  const metadataURI = "ipfs://bafybeimetadata";
  const correctHash = ethers.keccak256(ethers.toUtf8Bytes("round-trip-test-bytes"));
  const tamperedHash = ethers.keccak256(ethers.toUtf8Bytes("tampered-bytes"));

  const tx = await contract.mint(signer.address, nickname, ipfsCID, correctHash, metadataURI);
  const receipt = await tx.wait();
  const event = receipt.logs
    .map((log: unknown) => {
      try {
        return contract.interface.parseLog(log as { topics: string[]; data: string });
      } catch {
        return null;
      }
    })
    .find((parsed: { name: string } | null) => parsed?.name === "ArtworkMinted");
  if (!event) throw new Error("ArtworkMinted event not found in mint receipt");
  const tokenId = event.args[0];

  console.log(`Minted tokenId ${tokenId} on ${network.name} at ${address} (tx ${tx.hash})`);
  console.log(`gasUsed: ${receipt.gasUsed}`);

  const okTrue = await contract.verify(tokenId, correctHash);
  const okFalse = await contract.verify(tokenId, tamperedHash);

  console.log(`verify(${tokenId}, correctHash)  -> ${okTrue}`);
  console.log(`verify(${tokenId}, tamperedHash) -> ${okFalse}`);

  if (okTrue !== true || okFalse !== false) {
    throw new Error("round-trip FAILED: verify() did not return the expected booleans");
  }
  console.log("✅ round-trip OK");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
