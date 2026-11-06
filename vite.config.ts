import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { relayGatewayPlugin } from './src/server/viteGatewayPlugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), relayGatewayPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    strictPort: true
  },
  preview: {
    host: '127.0.0.1'
  }
});
