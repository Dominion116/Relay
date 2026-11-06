import React, { useState } from 'react';
import { Copy, Check, Cpu } from 'lucide-react';
import { FaXmark } from 'react-icons/fa6';
import { Dialog } from './Dialog';

interface McpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MCP_LOCAL_CONFIG = `{
  "mcpServers": {
    "relay": {
      "command": "node",
      "args": [
        "--import",
        "file:///C:/path/to/Relay/node_modules/tsx/dist/loader.mjs",
        "C:/path/to/Relay/src/mcp/server.ts"
      ],
      "env": {
        "AGENT_PRIVATE_KEY": "YOUR_LOCAL_WALLET_PRIVATE_KEY",
        "BASE_NETWORK": "base",
        "GATEWAY_ORIGIN": "https://relayx402.vercel.app",
        "RELAY_TREASURY_ADDRESS": "0x420f9F9deA7fA318eA8996C8aA00ad9738D98072",
        "MAX_PAYMENT_USDC": "0",
        "MAX_DAILY_BUDGET_USDC": "0"
      }
    }
  }
}`;

export const McpIntegrationModal: React.FC<McpModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [copyError, setCopyError] = useState('');

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(MCP_LOCAL_CONFIG);
      setCopyError('');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError('Clipboard access was denied. The configuration remains available below.');
    }
  };

  return (
    <Dialog titleId="mcp-dialog-title" onClose={onClose}>
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-neutral-800 text-neutral-200">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 id="mcp-dialog-title" className="font-medium text-neutral-100 text-base">Model Context Protocol</h2>
              <p className="text-xs text-neutral-500 font-mono">Connect Claude Desktop or Cursor to Relay</p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close MCP configuration"
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <FaXmark className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-4">
          <p className="text-[14px] text-neutral-400 leading-relaxed">
            Run the repository-local stdio server with Node after installing this checkout. Replace both absolute paths below. No public Relay npm package is required.
          </p>

          <div className="relative">
            <div className="flex items-center justify-between bg-neutral-900 rounded-t-xl px-4 py-2 text-xs font-mono text-neutral-400 border border-b-0 border-neutral-800">
              <span>claude_desktop_config.json</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-neutral-300 hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="p-4 bg-black/80 text-neutral-300 rounded-b-xl font-mono text-xs overflow-x-auto leading-relaxed border border-neutral-800">
              <code>{MCP_LOCAL_CONFIG}</code>
            </pre>
          </div>

          <div className="rounded-xl bg-neutral-900/60 border border-neutral-800 p-4 text-xs font-mono text-neutral-300 space-y-1.5">
            <div className="font-semibold text-neutral-200 uppercase tracking-wide text-[11px]">Environment requirements</div>
            <p><code className="text-white">BASE_NETWORK</code>: base (Base Mainnet) or base-sepolia (testnet); match the gateway's RELAY_NETWORK.</p>
            <p><code className="text-white">AGENT_PRIVATE_KEY</code>: keep the wallet key local. Never use a VITE_ variable for secrets.</p>
            <p>Zero budgets disable payments. Set both MAX_PAYMENT_USDC and MAX_DAILY_BUDGET_USDC to explicit limits only when authorized to spend.</p>
            <p>Reservations persist in ~/.relay/mcp-budget.json; RELAY_BUDGET_FILE can select an absolute path. Uncertain payments remain reserved until reconciled.</p>
          </div>
          <p className="text-xs text-neutral-400">For a terminal launch from the repository, use <code>npm run mcp</code>. Desktop clients should use the direct Node launcher above so stdout contains only MCP messages.</p>
          <p className="text-xs text-neutral-400">Relay MCP connects to the gateway via the canonical x402 v2 protocol. Ensure the gateway URL matches your active deployment.</p>
          {copyError && <p role="status" className="text-xs text-amber-300">{copyError}</p>}
        </div>

        {/* Footer */}
        <div className="pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-neutral-100 text-neutral-950 text-xs font-medium hover:bg-white transition-colors"
          >
            Close
          </button>
        </div>
    </Dialog>
  );
};
