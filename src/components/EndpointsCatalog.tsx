import React, { useState } from 'react';
import { Search, ArrowUpRight, BookOpen, Globe, TrendingUp, CloudSun, MapPin, Calendar, CheckCircle2, Layers } from 'lucide-react';
import { RELAY_RESOURCES } from '../server/x402Engine';

interface EndpointsCatalogProps {
  onSelectEndpoint: (id: string) => void;
}

export const EndpointsCatalog: React.FC<EndpointsCatalogProps> = ({ onSelectEndpoint }) => {
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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'academic': return <BookOpen className="w-3.5 h-3.5 text-ink-muted" />;
      case 'crypto':
      case 'market': return <TrendingUp className="w-3.5 h-3.5 text-ink-muted" />;
      case 'weather': return <CloudSun className="w-3.5 h-3.5 text-ink-muted" />;
      case 'geo': return <MapPin className="w-3.5 h-3.5 text-ink-muted" />;
      case 'news': return <Globe className="w-3.5 h-3.5 text-ink-muted" />;
      case 'knowledge': return <Calendar className="w-3.5 h-3.5 text-ink-muted" />;
      case 'research': return <CheckCircle2 className="w-3.5 h-3.5 text-ink-muted" />;
      default: return <Layers className="w-3.5 h-3.5 text-ink-muted" />;
    }
  };

  return (
    <section id="endpoints" className="py-16 border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-baseline justify-between mb-8 gap-3">
          <div>
            <h2 className="text-2xl font-medium text-ink-primary tracking-tight">Capabilities directory</h2>
            <p className="text-xs text-ink-muted font-mono mt-1">
              Twelve endpoints callable without subscription accounts or API keys.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Filter endpoints..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-surface border border-surface-border rounded-md text-xs font-mono text-ink-primary placeholder-ink-muted focus:outline-none focus:border-ink-muted"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-colors ${
                activeCategory === cat.id
                  ? 'bg-surface-raised text-ink-primary font-medium border border-surface-border'
                  : 'text-ink-muted hover:text-ink-secondary hover:bg-surface'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Endpoints Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredResources.map(resource => (
            <div
              key={resource.id}
              className="bg-surface border border-surface-border rounded-lg p-4 flex flex-col justify-between hover:bg-surface-raised/40 transition-colors"
            >
              <div>
                {/* Top row: category + price */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-ink-muted">
                    {getCategoryIcon(resource.category)}
                    <span className="capitalize">{resource.category}</span>
                  </div>

                  <span className="text-xs font-mono font-medium text-ink-primary tabular-nums">
                    ${resource.priceUsdc.toFixed(2)} USDC
                  </span>
                </div>

                {/* Name & path */}
                <h3 className="text-sm font-medium text-ink-primary font-mono mb-1">
                  {resource.name}
                </h3>
                <div className="inline-block px-1.5 py-0.5 rounded bg-background border border-surface-border text-[11px] font-mono text-ink-secondary mb-2.5">
                  <span className="text-ink-muted">POST</span> {resource.path}
                </div>

                <p className="text-xs text-ink-secondary leading-relaxed mb-4">
                  {resource.description}
                </p>
              </div>

              {/* Bottom row: Network & CTA */}
              <div className="pt-3 border-t border-surface-border flex items-center justify-between text-xs font-mono">
                <span className="text-[11px] text-ink-muted">
                  Base (8453)
                </span>

                <button
                  onClick={() => onSelectEndpoint(resource.id)}
                  className="inline-flex items-center gap-1 text-ink-secondary hover:text-ink-primary transition-colors text-xs"
                >
                  <span>Test endpoint</span>
                  <ArrowUpRight className="w-3 h-3 text-ink-muted" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
