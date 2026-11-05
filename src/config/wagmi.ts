import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';
import { http } from 'wagmi';

export const config = getDefaultConfig({
  appName: 'Relay Protocol',
  projectId: '21fef48091f12692cad574a6f7753643', // Default public WalletConnect projectId
  chains: [base],
  transports: {
    [base.id]: http(
      (typeof process !== 'undefined' && process.env?.BASE_RPC_URL) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BASE_RPC_URL) ||
      'https://mainnet.base.org'
    )
  },
  ssr: false
});
