import { useEffect, useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, CETH_ABI, CZAMA_ABI, POOL_ABI, TOKEN_DECIMALS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { Header } from './Header';

type BalanceHandles = {
  cEth?: string;
  cZama?: string;
};

type DecryptedBalances = {
  cEth?: string;
  cZama?: string;
};

const UNIT = BigInt(10 ** TOKEN_DECIMALS);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

function toBaseUnits(input: string): bigint {
  if (!input) return 0n;
  const [wholeRaw, fractionRaw = ''] = input.replace(/,/g, '').split('.');
  const safeWhole = wholeRaw === '' ? '0' : wholeRaw;
  if (!/^\d+$/.test(safeWhole) || (fractionRaw && !/^\d+$/.test(fractionRaw))) {
    return 0n;
  }
  const fractionPadded = (fractionRaw + '0'.repeat(TOKEN_DECIMALS)).slice(0, TOKEN_DECIMALS);
  return BigInt(safeWhole) * UNIT + BigInt(fractionPadded || '0');
}

function formatAmount(value?: bigint) {
  if (value === undefined) return '0';
  const whole = value / UNIT;
  const fraction = value % UNIT;
  const fractionStr = fraction.toString().padStart(TOKEN_DECIMALS, '0').replace(/0+$/, '');
  return fractionStr.length ? `${whole}.${fractionStr}` : whole.toString();
}

function calculateAmountOut(amountIn: bigint, reserveIn?: bigint, reserveOut?: bigint) {
  if (!reserveIn || !reserveOut || reserveIn === 0n || reserveOut === 0n) {
    return 0n;
  }
  const amountWithFee = amountIn * 997n;
  const numerator = amountWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountWithFee;
  return denominator === 0n ? 0n : numerator / denominator;
}

export function PoolApp() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading } = useZamaInstance();
  const [balances, setBalances] = useState<BalanceHandles>({});
  const [decrypted, setDecrypted] = useState<DecryptedBalances>({});
  const [pending, setPending] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ eth: '0', zama: '0' });
  const [swapEth, setSwapEth] = useState('0');
  const [swapZama, setSwapZama] = useState('0');
  const [liquidityToBurn, setLiquidityToBurn] = useState('0');
  const [message, setMessage] = useState<string | null>(null);

  const isConfigured =
    CONTRACT_ADDRESSES.cEth !== ZERO_ADDRESS &&
    CONTRACT_ADDRESSES.cZama !== ZERO_ADDRESS &&
    CONTRACT_ADDRESSES.pool !== ZERO_ADDRESS;

  const { data: rawReserves } = useReadContract({
    address: CONTRACT_ADDRESSES.pool,
    abi: POOL_ABI,
    functionName: 'getReserves',
    query: { enabled: isConfigured },
  });

  const reserves = useMemo(() => {
    if (!rawReserves) return { cEth: 0n, cZama: 0n };
    const [eth, zama] = rawReserves as readonly bigint[];
    return { cEth: BigInt(eth), cZama: BigInt(zama) };
  }, [rawReserves]);

  const { data: totalLiquidity } = useReadContract({
    address: CONTRACT_ADDRESSES.pool,
    abi: POOL_ABI,
    functionName: 'totalLiquidity',
    query: { enabled: isConfigured },
  });

  const { data: myLiquidity } = useReadContract({
    address: CONTRACT_ADDRESSES.pool,
    abi: POOL_ABI,
    functionName: 'liquidityOf',
    args: address ? [address] : undefined,
    query: { enabled: isConfigured && !!address },
  });

  const { data: ethBalanceHandle } = useReadContract({
    address: CONTRACT_ADDRESSES.cEth,
    abi: CETH_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    query: { enabled: isConfigured && !!address },
  });

  const { data: zamaBalanceHandle } = useReadContract({
    address: CONTRACT_ADDRESSES.cZama,
    abi: CZAMA_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    query: { enabled: isConfigured && !!address },
  });

  const ethOutPreview = useMemo(() => calculateAmountOut(toBaseUnits(swapZama), reserves.cZama, reserves.cEth), [
    swapZama,
    reserves.cZama,
    reserves.cEth,
  ]);

  const zamaOutPreview = useMemo(() => calculateAmountOut(toBaseUnits(swapEth), reserves.cEth, reserves.cZama), [
    swapEth,
    reserves.cEth,
    reserves.cZama,
  ]);

  const updateBalances = () => {
    setBalances({
      cEth: ethBalanceHandle as string | undefined,
      cZama: zamaBalanceHandle as string | undefined,
    });
  };

  useEffect(() => {
    updateBalances();
  }, [ethBalanceHandle, zamaBalanceHandle]);

  const mintStarter = async () => {
    if (!isConfigured) {
      setMessage('Contracts are not configured. Deploy to Sepolia, then run the sync script.');
      return;
    }
    if (!address) {
      setMessage('Connect your wallet first.');
      return;
    }
    const signer = await signerPromise;
    if (!signer) {
      setMessage('Signer unavailable.');
      return;
    }
    setPending('mint');
    setMessage(null);
    try {
      const cEth = new Contract(CONTRACT_ADDRESSES.cEth, CETH_ABI, signer);
      const cZama = new Contract(CONTRACT_ADDRESSES.cZama, CZAMA_ABI, signer);
      const ethAmount = toBaseUnits('20');
      const zamaAmount = ethAmount * 2000n;
      const tx1 = await cEth.mint(address, ethAmount);
      await tx1.wait();
      const tx2 = await cZama.mint(address, zamaAmount);
      await tx2.wait();
      setMessage('Minted 20 cETH and 40,000 cZama to your wallet.');
    } catch (error) {
      console.error(error);
      setMessage('Mint failed, please try again.');
    } finally {
      setPending(null);
    }
  };

  const grantOperator = async () => {
    if (!isConfigured) {
      setMessage('Contracts are not configured. Deploy to Sepolia, then run the sync script.');
      return;
    }
    const signer = await signerPromise;
    if (!signer) {
      setMessage('Connect your wallet first.');
      return;
    }
    setPending('operator');
    setMessage(null);
    try {
      const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      const cEth = new Contract(CONTRACT_ADDRESSES.cEth, CETH_ABI, signer);
      const cZama = new Contract(CONTRACT_ADDRESSES.cZama, CZAMA_ABI, signer);
      await (await cEth.setOperator(CONTRACT_ADDRESSES.pool, expiry)).wait();
      await (await cZama.setOperator(CONTRACT_ADDRESSES.pool, expiry)).wait();
      setMessage('Operator access granted to the pool for 30 days.');
    } catch (error) {
      console.error(error);
      setMessage('Unable to grant operator access.');
    } finally {
      setPending(null);
    }
  };

  const addLiquidity = async () => {
    if (!isConfigured) {
      setMessage('Contracts are not configured. Deploy to Sepolia, then run the sync script.');
      return;
    }
    const signer = await signerPromise;
    if (!signer) {
      setMessage('Connect your wallet first.');
      return;
    }
    const ethAmount = toBaseUnits(addForm.eth);
    const zamaAmount = toBaseUnits(addForm.zama);
    if (!ethAmount || !zamaAmount) {
      setMessage('Enter amounts above zero.');
      return;
    }
    setPending('add');
    setMessage(null);
    try {
      const pool = new Contract(CONTRACT_ADDRESSES.pool, POOL_ABI, signer);
      const tx = await pool.addLiquidity(ethAmount, zamaAmount);
      await tx.wait();
      setMessage('Liquidity added.');
    } catch (error) {
      console.error(error);
      setMessage('Add liquidity failed.');
    } finally {
      setPending(null);
    }
  };

  const removeLiquidity = async () => {
    if (!isConfigured) {
      setMessage('Contracts are not configured. Deploy to Sepolia, then run the sync script.');
      return;
    }
    const signer = await signerPromise;
    if (!signer) {
      setMessage('Connect your wallet first.');
      return;
    }
    let burnAmount: bigint;
    try {
      burnAmount = BigInt(liquidityToBurn || '0');
    } catch {
      setMessage('Enter a numeric share amount.');
      return;
    }
    if (!burnAmount) {
      setMessage('Nothing to burn.');
      return;
    }
    setPending('remove');
    setMessage(null);
    try {
      const pool = new Contract(CONTRACT_ADDRESSES.pool, POOL_ABI, signer);
      const tx = await pool.removeLiquidity(burnAmount, 1, 1);
      await tx.wait();
      setMessage('Liquidity removed.');
    } catch (error) {
      console.error(error);
      setMessage('Remove liquidity failed.');
    } finally {
      setPending(null);
    }
  };

  const swapEthToZama = async () => {
    if (!isConfigured) {
      setMessage('Contracts are not configured. Deploy to Sepolia, then run the sync script.');
      return;
    }
    const signer = await signerPromise;
    if (!signer) {
      setMessage('Connect your wallet first.');
      return;
    }
    const amountIn = toBaseUnits(swapEth);
    if (!amountIn) {
      setMessage('Enter an amount to swap.');
      return;
    }
    setPending('swapEth');
    setMessage(null);
    try {
      const pool = new Contract(CONTRACT_ADDRESSES.pool, POOL_ABI, signer);
      const tx = await pool.swapEthForZama(amountIn, 1);
      await tx.wait();
      setMessage('Swapped cETH for cZama.');
    } catch (error) {
      console.error(error);
      setMessage('Swap failed.');
    } finally {
      setPending(null);
    }
  };

  const swapZamaToEth = async () => {
    if (!isConfigured) {
      setMessage('Contracts are not configured. Deploy to Sepolia, then run the sync script.');
      return;
    }
    const signer = await signerPromise;
    if (!signer) {
      setMessage('Connect your wallet first.');
      return;
    }
    const amountIn = toBaseUnits(swapZama);
    if (!amountIn) {
      setMessage('Enter an amount to swap.');
      return;
    }
    setPending('swapZama');
    setMessage(null);
    try {
      const pool = new Contract(CONTRACT_ADDRESSES.pool, POOL_ABI, signer);
      const tx = await pool.swapZamaForEth(amountIn, 1);
      await tx.wait();
      setMessage('Swapped cZama for cETH.');
    } catch (error) {
      console.error(error);
      setMessage('Swap failed.');
    } finally {
      setPending(null);
    }
  };

  const decryptBalance = async (handle: string | undefined, tokenAddress: string, key: keyof DecryptedBalances) => {
    if (!isConfigured) {
      setMessage('Contracts are not configured. Deploy to Sepolia, then run the sync script.');
      return;
    }
    if (!instance || !address || !handle) {
      setMessage('Missing data for decryption.');
      return;
    }
    const signer = await signerPromise;
    if (!signer) {
      setMessage('Connect your wallet first.');
      return;
    }
    setPending(`decrypt-${key}`);
    setMessage(null);
    try {
      const keypair = instance.generateKeypair();
      const start = Math.floor(Date.now() / 1000).toString();
      const duration = '5';
      const eip712 = instance.createEIP712(keypair.publicKey, [tokenAddress], start, duration);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );
      const result = await instance.userDecrypt(
        [{ handle, contractAddress: tokenAddress }],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        [tokenAddress],
        address,
        start,
        duration,
      );
      const plain = result[handle] || '0';
      const parsed = BigInt(plain);
      setDecrypted((prev) => ({ ...prev, [key]: formatAmount(parsed) }));
      setMessage('Decryption succeeded.');
    } catch (error) {
      console.error(error);
      setMessage('Decryption failed.');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="page">
      <Header />

      {!isConfigured && (
        <div className="notice">
          Contracts are not configured. Deploy on Sepolia, then run <code>node scripts/sync-frontend-contracts.js sepolia</code>.
        </div>
      )}

      <div className="grid two">
        <div className="card highlight">
          <div className="card-title">Your encrypted balances</div>
          {!isConnected ? (
            <p className="muted">Connect your wallet to load balances.</p>
          ) : (
            <>
              <div className="balance-row">
                <div>
                  <div className="label">cETH</div>
                  <div className="encrypted">{(balances.cEth as string) || '0x0'}</div>
                  {decrypted.cEth && <div className="plain">Clear: {decrypted.cEth} cETH</div>}
                </div>
                <button
                  className="btn ghost"
                  disabled={pending === 'decrypt-cEth' || zamaLoading}
                  onClick={() => decryptBalance(balances.cEth, CONTRACT_ADDRESSES.cEth, 'cEth')}
                >
                  {pending === 'decrypt-cEth' ? 'Decrypting...' : 'Decrypt'}
                </button>
              </div>

              <div className="balance-row">
                <div>
                  <div className="label">cZama</div>
                  <div className="encrypted">{(balances.cZama as string) || '0x0'}</div>
                  {decrypted.cZama && <div className="plain">Clear: {decrypted.cZama} cZama</div>}
                </div>
                <button
                  className="btn ghost"
                  disabled={pending === 'decrypt-cZama' || zamaLoading}
                  onClick={() => decryptBalance(balances.cZama, CONTRACT_ADDRESSES.cZama, 'cZama')}
                >
                  {pending === 'decrypt-cZama' ? 'Decrypting...' : 'Decrypt'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title">Quick setup</div>
          <p className="muted">Mint starter tokens and let the pool move them on your behalf.</p>
          <div className="row">
            <button className="btn" onClick={mintStarter} disabled={pending === 'mint'}>
              {pending === 'mint' ? 'Minting...' : 'Mint 20 cETH / 40k cZama'}
            </button>
            <button className="btn outline" onClick={grantOperator} disabled={pending === 'operator'}>
              {pending === 'operator' ? 'Authorizing...' : 'Grant operator access'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid three">
        <div className="card">
          <div className="card-title">Pool reserves</div>
          <div className="stat">
            <div className="label">cETH reserve</div>
            <div className="value">{formatAmount(reserves.cEth)} cETH</div>
          </div>
          <div className="stat">
            <div className="label">cZama reserve</div>
            <div className="value">{formatAmount(reserves.cZama)} cZama</div>
          </div>
          <div className="stat">
            <div className="label">Total liquidity shares</div>
            <div className="value">{(totalLiquidity as bigint | undefined)?.toString() || '0'}</div>
          </div>
          <div className="stat">
            <div className="label">Your shares</div>
            <div className="value">{(myLiquidity as bigint | undefined)?.toString() || '0'}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Add liquidity</div>
          <label className="label">cETH amount</label>
          <input
            className="input"
            value={addForm.eth}
            onChange={(e) => setAddForm((prev) => ({ ...prev, eth: e.target.value }))}
            placeholder="10"
          />
          <label className="label">cZama amount</label>
          <input
            className="input"
            value={addForm.zama}
            onChange={(e) => setAddForm((prev) => ({ ...prev, zama: e.target.value }))}
            placeholder="20000"
          />
          <button className="btn" onClick={addLiquidity} disabled={pending === 'add'}>
            {pending === 'add' ? 'Adding...' : 'Add liquidity'}
          </button>
          <p className="muted">Initial deposit must respect 1 cETH = 2000 cZama.</p>
        </div>

        <div className="card">
          <div className="card-title">Remove liquidity</div>
          <label className="label">Liquidity shares to burn</label>
          <input
            className="input"
            value={liquidityToBurn}
            onChange={(e) => setLiquidityToBurn(e.target.value)}
            placeholder="0"
          />
          <button className="btn outline" onClick={removeLiquidity} disabled={pending === 'remove'}>
            {pending === 'remove' ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-title">Swap cETH for cZama</div>
          <label className="label">cETH in</label>
          <input className="input" value={swapEth} onChange={(e) => setSwapEth(e.target.value)} />
          <div className="muted">Estimated out: {formatAmount(zamaOutPreview)} cZama</div>
          <button className="btn" onClick={swapEthToZama} disabled={pending === 'swapEth'}>
            {pending === 'swapEth' ? 'Swapping...' : 'Swap'}
          </button>
        </div>

        <div className="card">
          <div className="card-title">Swap cZama for cETH</div>
          <label className="label">cZama in</label>
          <input className="input" value={swapZama} onChange={(e) => setSwapZama(e.target.value)} />
          <div className="muted">Estimated out: {formatAmount(ethOutPreview)} cETH</div>
          <button className="btn" onClick={swapZamaToEth} disabled={pending === 'swapZama'}>
            {pending === 'swapZama' ? 'Swapping...' : 'Swap'}
          </button>
        </div>
      </div>

      {message && <div className="notice">{message}</div>}
    </div>
  );
}
