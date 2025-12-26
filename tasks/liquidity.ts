import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:addresses", "Print deployed contract addresses").setAction(async function (_args: TaskArguments, hre) {
  const { deployments } = hre;

  const cEth = await deployments.get("ConfidentialETH");
  const cZama = await deployments.get("ConfidentialZama");
  const pool = await deployments.get("ConfidentialSwap");

  console.log(`ConfidentialETH: ${cEth.address}`);
  console.log(`ConfidentialZama: ${cZama.address}`);
  console.log(`ConfidentialSwap: ${pool.address}`);
});

task("task:reserves", "Show pool reserves")
  .addOptionalParam("pool", "Pool address override")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const poolInfo = taskArguments.pool ? { address: taskArguments.pool } : await deployments.get("ConfidentialSwap");
    const pool = await ethers.getContractAt("ConfidentialSwap", poolInfo.address);
    const reserves = await pool.getReserves();
    console.log(`Pool ${poolInfo.address}`);
    console.log(`cETH reserve : ${reserves[0].toString()}`);
    console.log(`cZama reserve: ${reserves[1].toString()}`);
  });

task("task:decrypt-balance", "Decrypt a confidential token balance")
  .addParam("token", "Token name: ceth or czama")
  .addOptionalParam("owner", "Owner address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const [signer] = await ethers.getSigners();
    const target = taskArguments.owner ?? signer.address;

    const isEth = taskArguments.token.toLowerCase() === "ceth";
    const tokenDeployment = isEth
      ? await deployments.get("ConfidentialETH")
      : await deployments.get("ConfidentialZama");

    const contractName = isEth ? "ConfidentialETH" : "ConfidentialZama";
    const token = await ethers.getContractAt(contractName, tokenDeployment.address);
    const encrypted = await token.confidentialBalanceOf(target);

    if (encrypted === ethers.ZeroHash) {
      console.log(`No balance registered for ${target}`);
      return;
    }

    const clear = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encrypted,
      tokenDeployment.address,
      signer,
    );

    console.log(`Balance for ${target}:`);
    console.log(` encrypted: ${encrypted}`);
    console.log(` clear    : ${clear.toString()}`);
  });
