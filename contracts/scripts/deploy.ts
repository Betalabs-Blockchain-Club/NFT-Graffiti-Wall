import { ethers } from "hardhat";
import fs from "node:fs";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const F = await ethers.getContractFactory("GraffitiWall");
  const c = await F.deploy();
  await c.waitForDeployment();
  const address = await c.getAddress();
  const network = (await ethers.provider.getNetwork()).name;
  console.log(`GraffitiWall deployed to ${address} on ${network}`);
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(
    `deployments/${network}.json`,
    JSON.stringify({ address, block: await ethers.provider.getBlockNumber() }, null, 2)
  );
}
main().catch((e) => { console.error(e); process.exit(1); });
