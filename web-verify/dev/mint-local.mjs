import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { ContractFactory, JsonRpcProvider } from "ethers";
const here = dirname(fileURLToPath(import.meta.url)); const repoRoot = resolve(here, "../.."); const contractsDir = resolve(repoRoot, "contracts"); const configPath = resolve(here, "hardhat.local.config.cjs"); const hardhatCli = resolve(repoRoot, "node_modules/hardhat/internal/cli/cli.js"); const artifactPath = resolve(here, ".hardhat-artifacts/contracts/GraffitiWall.sol/GraffitiWall.json"); const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL0lQAAAABJRU5ErkJggg==", "base64");
// Start `npx hardhat node --config ../web-verify/dev/hardhat.local.config.cjs` in contracts/ first.
execFileSync(process.execPath, [hardhatCli, "compile", "--config", configPath], {
  cwd: contractsDir,
  stdio: "inherit",
});
const artifact = JSON.parse(readFileSync(artifactPath, "utf8")); const provider = new JsonRpcProvider("http://127.0.0.1:8545"); const signer = await provider.getSigner(0); const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer); const contract = await factory.deploy(); await contract.waitForDeployment();
const cid = "local-test.png"; const hash = `0x${createHash("sha256").update(png).digest("hex")}`; await (await contract.mint(await signer.getAddress(), "Local Tester", cid, hash, "ipfs://local-test-metadata")).wait();
const server = createServer((request, response) => { if (request.url === `/ipfs/${cid}`) { response.writeHead(200, { "content-type": "image/png", "access-control-allow-origin": "*" }); response.end(png); return; } response.writeHead(404); response.end(); });
server.listen(4177, "127.0.0.1", () => { console.log("Local verification fixture ready:"); console.log(`VITE_RPC_URL=http://127.0.0.1:8545 VITE_CONTRACT_ADDRESS=${contract.target} VITE_IPFS_GATEWAYS=http://127.0.0.1:4177/ipfs npm run dev`); console.log("Open http://localhost:5173/#/token/1 (keep this helper running to serve the test PNG)."); });
