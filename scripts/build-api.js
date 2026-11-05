import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

async function buildApi() {
  console.log('Building serverless API functions for Vercel...');

  fs.mkdirSync('api/well-known', { recursive: true });
  fs.mkdirSync('api/v1', { recursive: true });

  await esbuild.build({
    entryPoints: {
      'well-known/x402': 'src/api-handlers/well-known-x402.ts',
      'v1/[...route]': 'src/api-handlers/v1-route.ts'
    },
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outdir: 'api',
    packages: 'external'
  });

  console.log('API bundle build complete: api/well-known/x402.js & api/v1/[...route].js');
}

buildApi().catch(err => {
  console.error('API build failed:', err);
  process.exit(1);
});
