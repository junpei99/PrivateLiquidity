import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
import "solidity-coverage";

import "./tasks/accounts";
import "./tasks/liquidity";

// Run 'npx hardhat vars setup' to see the list of variables that need to be set

dotenv.config();

const INFURA_API_KEY: string = process.env.INFURA_API_KEY || "";
const PRIVATE_KEY: string = process.env.PRIVATE_KEY || "";
const privateKey = PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
const rpcAccounts = PRIVATE_KEY ? [privateKey] : undefined;
const hardhatAccounts = PRIVATE_KEY
  ? [
      {
        privateKey,
        balance: "10000000000000000000000",
      },
    ]
  : undefined;

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: {
      sepolia: vars.get("ETHERSCAN_API_KEY", ""),
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
  },
  networks: {
    hardhat: {
      accounts: hardhatAccounts,
      chainId: 31337,
    },
    anvil: {
      accounts: rpcAccounts,
      chainId: 31337,
      url: "http://localhost:8545",
    },
    sepolia: {
      accounts: rpcAccounts,
      chainId: 11155111,
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.27",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
