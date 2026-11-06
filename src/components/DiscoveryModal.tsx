import React, { useEffect, useState } from 'react';
import { Copy, Check, FileJson } from 'lucide-react';
import { FaXmark } from 'react-icons/fa6';
import { Dialog } from './Dialog';
import { getGatewayUrl } from '../config/wagmi';

interface DiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiscoveryModal: React.FC<DiscoveryModalProps> = ({ isOpen, onClose }) => {
  const [manifest, setManifest] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [retry, setRetry] = useState(0);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    let active = true;
    setManifest(null);
    setCopied(false);
    setError('');
    setLoading(true);
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const load = async () => {
      try {
        const target = `${getGatewayUrl()}/.well-known/x402`;
        setUrl(target);
        const response = await fetch(target, { signal: controller.signal, redirect: 'error', cache: 'no-store', credentials: 'omit' });
        if (!response.ok) throw new Error(`Manifest request failed (HTTP ${response.status}).`);
        const data = await response.json();
        if (data?.x402Version !== 2 || !Array.isArray(data.resources)) throw new Error('The gateway returned an invalid x402 discovery manifest.');
        if (active) setManifest(data);
      } catch (cause) {
        if (active) setError(cause instanceof Error && cause.name !== 'AbortError' ? cause.message : 'Manifest request timed out.');
      } finally {
        clearTimeout(timeout);
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [isOpen, retry]);

  if (!isOpen) return null;
  const manifestString = manifest ? JSON.stringify(manifest, null, 2) : '';

  return (
    <Dialog titleId="discovery-dialog-title" onClose={onClose} className="max-w-2xl">
      <div className="flex items-start justify-between gap-3 pb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-neutral-800 text-neutral-200"><FileJson className="size-5" /></div>
          <div className="min-w-0">
            <h2 id="discovery-dialog-title" className="font-medium text-neutral-100 text-base break-words">Manifest: /.well-known/x402</h2>
            <p className="text-xs text-neutral-500 font-mono break-all">{url || 'Gateway discovery'}</p>
          </div>
        </div>
        <button type="button" aria-label="Close discovery manifest" onClick={onClose} className="size-8 shrink-0 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800">
          <FaXmark className="size-4" />
        </button>
      </div>
      {loading && <p role="status" className="py-8 text-sm text-neutral-400">Fetching the gateway manifest...</p>}
      {error && <div role="alert" className="py-4 space-y-3 text-sm text-amber-300">
        <p>{error}</p>
        <button type="button" onClick={() => setRetry(value => value + 1)} className="rounded-full border border-neutral-700 px-4 py-2 text-xs text-neutral-200">Retry discovery</button>
      </div>}
      {manifest !== null && <div className="py-4 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-xs font-mono text-neutral-500">Gateway response (x402 v2)</span>
          <button type="button" onClick={async () => {
            try {
              await navigator.clipboard.writeText(manifestString);
              setCopied(true);
            } catch {
              setError('Clipboard access was denied. The manifest remains available below.');
            }
          }} className="text-xs font-mono text-neutral-400 hover:text-neutral-200 flex items-center gap-1">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <pre tabIndex={0} aria-label="Gateway discovery JSON" className="text-xs font-mono text-neutral-300 bg-black/80 p-4 rounded-xl border border-neutral-800 overflow-x-auto leading-relaxed">{manifestString}</pre>
      </div>}
      <div className="pt-3 flex justify-end">
        <button type="button" onClick={onClose} className="px-5 py-2 rounded-full bg-neutral-100 text-neutral-950 text-xs font-medium hover:bg-white">Close</button>
      </div>
    </Dialog>
  );
};
