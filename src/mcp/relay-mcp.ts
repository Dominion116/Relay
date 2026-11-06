import { RELAY_RESOURCES } from '../shared/resources';
import { getRequestSchema, validateResourceParams } from '../shared/validation';
import { RelayClient, RelayPaymentError } from '../sdk/relayClient';
import type { PaymentBudgetStore } from '../sdk/budgetStore';
import type { RelayNetwork } from '../types/x402';
import { FileBudgetStore } from './budgetStore';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: ReturnType<typeof getRequestSchema>;
}

export type McpToolResult = {
  isError?: boolean;
  content: Array<{ type: 'text'; text: string }>;
};

export function getMcpToolsList(): McpToolDefinition[] {
  return RELAY_RESOURCES.map(resource => ({
    name: `relay_${resource.id}`,
    description: `[Relay - $${resource.priceUsdc.toFixed(2)} USDC on the configured Base network] ${resource.description}`,
    inputSchema: getRequestSchema(resource),
  }));
}

interface ExecutorOptions {
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  budgetStore?: PaymentBudgetStore;
}

/** One lazy SDK client per server, so initialize/tools/list never need a wallet or a budget file. */
export function createMcpToolExecutor(options: ExecutorOptions = {}) {
  const env = options.env ?? process.env;
  let client: RelayClient | undefined;
  return async (toolName: string, args: Record<string, unknown> = {}): Promise<McpToolResult> => {
    try {
      const resource = RELAY_RESOURCES.find(item => `relay_${item.id}` === toolName);
      if (!resource) throw new Error(`Unknown Relay tool: ${toolName}`);
      const params = validateResourceParams(resource, args);
      if (!client) {
        if (!env.AGENT_PRIVATE_KEY) throw new Error('AGENT_PRIVATE_KEY is required to execute paid Relay tools; no payer wallet is generated automatically');
        const network = env.BASE_NETWORK ?? 'base';
        if (network !== 'base' && network !== 'base-sepolia') throw new Error('BASE_NETWORK must be base or base-sepolia');
        if (env.GATEWAY_ORIGIN && env.RELAY_GATEWAY_URL && env.GATEWAY_ORIGIN !== env.RELAY_GATEWAY_URL) {
          throw new Error('GATEWAY_ORIGIN and RELAY_GATEWAY_URL disagree; configure one trusted gateway origin');
        }
        client = new RelayClient({
          privateKey: env.AGENT_PRIVATE_KEY,
          gatewayUrl: env.GATEWAY_ORIGIN ?? env.RELAY_GATEWAY_URL,
          network: network as RelayNetwork,
          treasuryAddress: env.RELAY_TREASURY_ADDRESS,
          maxPaymentUsdc: env.MAX_PAYMENT_USDC,
          maxDailyBudgetUsdc: env.MAX_DAILY_BUDGET_USDC,
          budgetStore: options.budgetStore ?? new FileBudgetStore(env.RELAY_BUDGET_FILE),
          fetch: options.fetch,
        });
      }
      const result = await client.call(resource.path, params);
      return { content: [{ type: 'text', text: JSON.stringify({ _settlement: result.settlement, data: result.data }, null, 2) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Relay tool execution failed';
      const transaction = error instanceof RelayPaymentError && error.transactionHash ? ` Transaction: ${error.transactionHash}.` : '';
      return { isError: true, content: [{ type: 'text', text: `${message}${transaction}` }] };
    }
  };
}

const execute = createMcpToolExecutor();

export function executeMcpTool(toolName: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
  return execute(toolName, args);
}
