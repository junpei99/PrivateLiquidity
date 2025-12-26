# PrivateLiquidity

PrivateLiquidity is a privacy-preserving automated market maker that implements a Uniswap v2-style pool for cETH and
cZama using Zama FHEVM. It supports adding liquidity, removing liquidity, and swapping between cETH and cZama while
keeping balances encrypted on-chain. The initial pool price is fixed at 1 cETH = 2000 cZama to provide a clear starting
reference for liquidity providers and traders.

## Project Goals

- Build a swap contract that follows the Uniswap v2 model.
- Create a cETH/cZama pool with a deterministic initial price of 1 cETH = 2000 cZama.
- Enable encrypted swaps between cETH and cZama with FHEVM.
- Provide a frontend that shows encrypted balances and reveals plaintext only after explicit user decryption.

## Advantages

- Privacy by design: balances and sensitive amounts remain encrypted on-chain.
- Transparent pricing model: deterministic initial ratio prevents ambiguous bootstrap pricing.
- Full-stack delivery: contracts, tasks, tests, deployment scripts, and UI are integrated.
- Clear read/write separation in the UI: viem is used for reads and ethers for writes.
- No mock data: all values displayed in the UI are fetched from live contract state.

## Problems Solved

- Prevents public exposure of user balances in liquidity pools.
- Enables real swaps and liquidity operations while preserving confidentiality.
- Removes ambiguity in initial pool price bootstrapping.
- Provides a user-facing decryption flow to safely reveal real balances on demand.

## Tech Stack

- Smart contracts: Solidity + Zama FHEVM libraries
- Contract framework: Hardhat + hardhat-deploy
- Tests and tasks: TypeScript
- Frontend: React + Vite
- Wallet/UI: RainbowKit
- On-chain reads: viem
- Transaction writes: ethers
- Package manager: npm

## Architecture and Directory Layout

- `contracts/`: core swap, pair, and token contracts.
- `deploy/`: deployment scripts for local and Sepolia networks.
- `tasks/`: operational tasks used for scripting and admin workflows.
- `test/`: unit and integration tests for contracts and flows.
- `frontend/`: React application (no Tailwind, no local storage, no environment variables).
- `deployments/sepolia/`: generated ABIs and addresses used by the frontend.

## Smart Contract Design

- **Pool initialization**: sets the initial ratio of 1 cETH = 2000 cZama.
- **Liquidity**: supports adding and removing liquidity with standard AMM math.
- **Swaps**: follows constant product logic adapted to FHEVM encryption.
- **Privacy**: balances and amounts are stored and processed as encrypted types.
- **View functions**: avoid implicit sender usage and require explicit address input.

## Frontend Features

- Connect wallet and display encrypted balances for cETH and cZama.
- One-click decryption flow to reveal plaintext balances.
- Add and remove liquidity with live on-chain data.
- Swap between cETH and cZama using live pool reserves.
- ABI usage is sourced from `deployments/sepolia/` to match deployed contracts.

## Configuration

This project expects a `.env` file at the repository root for deployment scripts. It must include:

- `PRIVATE_KEY`: private key for deployment (single key, not a seed phrase).
- `INFURA_API_KEY`: RPC access for Sepolia.
- Optional: `ETHERSCAN_API_KEY` for verification.

Deployment scripts load these values via `dotenv`:

```ts
import * as dotenv from "dotenv";
dotenv.config();
```

The frontend does not use environment variables; configuration is embedded in code.

## Setup and Installation

```bash
npm install
```

## Compile

```bash
npm run compile
```

## Test

```bash
npm run test
```

For Sepolia tests:

```bash
npm run test:sepolia
```

## Local Development Chain (Contracts Only)

```bash
npm run chain
npm run deploy:localhost
```

## Deploy to Sepolia

```bash
npm run deploy:sepolia
```

## Verify on Sepolia

```bash
npm run verify:sepolia -- <CONTRACT_ADDRESS>
```

## Frontend Usage

1. Start the frontend development server.
2. Connect a wallet that has access to Sepolia.
3. View encrypted balances for cETH and cZama.
4. Click decrypt to reveal plaintext balances.
5. Add liquidity or swap based on live pool data.

## Available Scripts (Root)

- `npm run compile`: compile contracts
- `npm run test`: run tests on the default network
- `npm run test:sepolia`: run tests against Sepolia
- `npm run chain`: start a local Hardhat chain
- `npm run deploy:localhost`: deploy contracts to local chain
- `npm run deploy:sepolia`: deploy contracts to Sepolia
- `npm run verify:sepolia`: verify contracts on Etherscan
- `npm run lint`: lint Solidity and TypeScript
- `npm run coverage`: contract coverage report

## ABI Management

- Contract ABIs used by the frontend must be copied from `deployments/sepolia/`.
- Do not use placeholder ABIs or mock interfaces.
- Update the frontend ABIs every time contracts are redeployed.

## Security and Privacy Notes

- All sensitive balances remain encrypted; plaintext is revealed only by explicit user action.
- Avoid reusing decrypted values in local storage or external analytics.
- Treat the private key in `.env` as production-grade secret material.

## Roadmap

- Add advanced routing for multi-hop swaps.
- Improve liquidity analytics with historical volume and fee breakdowns.
- Expand pool support beyond cETH/cZama while preserving privacy guarantees.
- Add better UX around decryption status and permission flows.

## License

BSD-3-Clause-Clear. See `LICENSE` for details.
