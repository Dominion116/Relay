import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, custom, parseSignature, getAddress, type Hex, type Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { X402Challenge, X402PaymentProof } from '../types/x402';

export const EIP712_TRANSFER_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
  ]
} as const;

export interface AgentWalletSession {
  privateKey: Hex;
  address: Address;
  isEphemeral: boolean;
}

// Persistent session key stored in browser storage for realism
const SESSION_KEY_STORAGE = 'relay_agent_session_key';

/**
 * Retrieves the persistent session wallet or creates a new live ephemeral agent wallet
 */
export function getOrCreateAgentWallet(): AgentWalletSession {
  let storedKey = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY_STORAGE) : null;
  let isEphemeral = false;

  if (!storedKey || !storedKey.startsWith('0x') || storedKey.length !== 66) {
    storedKey = generatePrivateKey();
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SESSION_KEY_STORAGE, storedKey);
      } catch {
        // localStorage unavailable in some sandboxes
      }
    }
    isEphemeral = true;
  }

  const account = privateKeyToAccount(storedKey as Hex);
  return {
    privateKey: storedKey as Hex,
    address: account.address,
    isEphemeral
  };
}

/**
 * Resets the session wallet to generate a fresh agent keypair
 */
export function resetAgentWallet(): AgentWalletSession {
  const newKey = generatePrivateKey();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SESSION_KEY_STORAGE, newKey);
    } catch {
      // Ignore
    }
  }
  const account = privateKeyToAccount(newKey);
  return {
    privateKey: newKey,
    address: account.address,
    isEphemeral: true
  };
}

/**
 * Cryptographically signs an authentic EIP-712 TransferWithAuthorization message
 * using the local agent private key.
 */
export async function signChallengeWithAgentKey(
  privateKey: Hex,
  challenge: X402Challenge
): Promise<X402PaymentProof> {
  const account = privateKeyToAccount(privateKey);
  const req = challenge.paymentRequirements;

  // Build canonical Base USDC EIP-712 domain with checksummed contract
  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: req.chainId,
    verifyingContract: getAddress(req.tokenAddress)
  } as const;

  const validAfter = 0n;
  const validBefore = BigInt(req.validBefore);
  const value = BigInt(req.amount);
  const nonce = req.nonce.startsWith('0x') && req.nonce.length === 66
    ? (req.nonce as Hex)
    : (`0x${req.nonce.replace(/^0x/, '').padStart(64, '0')}` as Hex);

  const message = {
    from: getAddress(account.address),
    to: getAddress(req.payTo),
    value,
    validAfter,
    validBefore,
    nonce
  };

  // Live cryptographic secp256k1 EIP-712 signature
  const clientSignature = await account.signTypedData({
    domain,
    types: EIP712_TRANSFER_TYPES,
    primaryType: 'TransferWithAuthorization',
    message
  });

  const parsed = parseSignature(clientSignature);

  return {
    scheme: 'transferWithAuthorization',
    clientSignature,
    payerAddress: account.address,
    timestamp: Date.now(),
    authorization: {
      from: account.address,
      to: req.payTo,
      value: req.amount,
      validAfter: 0,
      validBefore: req.validBefore,
      nonce: req.nonce,
      v: parsed.v ? Number(parsed.v) : undefined,
      r: parsed.r,
      s: parsed.s
    }
  };
}

/**
 * Signs using an injected browser wallet (e.g. Coinbase Wallet or MetaMask)
 */
export async function signChallengeWithInjectedWallet(
  ethereum: any,
  challenge: X402Challenge
): Promise<X402PaymentProof> {
  const req = challenge.paymentRequirements;
  const targetChain = req.chainId === 8453 ? base : baseSepolia;

  const walletClient = createWalletClient({
    chain: targetChain,
    transport: custom(ethereum)
  });

  const [rawAddress] = await walletClient.requestAddresses();
  const address = getAddress(rawAddress);

  const domain = {
    name: 'USD Coin',
    version: '2',
    chainId: req.chainId,
    verifyingContract: getAddress(req.tokenAddress)
  } as const;

  const validAfter = 0n;
  const validBefore = BigInt(req.validBefore);
  const value = BigInt(req.amount);
  const nonce = req.nonce.startsWith('0x') && req.nonce.length === 66
    ? (req.nonce as Hex)
    : (`0x${req.nonce.replace(/^0x/, '').padStart(64, '0')}` as Hex);

  const message = {
    from: address,
    to: getAddress(req.payTo),
    value,
    validAfter,
    validBefore,
    nonce
  };

  const clientSignature = await walletClient.signTypedData({
    account: address,
    domain,
    types: EIP712_TRANSFER_TYPES,
    primaryType: 'TransferWithAuthorization',
    message
  });

  const parsed = parseSignature(clientSignature);

  return {
    scheme: 'transferWithAuthorization',
    clientSignature,
    payerAddress: address,
    timestamp: Date.now(),
    authorization: {
      from: address,
      to: req.payTo,
      value: req.amount,
      validAfter: 0,
      validBefore: req.validBefore,
      nonce: req.nonce,
      v: parsed.v ? Number(parsed.v) : undefined,
      r: parsed.r,
      s: parsed.s
    }
  };
}
