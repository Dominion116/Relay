/**
 * Relay MCP (Model Context Protocol) Server
 *
 * Exposes Relay pay-per-use capabilities as standardized MCP tools
 * for Claude Desktop, Cursor, and autonomous agent frameworks.
 *
 * Each tool call initiates the x402 payment cycle settled in Base USDC.
 */

import { RELAY_RESOURCES, dispatchResourceRequest, generate402Challenge, verifyPaymentProof } from '../server/x402Engine';
import { getOrCreateAgentWallet, signChallengeWithAgentKey } from '../server/agentWallet';
import type { Hex } from 'viem';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export function getMcpToolsList(): McpToolDefinition[] {
  return RELAY_RESOURCES.map(r => ({
    name: `relay_${r.id}`,
    description: `[Relay - $${r.priceUsdc.toFixed(2)} USDC on Base] ${r.description}`,
    inputSchema: {
      type: 'object',
      properties: Object.entries(r.schema.request).reduce((acc, [key, val]) => {
        acc[key] = {
          type: val.type.includes('array') ? 'array' : val.type,
          description: val.description
        };
        return acc;
      }, {} as Record<string, any>),
      required: Object.entries(r.schema.request)
        .filter(([_, val]) => val.required)
        .map(([key]) => key)
    }
  }));
}

export async function executeMcpTool(toolName: string, args: Record<string, any>, walletAddress?: string) {
  const resourceId = toolName.replace(/^relay_/, '');
  const resource = RELAY_RESOURCES.find(r => r.id === resourceId);

  if (!resource) {
    throw new Error(`Tool ${toolName} not found in Relay registry.`);
  }

  // 1. Generate x402 payment challenge
  const challenge = generate402Challenge(resource, 'base');

  // 2. Automated cryptographic EIP-712 settlement
  const configuredKey = typeof process !== 'undefined' && (process.env?.AGENT_PRIVATE_KEY || process.env?.BASE_PRIVATE_KEY);
  const keyToUse = configuredKey && configuredKey.startsWith('0x') && configuredKey.length === 66
    ? (configuredKey as Hex)
    : getOrCreateAgentWallet().privateKey;

  const proof = await signChallengeWithAgentKey(keyToUse, challenge);

  const verification = await verifyPaymentProof(proof, resource, challenge);
  if (!verification.valid) {
    return {
      isError: true,
      content: [{ type: 'text', text: `x402 payment failed on Base: ${verification.error}` }]
    };
  }

  // 3. Dispatch and fetch live capability
  const result = await dispatchResourceRequest(resourceId, args);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            _x402_settlement: {
              network: 'Base (Chain ID 8453)',
              token: 'USDC',
              cost_usdc: `$${resource.priceUsdc.toFixed(2)}`,
              settlement_tx: verification.txHash
            },
            data: result
          },
          null,
          2
        )
      }
    ]
  };
}
