import type { Plugin } from 'vite';
import { handleGatewayRequest } from './gatewayHandler';

export function relayGatewayPlugin(): Plugin {
  return {
    name: 'relay-gateway-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        const cleanPath = url.split('?')[0];

        const isGatewayRoute =
          cleanPath.startsWith('/v1/') ||
          cleanPath.startsWith('/api/v1/') ||
          cleanPath === '/.well-known/x402' ||
          cleanPath === '/.well-known/x402.json';

        if (!isGatewayRoute) {
          return next();
        }

        // Collect request body
        const chunks: Buffer[] = [];
        req.on('data', chunk => chunks.push(Buffer.from(chunk)));
        req.on('end', async () => {
          const rawBody = Buffer.concat(chunks).toString('utf-8');
          try {
            const host = req.headers['host'] || 'localhost:5173';
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            const origin = `${protocol}://${host}`;

            const response = await handleGatewayRequest(
              req.method || 'GET',
              cleanPath,
              req.headers as Record<string, string>,
              rawBody,
              origin
            );

            res.writeHead(response.status, response.headers);
            if (response.body !== null && response.body !== undefined) {
              res.end(typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2));
            } else {
              res.end();
            }
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Gateway Internal Error', message: err.message }));
          }
        });
      });
    }
  };
}
