import { createConfig, createStorage, http, noopStorage } from 'wagmi';
import { injected, coinbaseWallet } from 'wagmi/connectors';
import { sepolia } from 'wagmi/chains';

export const config = createConfig({
  chains: [sepolia],
  storage: createStorage({ storage: noopStorage }),
  connectors: [
    injected({ target: 'metaMask' }),
    coinbaseWallet({ appName: 'PrivateLiquidity', jsonRpcUrl: sepolia.rpcUrls.default.http[0] }),
  ],
  ssr: false,
  transports: {
    [sepolia.id]: http(sepolia.rpcUrls.default.http[0]),
  },
});
