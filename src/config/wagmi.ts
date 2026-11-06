import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import { base, baseSepolia } from 'wagmi/chains';
import { http } from 'wagmi';
import { getAddress } from 'viem';
import { BASE_USDC_MAINNET, BASE_USDC_SEPOLIA, DEFAULT_TREASURY_ADDRESS } from '../shared/resources';
import { normalizeGatewayUrl } from '../shared/paymentClient';

const environment = import.meta.env;
const configuredNetwork = environment.VITE_BASE_NETWORK || 'base';
if (configuredNetwork !== 'base' && configuredNetwork !== 'base-sepolia') {
  throw new Error('VITE_BASE_NETWORK must be base or base-sepolia.');
}
export const relayNetwork = configuredNetwork as 'base' | 'base-sepolia';
export const relayChain = relayNetwork === 'base' ? base : baseSepolia;
export const relayNetworkLabel = relayNetwork === 'base' ? 'Base Mainnet' : 'Base Sepolia';
export const relayTokenAddress = getAddress(relayNetwork === 'base' ? BASE_USDC_MAINNET : BASE_USDC_SEPOLIA);
export const relayTreasuryAddress = getAddress(environment.VITE_RELAY_TREASURY_ADDRESS || DEFAULT_TREASURY_ADDRESS);

export function getGatewayUrl(): string {
  const origin = typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin;
  return normalizeGatewayUrl(environment.VITE_GATEWAY_URL || origin);
}

const projectId = environment.VITE_WALLETCONNECT_PROJECT_ID || '';

export const config = getDefaultConfig({
  appName: 'Relay Protocol',
  projectId,
  wallets: projectId ? undefined : [{ groupName: 'Browser wallets', wallets: [injectedWallet] }],
  chains: [relayChain],
  transports: {
    [relayChain.id]: http(environment.VITE_BASE_RPC_URL || undefined, { timeout: 10_000, retryCount: 0 })
  },
  ssr: false
});
