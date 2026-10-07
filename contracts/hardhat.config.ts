import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
    },
  },
  networks: {
    localhost: { url: "http://127.0.0.1:8545" },
    sepolia: {
      url: process.env.RPC_URL ?? "",
      accounts: process.env.MINTER_PRIVATE_KEY ? [process.env.MINTER_PRIVATE_KEY] : [],
    },
    "base-sepolia": {
      url: process.env.RPC_URL ?? "https://sepolia.base.org",
      accounts: process.env.MINTER_PRIVATE_KEY ? [process.env.MINTER_PRIVATE_KEY] : [],
    },
  },
};
export default config;
