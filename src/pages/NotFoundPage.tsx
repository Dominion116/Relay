import React from 'react';
import { HeaderNav } from '../components/HeaderNav';
import { Footer } from '../components/Footer';
import { Terminal, Home, Play, BookOpen, ArrowRight } from 'lucide-react';
import type { PageRoute } from '../App';

interface NotFoundPageProps {
  onNavigate: (page: PageRoute) => void;
  onOpenMcp: () => void;
  onOpenDiscovery: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  onNavigate,
  onOpenMcp,
  onOpenDiscovery,
}) => {
  return (
    <div className="w-full bg-[#0a0a0a] text-neutral-400 font-sans antialiased min-h-screen flex flex-col justify-between">
      <HeaderNav
        currentPage="home"
        onNavigate={onNavigate}
        onOpenMcp={onOpenMcp}
        onOpenDiscovery={onOpenDiscovery}
      />

      <main className="flex-1 w-full flex items-center justify-center py-20 px-6">
        <div className="max-w-xl w-full text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-300">
            <Terminal className="size-3.5 text-amber-400" />
            <span>HTTP 404 • Resource Not Found</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-neutral-100">
            Endpoint Unresolved
          </h1>

          <p className="text-sm leading-relaxed text-neutral-400 max-w-md mx-auto">
            The route or resource you requested is not mapped in the Relay gateway router. Verify the path or navigate to a live gateway capability below.
          </p>

          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 font-mono text-xs text-left text-neutral-300 space-y-1">
            <div className="text-neutral-500"># Gateway Response</div>
            <div><span className="text-amber-400">STATUS:</span> 404 NOT_FOUND</div>
            <div><span className="text-blue-400">GATEWAY:</span> Relay x402 Gateway Router</div>
            <div><span className="text-neutral-500">ACTION:</span> Re-route via canonical discovery manifest</div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-neutral-950 font-medium text-xs font-mono transition-colors inline-flex items-center gap-2"
            >
              <Home className="size-3.5" />
              <span>Return to Gateway</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('playground')}
              className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 font-medium text-xs font-mono transition-colors inline-flex items-center gap-2"
            >
              <Play className="size-3.5 text-blue-400" />
              <span>Launch Playground</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('docs')}
              className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 font-medium text-xs font-mono transition-colors inline-flex items-center gap-2"
            >
              <BookOpen className="size-3.5 text-neutral-400" />
              <span>Read Docs</span>
            </button>
          </div>
        </div>
      </main>

      <Footer
        onNavigate={onNavigate}
        onOpenMcp={onOpenMcp}
        onOpenDiscovery={onOpenDiscovery}
      />
    </div>
  );
};

export default NotFoundPage;
