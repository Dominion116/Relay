import React from 'react';

export default function LogoIcon({ className = 'size-8 text-white' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="#0052FF" />
      {/* Relay stylized switch path */}
      <circle cx="10" cy="16" r="3" fill="white" />
      <circle cx="22" cy="16" r="3" fill="white" />
      <path
        d="M13 16h6M16 10l4 6-4 6"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
