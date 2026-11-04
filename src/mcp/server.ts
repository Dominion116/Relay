#!/usr/bin/env node
/**
 * Relay Official MCP (Model Context Protocol) Stdio Server
 *
 * Runs locally for Claude Desktop, Cursor, Windsurf, or any agent framework.
 * Tools execute with live x402 settlement on Base.
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

  // List all 12 live capabilities
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

  // Execute tool with live x402 flow
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
  console.error('Relay MCP Server running on stdio (Base L2 x402 enabled)');
}

main().catch((err) => {
  console.error('Fatal MCP Server error:', err);
  process.exit(1);
});
