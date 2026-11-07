import React, { useState, useEffect } from 'react';
import { HomePage } from './pages/HomePage';
import { CapabilitiesPage } from './pages/CapabilitiesPage';
import { PlaygroundPage, type DashboardSettlementItem } from './pages/PlaygroundPage';
import { ProtocolPage } from './pages/ProtocolPage';
import { DocsPage } from './pages/DocsPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { McpIntegrationModal } from './components/McpIntegrationModal';
import { DiscoveryModal } from './components/DiscoveryModal';

import type { PageRoute } from './types/navigation';

export type { PageRoute };

function routeFromPath(pathname: string): PageRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '') return 'home';
  if (clean === '/capabilities') return 'capabilities';
  if (clean === '/playground') return 'playground';
  if (clean === '/protocol') return 'protocol';
  if (clean === '/docs') return 'docs';
  if (clean === '/terms') return 'terms';
  if (clean === '/privacy') return 'privacy';
  return '404';
}

function pathToRoute(page: PageRoute): string {
  if (page === 'home') return '/';
  if (page === '404') return '/404';
  return `/${page}`;
}

const PAGE_META: Record<PageRoute, { title: string; description: string }> = {
  home: {
    title: 'Relay | Pay-per-use information infrastructure on Base via x402',
    description: 'Open pay-per-use data and capability infrastructure for AI agents and developers. Settle per request in USDC on Base via the canonical x402 protocol.',
  },
  capabilities: {
    title: 'Relay | Capabilities — 12 Live Machine-Callable Endpoints on Base',
    description: 'Explore live x402 data endpoints: scholarly literature, crypto prices & market metrics, foreign exchange, weather, geocoding, Wikidata, and claim verification.',
  },
  playground: {
    title: 'Relay | Playground — Execute x402 Micropayments on Base',
    description: 'Test gasless EIP-712 payment authorizations and live on-chain settlement on Base. Inspect HTTP 402 challenges and confirmed receipts.',
  },
  protocol: {
    title: 'Relay | Protocol Specification & Machine Manifest — x402 v2 on Base',
    description: 'Technical wire protocol specification for x402 on Base. ERC-3009 TransferWithAuthorization, machine discovery manifest, and settlement architecture.',
  },
  docs: {
    title: 'Relay | Documentation & Token Economics — Vibestarter Architecture',
    description: 'Developer integration guides for TypeScript, Python, and Model Context Protocol (MCP), plus $RELAY token utility and network economics.',
  },
  terms: {
    title: 'Relay | Terms of Service — Non-Custodial Protocol Specification',
    description: 'Terms of service governing the use of Relay client software, x402 gateway routing, and autonomous agent spending parameters.',
  },
  privacy: {
    title: 'Relay | Privacy Policy — Zero-Data & Zero-Cookie Commitment',
    description: 'Relay collects zero personally identifiable information, sets zero tracking cookies, and operates with pure client-side key storage.',
  },
  '404': {
    title: 'Relay | 404 — Endpoint Unresolved',
    description: 'The requested route or resource is not mapped in the Relay gateway router.',
  },
};

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageRoute>(() => {
    if (typeof window !== 'undefined' && window.location) {
      return routeFromPath(window.location.pathname);
    }
    return 'home';
  });
  const [isMcpOpen, setIsMcpOpen] = useState<boolean>(false);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState<boolean>(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>('crypto_price');
  const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);
  const [settlementLedger, setSettlementLedger] = useState<DashboardSettlementItem[]>([]);

  // Browser back/forward navigation support
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      setCurrentPage(routeFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update dynamic page meta & scroll on page change
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const meta = PAGE_META[currentPage] || PAGE_META.home;
    document.title = meta.title;

    const descTag = document.querySelector('meta[name="description"]');
    if (descTag) descTag.setAttribute('content', meta.description);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', meta.title);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', meta.description);

    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', meta.title);

    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', meta.description);

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [currentPage]);

  const handleNavigate = (page: PageRoute) => {
    setCurrentPage(page);
    if (typeof window !== 'undefined' && window.history) {
      const targetPath = pathToRoute(page);
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  };

  const handleSelectResourceForPlayground = (id: string) => {
    setSelectedResourceId(id);
    setInitialQuery(undefined);
    handleNavigate('playground');
  };

  const handleSelectQueryForPlayground = (query: string) => {
    setSelectedResourceId('academic_search');
    setInitialQuery(query);
    handleNavigate('playground');
  };

  return (
    <div className="w-full bg-[#0a0a0a] min-h-screen text-neutral-400 font-sans antialiased selection:bg-neutral-800 selection:text-white">
      {currentPage === 'home' && (
        <HomePage
          onNavigate={handleNavigate}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
          onSelectQueryForPlayground={handleSelectQueryForPlayground}
        />
      )}

      {currentPage === 'capabilities' && (
        <CapabilitiesPage
          onNavigate={handleNavigate}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
          onSelectResourceForPlayground={handleSelectResourceForPlayground}
        />
      )}

      {currentPage === 'playground' && (
        <PlaygroundPage
          onNavigate={handleNavigate}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
          initialResourceId={selectedResourceId}
          initialQuery={initialQuery}
          settlementLedger={settlementLedger}
          onRecordSettlement={(item) => setSettlementLedger(previous => [item, ...previous.filter(entry => entry.id !== item.id)])}
        />
      )}

      {currentPage === 'protocol' && (
        <ProtocolPage
          onNavigate={handleNavigate}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
        />
      )}

      {currentPage === 'docs' && (
        <DocsPage
          onNavigate={handleNavigate}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
        />
      )}

      {currentPage === 'terms' && (
        <TermsPage
          onNavigate={handleNavigate}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
        />
      )}

      {currentPage === 'privacy' && (
        <PrivacyPage
          onNavigate={handleNavigate}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
        />
      )}

      {currentPage === '404' && (
        <NotFoundPage
          onNavigate={handleNavigate}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
        />
      )}

      {/* Global Modals */}
      <McpIntegrationModal
        isOpen={isMcpOpen}
        onClose={() => setIsMcpOpen(false)}
      />

      <DiscoveryModal
        isOpen={isDiscoveryOpen}
        onClose={() => setIsDiscoveryOpen(false)}
      />
    </div>
  );
};

export default App;
