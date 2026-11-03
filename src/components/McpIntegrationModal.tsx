import React, { useState } from 'react';
import { Copy, Check, Cpu } from 'lucide-react';
import { FaXmark } from 'react-icons/fa6';

interface McpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const McpIntegrationModal: React.FC<McpModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const claudeDesktopConfig = `{
  "mcpServers": {
    "relay": {
      "command": "npx",
      "args": ["-y", "@relay/mcp-server"],
      "env": {
        "BASE_NETWORK": "base",
        "BASE_PRIVATE_KEY": "YOUR_AGENT_WALLET_KEY",
        "MAX_DAILY_BUDGET_USDC": "5.00"
      }
    }
  }
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(claudeDesktopConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#141414] border border-neutral-800 p-6 sm:p-7 shadow-2xl flex flex-col text-neutral-300 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-neutral-800 text-neutral-200">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-neutral-100 text-base">Model Context Protocol</h3>
              <p className="text-xs text-neutral-500 font-mono">Connect Claude Desktop or Cursor to Relay</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <FaXmark className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-4">
          <p className="text-[14px] text-neutral-400 leading-relaxed">
            Expose Relay endpoints as native tools for Claude or Cursor. Tools execute with inline x402 payment in Base USDC.
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
              <code>{claudeDesktopConfig}</code>
            </pre>
          </div>

          <div className="rounded-xl bg-neutral-900/60 border border-neutral-800 p-4 text-xs font-mono text-neutral-300 space-y-1.5">
            <div className="font-semibold text-neutral-200 uppercase tracking-wide text-[11px]">Environment requirements</div>
            <div>• <code className="text-white">BASE_NETWORK</code>: "base" or "base-sepolia"</div>
            <div>• <code className="text-white">BASE_PRIVATE_KEY</code>: standard 64-char hex key holding Base USDC</div>
          </div>
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
      </div>
    </div>
  );
};
