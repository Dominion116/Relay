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
  const [isMcpOpen, setIsMcpOpen] = useState<boolean>(false);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState<boolean>(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>('crypto_price');
  const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [currentPage]);

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
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
          onSelectResourceForPlayground={handleSelectResourceForPlayground}
        />
      )}

      {currentPage === 'playground' && (
        <PlaygroundPage
          onNavigate={setCurrentPage}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
          initialResourceId={selectedResourceId}
          initialQuery={initialQuery}
        />
      )}

      {currentPage === 'protocol' && (
        <ProtocolPage
          onNavigate={setCurrentPage}
          onOpenMcp={() => setIsMcpOpen(true)}
          onOpenDiscovery={() => setIsDiscoveryOpen(true)}
        />
      )}

      {currentPage === 'docs' && (
        <DocsPage
          onNavigate={setCurrentPage}
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
