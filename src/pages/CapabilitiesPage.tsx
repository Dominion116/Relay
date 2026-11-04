import React, { useState } from 'react';
import { HeaderNav } from '../components/HeaderNav';
import { Footer } from '../components/Footer';
import { RELAY_RESOURCES } from '../server/x402Engine';
import { X402Resource } from '../types/x402';
import { FaArrowRight, FaMagnifyingGlass } from 'react-icons/fa6';
import { BookOpen, TrendingUp, CloudSun, MapPin, Calendar, CheckCircle2, Globe, Layers } from 'lucide-react';

interface CapabilitiesPageProps {
  onNavigate: (page: 'home' | 'capabilities' | 'playground' | 'protocol' | 'docs') => void;
  network: 'base' | 'base-sepolia';
  setNetwork: (net: 'base' | 'base-sepolia') => void;
  agentBalance: number;
  onOpenMcp: () => void;
  onOpenDiscovery: () => void;
  onResetBalance: () => void;
  onSelectResourceForPlayground: (id: string) => void;
}

export const CapabilitiesPage: React.FC<CapabilitiesPageProps> = ({
  onNavigate,
  network,
  setNetwork,
  agentBalance,
  onOpenMcp,
  onOpenDiscovery,
  onResetBalance,
  onSelectResourceForPlayground
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const categories = [
    { id: 'all', label: 'All capabilities' },
    { id: 'academic', label: 'Academic & papers' },
    { id: 'crypto', label: 'Crypto & markets' },
    { id: 'weather', label: 'Weather & geo' },
    { id: 'knowledge', label: 'Knowledge & news' },
    { id: 'research', label: 'Research & verification' }
  ];

  const filteredResources = RELAY_RESOURCES.filter(r => {
    const matchesCategory =
      activeCategory === 'all'
        ? true
        : activeCategory === 'weather'
        ? r.category === 'weather' || r.category === 'geo'
        : activeCategory === 'knowledge'
        ? r.category === 'knowledge' || r.category === 'news'
        : activeCategory === 'crypto'
        ? r.category === 'crypto' || r.category === 'market'
        : r.category === activeCategory;

    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.path.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyPath = (path: string, id: string) => {
    navigator.clipboard.writeText(path);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'academic': return <BookOpen className="w-4 h-4 text-neutral-300" />;
      case 'crypto':
      case 'market': return <TrendingUp className="w-4 h-4 text-neutral-300" />;
      case 'weather': return <CloudSun className="w-4 h-4 text-neutral-300" />;
      case 'geo': return <MapPin className="w-4 h-4 text-neutral-300" />;
      case 'events': return <Calendar className="w-4 h-4 text-neutral-300" />;
      case 'factcheck': return <CheckCircle2 className="w-4 h-4 text-neutral-300" />;
      case 'knowledge': return <Globe className="w-4 h-4 text-neutral-300" />;
      default: return <Layers className="w-4 h-4 text-neutral-300" />;
    }
  };

  return (
    <div className="w-full bg-[#0a0a0a] text-neutral-400 font-sans antialiased min-h-screen flex flex-col justify-between">
      {/* HeaderNav */}
      <HeaderNav
        currentPage="capabilities"
        onNavigate={onNavigate}
        network={network}
        setNetwork={setNetwork}
        agentBalance={agentBalance}
        onOpenMcp={onOpenMcp}
        onOpenDiscovery={onOpenDiscovery}
        onResetBalance={onResetBalance}
      />

      {/* Main Container */}
      <main className="flex-1 w-full">
        <div className="max-w-[1400px] w-full mx-auto px-6 md:px-12 lg:px-16 py-16 md:py-20">
          
          {/* Page Header */}
          <div className="max-w-3xl mb-12">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-400 mb-4">
              <span className="size-1.5 rounded-full bg-blue-500" />
              <span>API Registry & Endpoints</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-neutral-100 mb-4 text-balance">
              Capabilities directory
            </h1>
            <p className="text-[15px] leading-relaxed text-neutral-400 max-w-2xl">
              Twelve production endpoints on Base. Callable without subscriptions, keys, or accounts. Paid per request in micro-USDC via the x402 protocol.
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-10 pb-6 border-b border-neutral-800/80">
            {/* Category Pills */}
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter capabilities by category">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    activeCategory === cat.id
                      ? 'bg-neutral-100 text-neutral-950 font-semibold'
                      : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search Pill Input */}
            <div className="relative w-full md:w-80">
              <label htmlFor="capability-search" className="sr-only">Filter capabilities</label>
              <FaMagnifyingGlass className="size-3 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
              <input
                id="capability-search"
                type="text"
                placeholder="Filter capabilities or routes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-900/80 focus:bg-neutral-900 text-neutral-200 placeholder:text-neutral-500 text-xs rounded-full pl-10 pr-4 py-2 outline-none border border-neutral-800 focus:border-neutral-700 transition-colors font-mono focus-visible:ring-2 focus-visible:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Capabilities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {filteredResources.map((res: X402Resource) => (
              <div
                key={res.id}
                className="rounded-2xl bg-neutral-900/30 border border-neutral-800/80 hover:border-neutral-700/80 p-6 sm:p-7 flex flex-col justify-between transition-colors"
              >
                <div>
                  {/* Category & Price Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700/60">
                        {getCategoryIcon(res.category)}
                      </div>
                      <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider font-medium">
                        {res.category}
                      </span>
                    </div>
                    <div className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-mono font-medium text-blue-400 border border-blue-500/20">
                      ${res.priceUsdc.toFixed(2)} USDC
                    </div>
                  </div>

                  {/* Name & Route */}
                  <h2 className="text-base font-medium text-neutral-100 mb-2">
                    {res.name}
                  </h2>
                  
                  {/* Path with quick copy */}
                  <div className="flex items-center justify-between bg-black/40 px-3 py-1.5 rounded-lg border border-neutral-800 mb-3 font-mono text-xs text-neutral-300">
                    <code className="truncate mr-2">{res.path}</code>
                    <button
                      type="button"
                      onClick={() => copyPath(`https://relay.base.org${res.path}`, res.id)}
                      title="Copy endpoint path"
                      className="text-neutral-500 hover:text-neutral-200 transition-colors shrink-0 text-[11px]"
                    >
                      {copiedId === res.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-neutral-400 leading-relaxed mb-4 font-sans">
                    {res.description}
                  </p>

                  {/* Parameters Preview */}
                  <div className="rounded-xl bg-black/60 p-3 mb-4 text-xs font-mono text-neutral-300 border border-neutral-800/80">
                    <div className="text-[10px] text-neutral-500 mb-1 font-semibold uppercase tracking-wider">
                      Payload Schema
                    </div>
                    <pre className="text-neutral-300 overflow-x-auto text-[11px] leading-relaxed">
                      {JSON.stringify(res.defaultParams, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-neutral-800/60 flex items-center justify-between">
                  <span className="text-xs font-mono text-neutral-500">
                    Base ERC-3009
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectResourceForPlayground(res.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full bg-neutral-100 text-neutral-950 px-3.5 py-1.5 hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span>Test in playground</span>
                    <FaArrowRight className="size-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* Footer */}
      <Footer
        onNavigate={onNavigate}
        onOpenMcp={onOpenMcp}
        onOpenDiscovery={onOpenDiscovery}
      />
    </div>
  );
};
