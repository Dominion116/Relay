import esbuild from 'esbuild';
import fs from 'fs';

async function buildApi() {
  console.log('Building serverless API functions for Vercel...');

  fs.mkdirSync('api/well-known', { recursive: true });

  await esbuild.build({
    entryPoints: {
      'well-known/x402': 'src/api-handlers/well-known-x402.ts',
      'v1': 'src/api-handlers/v1-route.ts'
    },
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    outdir: 'api',
    packages: 'external'
  });

  console.log('API bundle build complete: api/well-known/x402.js & api/v1.js');
}

buildApi().catch(err => {
  console.error('API build failed:', err);
  process.exit(1);
});
