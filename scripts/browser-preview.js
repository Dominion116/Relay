import { build, preview } from 'vite';

const outDir = '.browser-dist';

// Exercise production bundling without importing a developer's .env configuration.
await build({
  mode: 'browser-test',
  logLevel: 'warn',
  envDir: false,
  build: { outDir, emptyOutDir: true, reportCompressedSize: false }
});

await preview({
  mode: 'browser-test',
  logLevel: 'warn',
  envDir: false,
  build: { outDir },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true }
});
