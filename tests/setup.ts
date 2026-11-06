// Tests must opt into an in-memory transport; never use configured production wallets.
for (const name of ['RELAY_FACILITATOR_KEY', 'AGENT_PRIVATE_KEY', 'BASE_PRIVATE_KEY', 'BASE_RPC_URL', 'RELAY_NETWORK', 'GATEWAY_ORIGIN', 'RELAY_TREASURY_ADDRESS']) {
  delete process.env[name];
}
globalThis.fetch = async () => { throw new Error('External fetch is disabled during automated tests. Install an explicit test stub.'); };
