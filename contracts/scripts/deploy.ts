import { artifacts, ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const F = await ethers.getContractFactory("GraffitiWall");
  const c = await F.deploy();
  await c.waitForDeployment();
  const address = await c.getAddress();
  const networkName = network.name;
  const block = await ethers.provider.getBlockNumber();
  console.log(`GraffitiWall deployed to ${address} on ${networkName}`);

  const { abi } = await artifacts.readArtifact("GraffitiWall");

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentsDir, `${networkName}.json`),
    JSON.stringify({ address, block, abi }, null, 2)
  );

  const abiDir = path.join(__dirname, "..", "abi");
  fs.mkdirSync(abiDir, { recursive: true });
  fs.writeFileSync(path.join(abiDir, "GraffitiWall.json"), JSON.stringify(abi, null, 2));

  console.log(`Wrote deployments/${networkName}.json + abi/GraffitiWall.json`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
