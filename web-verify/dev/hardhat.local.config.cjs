const path = require("node:path");

const contractsRoot = path.resolve(__dirname, "../../contracts");

// Kept here so the verify fixture can run even when the contracts workspace has
// no tsconfig.json. It compiles the real contract source into a local dev cache.
module.exports = {
  solidity: { version: "0.8.26", settings: { evmVersion: "cancun" } },
  paths: {
    root: contractsRoot,
    sources: path.join(contractsRoot, "contracts"),
    tests: path.join(contractsRoot, "test"),
    cache: path.join(__dirname, ".hardhat-cache"),
    artifacts: path.join(__dirname, ".hardhat-artifacts"),
  },
};
