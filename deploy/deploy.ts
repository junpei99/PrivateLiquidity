import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, log } = hre.deployments;
  const signer = await hre.ethers.getSigner(deployer);

  const cEth = await deploy("ConfidentialETH", {
    from: deployer,
    log: true,
  });

  const cZama = await deploy("ConfidentialZama", {
    from: deployer,
    log: true,
  });

  const swap = await deploy("ConfidentialSwap", {
    from: deployer,
    args: [cEth.address, cZama.address],
    log: true,
  });

  const cEthContract = await hre.ethers.getContractAt("ConfidentialETH", cEth.address, signer);
  const cZamaContract = await hre.ethers.getContractAt("ConfidentialZama", cZama.address, signer);
  const swapContract = await hre.ethers.getContractAt("ConfidentialSwap", swap.address, signer);

  if (hre.network.name !== "hardhat") {
    const starterEth = 10_000_000; // 10 cETH with 6 decimals
    const starterZama = starterEth * 2000;
    await cEthContract.mint(deployer, starterEth);
    await cZamaContract.mint(deployer, starterZama);

    const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    await cEthContract.setOperator(swap.address, expiry);
    await cZamaContract.setOperator(swap.address, expiry);
    await swapContract.addLiquidity(starterEth, starterZama);
  } else {
    log("Skipping seeding liquidity on hardhat network");
  }

  log(`ConfidentialETH deployed at ${cEth.address}`);
  log(`ConfidentialZama deployed at ${cZama.address}`);
  log(`ConfidentialSwap deployed at ${swap.address}`);
};
export default func;
func.id = "deploy_confidential_pool"; // id required to prevent reexecution
func.tags = ["ConfidentialSwap"];
