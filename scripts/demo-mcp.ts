/**
 * Relay Official MCP Terminal Demo Script
 * Demonstrates invoking the Relay Model Context Protocol (MCP) server directly
 * from the terminal with automatic EIP-712 micro-settlements on Base Sepolia.
 */
import { getMcpToolsList, executeMcpTool } from '../src/mcp/relay-mcp';

async function main() {
  console.log('\n================================================================');
  console.log('💻 RELAY MCP — DIRECT TERMINAL EXECUTION');
  console.log('================================================================\n');

  // 1. Tool Discovery via MCP
  console.log('📡 Step 1: Discovering tools from Relay MCP Server (tools/list)...');
  const tools = getMcpToolsList();
  console.log(`✅ Server exposes ${tools.length} payment-enabled MCP tools:`);
  tools.slice(0, 4).forEach(t => console.log(`   - ${t.name}: ${t.description.split('] ')[1] || t.description}`));
  console.log(`   ... and ${tools.length - 4} more tools.\n`);

  // 2. Direct Terminal Tool Invocation
  console.log('⚡ Step 2: Executing MCP tool from terminal: relay_crypto_price');
  console.log('   Input: { assets: ["bitcoin", "ethereum"], vsCurrency: "usd" }');
  console.log('   Executing gasless x402 v2 payment on Base Sepolia...');

  const startTime = Date.now();
  const result = await executeMcpTool('relay_crypto_price', {
    assets: ['bitcoin', 'ethereum'],
    vsCurrency: 'usd',
  });
  const duration = Date.now() - startTime;

  if (result.isError) {
    console.error('❌ MCP Tool Error:', result.content[0]?.text);
    process.exit(1);
  }

  const parsed = JSON.parse(result.content[0].text);
  const settlement = parsed._settlement;
  const data = parsed.data;

  console.log('\n================================================================');
  console.log('⛓️  ON-CHAIN X402 SETTLEMENT CONFIRMED');
  console.log('================================================================');
  console.log(`Protocol:         ${settlement.protocol}`);
  console.log(`Network:          ${settlement.network} (Base Sepolia)`);
  console.log(`Cost:             ${settlement.cost_usdc} USDC`);
  console.log(`Payer Address:    ${settlement.payer}`);
  console.log(`Transaction Hash: ${settlement.tx_hash}`);
  console.log(`Explorer Link:    https://sepolia.basescan.org/tx/${settlement.tx_hash}`);
  console.log(`Latency:          ${duration}ms\n`);

  console.log('================================================================');
  console.log('📊 LIVE DATA RETURNED FROM RELAY MCP:');
  console.log('================================================================');
  for (const price of data.prices) {
    console.log(`- ${price.asset.toUpperCase()} (${price.symbol}): $${price.price.toLocaleString()} USD (24h: ${price.change_24h_percent}%)`);
  }
  console.log(`\nSource: ${data.source} | Retrieved At: ${data.retrieved_at}\n`);
}

main().catch((err) => {
  console.error('Error running MCP demo:', err);
  process.exit(1);
});
