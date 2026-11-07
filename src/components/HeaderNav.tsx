import React, { useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { FaArrowRight, FaXmark } from 'react-icons/fa6';
import { relayChain, relayNetworkLabel } from '../config/wagmi';
import type { PageRoute } from '../types/navigation';

export interface HeaderNavProps {
  currentPage: PageRoute;
  onNavigate: (page: PageRoute) => void;
  onOpenMcp: () => void;
  onOpenDiscovery: () => void;
}

const headerVariants: Variants = {
  hidden: { opacity: 0, y: -14, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', duration: 0.6, bounce: 0 },
  },
};

export const HeaderNav: React.FC<HeaderNavProps> = ({
  currentPage,
  onNavigate
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Overview', page: 'home' as const },
    { label: 'Capabilities', page: 'capabilities' as const },
    { label: 'Playground', page: 'playground' as const },
    { label: 'Protocol spec', page: 'protocol' as const },
    { label: 'Docs', page: 'docs' as const },
  ];

  return (
    <div className="w-full bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-[1400px] w-full mx-auto px-6 md:px-12 lg:px-16 flex h-16 items-center justify-between">
        <motion.header
          variants={headerVariants}
          initial="hidden"
          animate="visible"
          className="flex w-full items-center justify-between"
        >
          {/* Text Logo Only */}
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex min-h-10 items-center text-neutral-100 hover:text-white transition-opacity active:scale-[0.98]"
          >
            <span className="text-xl font-semibold tracking-tight">
              Relay
            </span>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => onNavigate(item.page)}
                className={`text-[14px] font-medium transition-colors duration-200 ${
                  currentPage === item.page
                    ? 'text-neutral-100 font-semibold underline underline-offset-8 decoration-neutral-100'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Network pill - Base Mainnet Only */}
            <div className="inline-flex min-h-8 items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/80 px-3.5 text-xs font-medium text-neutral-300">
              <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
              <span>{relayNetworkLabel}</span>
            </div>

            {/* Test CTA */}
            {currentPage !== 'playground' && (
              <button
                onClick={() => onNavigate('playground')}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white text-neutral-950 px-4 text-xs font-medium hover:bg-neutral-200 transition-colors"
              >
                <span>Playground</span>
                <FaArrowRight className="size-2.5" />
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setMobileOpen(true)}
            className="inline-flex size-9 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white transition-colors lg:hidden"
          >
            <span className="h-3.5 w-4 bg-[linear-gradient(to_bottom,currentColor_0_2px,transparent_2px_6px,currentColor_6px_8px,transparent_8px_12px,currentColor_12px_14px)]" />
          </button>
        </motion.header>

        {/* Mobile Drawer */}
        <AnimatePresence initial={false}>
          {mobileOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
              className="fixed inset-x-4 top-4 z-50 rounded-2xl bg-[#141414] p-5 text-neutral-200 shadow-2xl border border-neutral-800 backdrop-blur-xl lg:hidden"
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <span className="text-lg font-semibold tracking-tight text-white">
                  Relay
                </span>
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={() => setMobileOpen(false)}
                  className="size-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  <FaXmark className="size-4" />
                </button>
              </div>

              <nav className="mt-4 grid gap-1.5">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setMobileOpen(false);
                      onNavigate(item.page);
                    }}
                    className="inline-flex min-h-10 items-center justify-between rounded-xl px-3 text-[14px] font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-left"
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>

              <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
                <span className="text-xs text-neutral-400">Network</span>
                <span className="text-xs font-mono font-medium text-blue-400">{relayNetworkLabel} ({relayChain.id})</span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
};
