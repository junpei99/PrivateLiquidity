import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import {
  ConfidentialETH,
  ConfidentialETH__factory,
  ConfidentialSwap,
  ConfidentialSwap__factory,
  ConfidentialZama,
  ConfidentialZama__factory,
} from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

const DECIMALS = 1_000_000;

async function decryptBalance(token: ConfidentialETH | ConfidentialZama, owner: HardhatEthersSigner) {
  const encrypted = await token.confidentialBalanceOf(owner.address);
  const address = await token.getAddress();
  return fhevm.userDecryptEuint(FhevmType.euint64, encrypted, address, owner);
}

async function deployFixture() {
  const cEth = (await (await ethers.getContractFactory("ConfidentialETH")).deploy()) as ConfidentialETH;
  const cZama = (await (await ethers.getContractFactory("ConfidentialZama")).deploy()) as ConfidentialZama;
  const swap = (await (await ethers.getContractFactory("ConfidentialSwap")).deploy(
    await cEth.getAddress(),
    await cZama.getAddress(),
  )) as ConfidentialSwap;

  return { cEth, cZama, swap };
}

describe("ConfidentialSwap", function () {
  let signers: Signers;
  let cEth: ConfidentialETH;
  let cZama: ConfidentialZama;
  let swap: ConfidentialSwap;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    ({ cEth, cZama, swap } = await deployFixture());

    const starterEth = 50 * DECIMALS;
    const starterZama = starterEth * 2000;

    await cEth.mint(signers.alice.address, starterEth);
    await cZama.mint(signers.alice.address, starterZama);

    await cEth.mint(signers.bob.address, starterEth);
    await cZama.mint(signers.bob.address, starterZama);
  });

  it("adds initial liquidity at the fixed price", async function () {
    const liquidityEth = 10 * DECIMALS;
    const liquidityZama = liquidityEth * 2000;
    const expiry = Math.floor(Date.now() / 1000) + 86_400;

    await cEth.connect(signers.alice).setOperator(await swap.getAddress(), expiry);
    await cZama.connect(signers.alice).setOperator(await swap.getAddress(), expiry);
    await swap.connect(signers.alice).addLiquidity(liquidityEth, liquidityZama);

    const reserves = await swap.getReserves();
    expect(reserves[0]).to.equal(liquidityEth);
    expect(reserves[1]).to.equal(liquidityZama);

    const encryptedBalance = await decryptBalance(cEth, signers.alice);
    expect(encryptedBalance).to.equal(40n * BigInt(DECIMALS));
  });

  it("swaps cETH for cZama and updates reserves", async function () {
    const expiry = Math.floor(Date.now() / 1000) + 86_400;
    const baseEth = 20 * DECIMALS;
    const baseZama = baseEth * 2000;

    await cEth.connect(signers.alice).setOperator(await swap.getAddress(), expiry);
    await cZama.connect(signers.alice).setOperator(await swap.getAddress(), expiry);
    await swap.connect(signers.alice).addLiquidity(baseEth, baseZama);

    await cEth.connect(signers.bob).setOperator(await swap.getAddress(), expiry);
    await cZama.connect(signers.bob).setOperator(await swap.getAddress(), expiry);

    const amountIn = 1 * DECIMALS;
    const amountInWithFee = amountIn * 997;
    const expectedOut = Math.floor(
      (amountInWithFee * baseZama) / (baseEth * 1000 + amountInWithFee),
    );

    await swap.connect(signers.bob).swapEthForZama(amountIn, 0);

    const bobZama = await decryptBalance(cZama, signers.bob);
    expect(bobZama).to.equal(BigInt(expectedOut + 50 * DECIMALS * 2000));

    const reserves = await swap.getReserves();
    expect(reserves[0]).to.equal(baseEth + amountIn);
    expect(reserves[1]).to.equal(baseZama - expectedOut);
  });

  it("removes liquidity and returns proportional tokens", async function () {
    const expiry = Math.floor(Date.now() / 1000) + 86_400;
    const addEth = 12 * DECIMALS;
    const addZama = addEth * 2000;

    await cEth.connect(signers.alice).setOperator(await swap.getAddress(), expiry);
    await cZama.connect(signers.alice).setOperator(await swap.getAddress(), expiry);
    await swap.connect(signers.alice).addLiquidity(addEth, addZama);
    const mintedLiquidity = await swap.liquidityOf(signers.alice.address);

    const halfLiquidity = mintedLiquidity / 2n;
    await swap.connect(signers.alice).removeLiquidity(
      halfLiquidity,
      1,
      1,
    );

    const reserves = await swap.getReserves();
    expect(reserves[0]).to.equal(addEth / 2);
    expect(reserves[1]).to.equal(addZama / 2);
  });
});
