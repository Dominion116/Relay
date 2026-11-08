/**
 * Relay TypeScript SDK Autonomous Agent Demo Script
 * Demonstrates an autonomous bot executing HTTP 402 payment handshakes on Base Sepolia.
 */
import { RelayClient } from '../src/sdk';

async function main() {
  console.log('\n================================================================');
  console.log('🤖 RELAY TYPESCRIPT SDK — AUTONOMOUS AGENT RUNTIME');
  console.log('================================================================\n');

  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('AGENT_PRIVATE_KEY is missing from environment. Check your .env file.');
  }

  const gatewayUrl = process.env.GATEWAY_ORIGIN || 'http://localhost:5173';
  const network = (process.env.BASE_NETWORK || 'base-sepolia') as 'base-sepolia';
  const treasuryAddress = process.env.RELAY_TREASURY_ADDRESS;

  console.log(`📡 Connecting to Gateway: ${gatewayUrl}`);
  console.log(`🌐 Target Network:       ${network}`);
  console.log(`🏦 Treasury Address:     ${treasuryAddress}`);

  const relay = new RelayClient({
    privateKey,
    gatewayUrl,
    network,
    treasuryAddress,
    maxPaymentUsdc: '0.10',
    maxDailyBudgetUsdc: '2.00',
  });

  console.log('\n⚡ Dispatching SDK call: relay.academic.search("zero knowledge proofs", 2)...');
  const startTime = Date.now();
  const res = await relay.academic.search('zero knowledge proofs', 2);
  const duration = Date.now() - startTime;

  console.log('\n================================================================');
  console.log('⛓️  SETTLEMENT RECEIPT (X402 V2)');
  console.log('================================================================');
  console.log(`Network:          ${res.settlement.network}`);
  console.log(`Asset:            ${res.settlement.asset} (${res.settlement.cost_usdc})`);
  console.log(`Payer:            ${res.settlement.payer}`);
  console.log(`Tx Hash:          ${res.settlement.tx_hash}`);
  console.log(`Basescan Link:    https://sepolia.basescan.org/tx/${res.settlement.tx_hash}`);
  console.log(`Settled At:       ${res.settlement.settled_at}`);
  console.log(`Latency:          ${duration}ms\n`);

  console.log('================================================================');
  console.log('📚 ACADEMIC RESEARCH RETURNED:');
  console.log('================================================================');
  for (const paper of res.data.results) {
    console.log(`- "${paper.title}" (${paper.publication_year})`);
    console.log(`  Journal: ${paper.journal} | Citations: ${paper.cited_by_count}`);
    console.log(`  Link:    ${paper.landing_page_url || paper.doi}\n`);
  }
}

main().catch((err) => {
  console.error('Error running SDK demo:', err);
  process.exit(1);
});
