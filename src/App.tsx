import React, { useState, useEffect } from 'react';
import { HomePage } from './pages/HomePage';
import { CapabilitiesPage } from './pages/CapabilitiesPage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { ProtocolPage } from './pages/ProtocolPage';
import { DocsPage } from './pages/DocsPage';
import { McpIntegrationModal } from './components/McpIntegrationModal';
import { DiscoveryModal } from './components/DiscoveryModal';

export type PageRoute = 'home' | 'capabilities' | 'playground' | 'protocol' | 'docs';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageRoute>('home');
  const [network, setNetwork] = useState<'base' | 'base-sepolia'>('base');
  const [agentBalance, setAgentBalance] = useState<number>(10.0);
  const [isMcpOpen, setIsMcpOpen] = useState<boolean>(false);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState<boolean>(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>('crypto_price');
  const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [currentPage]);

  const handleDeductBalance = (amountUsdc: number) => {
    setAgentBalance(prev => Math.max(0, Number((prev - amountUsdc).toFixed(2))));
  };

  const handleResetBalance = () => {
    setAgentBalance(10.0);
  };

  const handleSelectResourceForPlayground = (id: string) => {
    setSelectedResourceId(id);
    setInitialQuery(undefined);
    setCurrentPage('playground');
  };

  const handleSelectQueryForPlayground = (query: string) => {
    setSelectedResourceId('academic_works');
    setInitialQuery(query);
    setCurrentPage('playground');
  };

  return (
    <div className="w-full bg-[#0a0a0a] min-h-screen text-neutral-400 font-sans antialiased selection:bg-neutral-800 selection:text-white">
      {currentPage === 'home' && (
        <HomePage
          onNavigate={setCurrentPage}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
          onSelectQueryForPlayground={handleSelectQueryForPlayground}
        />
      )}

      {currentPage === 'capabilities' && (
        <CapabilitiesPage
          onNavigate={setCurrentPage}
          network={network}
          setNetwork={setNetwork}
          agentBalance={agentBalance}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
          onResetBalance={handleResetBalance}
          onSelectResourceForPlayground={handleSelectResourceForPlayground}
        />
      )}

      {currentPage === 'playground' && (
        <PlaygroundPage
          onNavigate={setCurrentPage}
          network={network}
          setNetwork={setNetwork}
          agentBalance={agentBalance}
          onDeductBalance={handleDeductBalance}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
          onResetBalance={handleResetBalance}
          initialResourceId={selectedResourceId}
          initialQuery={initialQuery}
        />
      )}

      {currentPage === 'protocol' && (
        <ProtocolPage
          onNavigate={setCurrentPage}
          network={network}
          setNetwork={setNetwork}
          agentBalance={agentBalance}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
          onResetBalance={handleResetBalance}
        />
      )}

      {currentPage === 'docs' && (
        <DocsPage
          onNavigate={setCurrentPage}
          network={network}
          setNetwork={setNetwork}
          agentBalance={agentBalance}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
          onResetBalance={handleResetBalance}
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
