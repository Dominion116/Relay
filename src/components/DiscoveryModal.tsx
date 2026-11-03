import React, { useState } from 'react';
import { Copy, Check, FileJson } from 'lucide-react';
import { FaXmark } from 'react-icons/fa6';
import { getWellKnownManifest } from '../server/x402Engine';

interface DiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiscoveryModal: React.FC<DiscoveryModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const manifest = getWellKnownManifest();
  const manifestString = JSON.stringify(manifest, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(manifestString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#141414] border border-neutral-800 p-6 sm:p-7 shadow-2xl flex flex-col max-h-[85vh] text-neutral-300 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-neutral-800 text-neutral-200">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-neutral-100 text-base">Manifest: /.well-known/x402</h3>
              <p className="text-xs text-neutral-500 font-mono">Machine-readable index for facilitators and crawlers</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <FaXmark className="size-4" />
          </button>
        </div>

        {/* Manifest Output */}
        <div className="py-4 flex-1 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-neutral-500">JSON Specification (RFC x402 Base)</span>
            <button
              onClick={handleCopy}
              className="text-xs font-mono text-neutral-400 hover:text-neutral-200 flex items-center gap-1 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <pre className="text-xs font-mono text-neutral-300 bg-black/80 p-4 rounded-xl border border-neutral-800 overflow-x-auto leading-relaxed">
            {manifestString}
          </pre>
        </div>

        {/* Footer */}
        <div className="pt-3 flex justify-end shrink-0">
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
