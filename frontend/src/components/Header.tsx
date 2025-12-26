import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
  return (
    <header className="page-header">
      <div className="brand">
        <div className="brand-mark">cΞ</div>
        <div>
          <div className="brand-name">Private Liquidity</div>
          <div className="brand-subtitle">cETH / cZama pool with encrypted balances</div>
        </div>
      </div>
      <ConnectButton />
    </header>
  );
}
