const fs = require("fs");
const path = require("path");

function readDeployment(network, name) {
  const filePath = path.join(__dirname, "..", "deployments", network, `${name}.json`);
  const raw = fs.readFileSync(filePath, "utf8");
  const json = JSON.parse(raw);
  if (!json.address || !json.abi) {
    throw new Error(`Invalid deployment file: ${filePath}`);
  }
  return { address: json.address, abi: json.abi };
}

function toTsLiteral(value) {
  return JSON.stringify(value, null, 2);
}

function main() {
  const network = process.argv[2] || "sepolia";

  const cEth = readDeployment(network, "ConfidentialETH");
  const cZama = readDeployment(network, "ConfidentialZama");
  const pool = readDeployment(network, "ConfidentialSwap");

  const outPath = path.join(__dirname, "..", "frontend", "src", "config", "contracts.ts");

  const contents = `export const TOKEN_DECIMALS = 6;

export const CONTRACT_ADDRESSES = {
  cEth: ${toTsLiteral(cEth.address)} as \`0x\${string}\`,
  cZama: ${toTsLiteral(cZama.address)} as \`0x\${string}\`,
  pool: ${toTsLiteral(pool.address)} as \`0x\${string}\`,
} as const;

export const CETH_ABI = ${toTsLiteral(cEth.abi)} as const;
export const CZAMA_ABI = ${toTsLiteral(cZama.abi)} as const;
export const POOL_ABI = ${toTsLiteral(pool.abi)} as const;
`;

  fs.writeFileSync(outPath, contents, "utf8");
  console.log(`Synced frontend contracts config: ${outPath}`);
  console.log(`- Network: ${network}`);
  console.log(`- cETH    : ${cEth.address}`);
  console.log(`- cZama   : ${cZama.address}`);
  console.log(`- Pool    : ${pool.address}`);
}

main();

