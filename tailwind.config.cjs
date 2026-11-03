/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0d0f14',
        surface: {
          DEFAULT: '#13161f',
          raised: '#1a1e2a',
          border: 'rgba(238, 240, 245, 0.08)',
          highlight: '#242938'
        },
        ink: {
          primary: '#eef0f5',
          secondary: '#a3a9b8',
          muted: '#7a8296'
        },
        base: {
          DEFAULT: '#0052FF',
          hover: '#0045d8',
          subtle: 'rgba(0, 82, 255, 0.12)'
        },
        settled: {
          DEFAULT: '#4cc38a',
          subtle: 'rgba(76, 195, 138, 0.12)'
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif']
      }
    },
  },
  plugins: [],
};
