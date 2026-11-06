#!/usr/bin/env node
/**
 * Relay Official MCP (Model Context Protocol) Stdio Server
 *
 * Runs locally for Claude Desktop, Cursor, Windsurf, or any agent framework.
 * Tools use the configured HTTP gateway and explicit, persistent payment budgets.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getMcpToolsList, executeMcpTool } from './relay-mcp';

async function main() {
  const server = new Server(
    {
      name: 'relay-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Discovery stays usable without a configured payer or spending authorization.
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = getMcpToolsList();
    return {
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  // The SDK performs the canonical HTTP exchange; this process never executes providers.
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      const result = await executeMcpTool(name, args);
      return result;
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Relay tool error: ${err.message || 'Execution failed'}`,
          },
        ],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Relay MCP Server running on stdio (paid tools require explicit wallet and budget configuration)');
}

main().catch((err) => {
  console.error('Fatal MCP Server error:', err);
  process.exit(1);
});
