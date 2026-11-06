import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, custom, getAddress, type Address, type EIP1193Provider, type Hex } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import type { X402PaymentProof } from '../types/x402';
import {
  createPaymentAuthorization, createPaymentPayload, validatePaymentChallenge, type PaymentPolicy
} from '../shared/paymentClient';

export { EIP712_TRANSFER_TYPES } from '../shared/resources';

export interface AgentWalletSession {
  privateKey: Hex;
  address: Address;
  isEphemeral: true;
}

/** Creates an explicitly requested, memory-only key. Existing browser-stored keys are never read or deleted. */
export function createAgentWallet(): AgentWalletSession {
  const privateKey = generatePrivateKey();
  return { privateKey, address: privateKeyToAccount(privateKey).address, isEphemeral: true };
}

/** Callers must provide their independently trusted merchant, network, resource, and price policy. */
export async function signChallengeWithAgentKey(
  privateKey: string,
  challenge: unknown,
  policy: PaymentPolicy
): Promise<X402PaymentProof> {
  const validated = validatePaymentChallenge(challenge, policy);
  const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('Invalid agent private key');
  let account;
  try { account = privateKeyToAccount(key as Hex); }
  catch { throw new Error('Invalid agent private key'); }
  const { authorization, typedData } = createPaymentAuthorization(validated, account.address);
  const signature = await account.signTypedData(typedData);
  return createPaymentPayload(validated, authorization, signature);
}

export async function signChallengeWithInjectedWallet(
  ethereum: EIP1193Provider,
  challenge: unknown,
  policy: PaymentPolicy
): Promise<X402PaymentProof> {
  const validated = validatePaymentChallenge(challenge, policy);
  const client = createWalletClient({
    chain: validated.chainId === base.id ? base : baseSepolia,
    transport: custom(ethereum)
  });
  const [rawAddress] = await client.requestAddresses();
  if (!rawAddress) throw new Error('No wallet account was selected');
  const address = getAddress(rawAddress);
  const currentChain = await ethereum.request({ method: 'eth_chainId' });
  if (BigInt(currentChain) !== BigInt(validated.chainId)) await client.switchChain({ id: validated.chainId });
  const { authorization, typedData } = createPaymentAuthorization(validated, address);
  const signature = await client.signTypedData({ account: address, ...typedData });
  return createPaymentPayload(validated, authorization, signature);
}
