import React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpRight01Icon } from '@hugeicons/core-free-icons';
import { motion, type Variants } from 'motion/react';
import type { PageRoute } from '../types/navigation';

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const riseItem: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', duration: 0.6, bounce: 0 },
  },
};

const giantTextVariant: Variants = {
  hidden: { opacity: 0, y: 30, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', duration: 0.8, bounce: 0 },
  },
};

export interface Footer20Props {
  brandName?: string;
  description?: string;
  email?: string;
  onNavigate?: (page: PageRoute) => void;
  onOpenMcp?: () => void;
  onOpenDiscovery?: () => void;
}

export const Footer: React.FC<Footer20Props> = ({
  brandName = "Relay",
  description = "Pay-per-use information infrastructure for autonomous AI agents on Base. Reviving HTTP status 402 with gasless EIP-712 settlement.",
  email = "builders@relay.org",
  onNavigate,
  onOpenMcp,
  onOpenDiscovery
}) => {
  return (
    <motion.footer
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      className="relative w-full bg-[#0a0a0a] text-neutral-400 font-sans overflow-hidden flex flex-col justify-between"
    >
      {/* Content wrapper without visible divider borders */}
      <div className="relative z-10 max-w-[1400px] w-full mx-auto px-6 md:px-12 lg:px-16 pt-20 md:pt-28 flex flex-col">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 mb-12 md:mb-16">
          
          {/* Left Column (Brand info - text logo only) */}
          <motion.div variants={riseItem} className="lg:col-span-6 xl:col-span-5 flex flex-col gap-4">
            <div className="flex items-center text-neutral-100">
              <span className="font-semibold tracking-tight text-2xl">{brandName}</span>
            </div>

            <p className="text-[14px] leading-relaxed text-neutral-400 max-w-[360px]">
              {description}
            </p>

            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-2 text-[14px] text-neutral-300 hover:text-white transition-colors group mt-1"
            >
              <span>{email}</span>
              <HugeiconsIcon
                icon={ArrowUpRight01Icon}
                size={15}
                className="text-neutral-500 group-hover:text-white transition-colors"
              />
            </a>
          </motion.div>

          {/* Right Columns (Focused, essential links only) */}
          <div className="lg:col-span-6 xl:col-span-7 grid grid-cols-2 gap-8 sm:gap-12 lg:justify-end">
            
            {/* Platform */}
            <motion.div variants={riseItem} className="flex flex-col gap-4">
              <h4 className="font-medium text-neutral-100 text-[14px] tracking-wide">Platform</h4>
              <ul className="flex flex-col gap-2.5">
                <li>
                  <button
                    onClick={() => onNavigate?.('docs')}
                    className="text-[14px] text-neutral-400 hover:text-neutral-200 transition-colors text-left"
                  >
                    Documentation
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate?.('capabilities')}
                    className="text-[14px] text-neutral-400 hover:text-neutral-200 transition-colors text-left"
                  >
                    Capabilities
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate?.('playground')}
                    className="text-[14px] text-neutral-400 hover:text-neutral-200 transition-colors text-left"
                  >
                    Playground
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate?.('protocol')}
                    className="text-[14px] text-neutral-400 hover:text-neutral-200 transition-colors text-left"
                  >
                    Protocol spec
                  </button>
                </li>
              </ul>
            </motion.div>

            {/* Developers */}
            <motion.div variants={riseItem} className="flex flex-col gap-4">
              <h4 className="font-medium text-neutral-100 text-[14px] tracking-wide">Developers & Legal</h4>
              <ul className="flex flex-col gap-2.5">
                <li>
                  <button
                    onClick={() => onOpenDiscovery?.()}
                    className="text-[14px] text-neutral-400 hover:text-neutral-200 transition-colors text-left"
                  >
                    Discovery manifest
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onOpenMcp?.()}
                    className="text-[14px] text-neutral-400 hover:text-neutral-200 transition-colors text-left"
                  >
                    MCP server
                  </button>
                </li>
                <li>
                  <a
                    href="/llms.txt"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[14px] text-neutral-400 hover:text-neutral-200 transition-colors inline-flex items-center gap-1"
                  >
                    <span>llms.txt (for AI agents)</span>
                    <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} className="text-neutral-500" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/Dominion116/Relay/issues"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[14px] text-neutral-400 hover:text-neutral-200 transition-colors inline-flex items-center gap-1"
                  >
                    <span>Developer support</span>
                    <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} className="text-neutral-500" />
                  </a>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate?.('terms')}
                    className="text-[14px] text-neutral-400 hover:text-neutral-200 transition-colors text-left"
                  >
                    Terms of service
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate?.('privacy')}
                    className="text-[14px] text-neutral-400 hover:text-neutral-200 transition-colors text-left"
                  >
                    Privacy policy
                  </button>
                </li>
              </ul>
            </motion.div>

          </div>
        </div>

        {/* Giant Text SVG watermark */}
        <motion.div variants={giantTextVariant} className="w-full flex justify-center mt-6 sm:mt-10 md:mt-auto pb-0 overflow-hidden pointer-events-none select-none">
          <svg
            className="w-full max-w-[1200px] h-auto select-none transition-colors duration-300"
            viewBox="0 0 540 120"
            preserveAspectRatio="xMidYMid meet"
            aria-label={brandName}
          >
            <defs>
              <linearGradient id="relay-watermark-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#333333" />
                <stop offset="25%" stopColor="#2A2A2A" />
                <stop offset="50%" stopColor="#1A1A1A" />
                <stop offset="75%" stopColor="#121212" />
                <stop offset="100%" stopColor="#0A0A0A" />
              </linearGradient>
            </defs>
            <text
              x="50%"
              y="108"
              dominantBaseline="alphabetic"
              textAnchor="middle"
              fill="url(#relay-watermark-gradient)"
              className="font-bold tracking-tight"
              fontSize="128"
            >
              {brandName ? brandName.toUpperCase() : 'RELAY'}
            </text>
          </svg>
        </motion.div>
      </div>
    </motion.footer>
  );
};

export default Footer;
