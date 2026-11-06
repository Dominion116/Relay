import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { GATEWAY_HEADERS, handleGatewayRequest, isGatewayPath, type GatewayResponse } from './gatewayHandler';
import { MAX_REQUEST_BYTES } from '../shared/validation';

function configureGateway(server: ViteDevServer | PreviewServer) {
  server.middlewares.use((req, res, next) => {
    const path = req.url || '/';
    if (!isGatewayPath(path)) return next();

    const send = (response: GatewayResponse) => {
      if (res.writableEnded || res.destroyed) return;
      res.writeHead(response.status, response.headers);
      res.end(response.body == null || req.method === 'HEAD' ? undefined : JSON.stringify(response.body));
    };
    const reject = (status: number, error: string) => send({ status, headers: GATEWAY_HEADERS, body: { error } });
    const forward = async (body?: string) => {
      try {
        const host = req.headers.host || 'localhost:5173';
        send(await handleGatewayRequest(req.method || 'GET', path, req.headers, body, process.env.GATEWAY_ORIGIN || `http://${host}`));
      } catch {
        reject(500, 'Gateway Internal Error');
      }
    };

    if (req.method !== 'POST') {
      req.resume();
      void forward();
      return;
    }
    if (Number(req.headers['content-length'] || 0) > MAX_REQUEST_BYTES) {
      req.resume();
      reject(413, 'Request body exceeds 16 KiB.');
      return;
    }

    const chunks: Buffer[] = [];
    let bytes = 0;
    let rejected = false;
    const timer = setTimeout(() => {
      rejected = true;
      chunks.length = 0;
      reject(408, 'Request body timed out.');
      req.resume();
    }, 10_000);
    timer.unref();
    req.on('data', (chunk: Buffer | string) => {
      if (rejected) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > MAX_REQUEST_BYTES) {
        rejected = true;
        chunks.length = 0;
        clearTimeout(timer);
        reject(413, 'Request body exceeds 16 KiB.');
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => {
      clearTimeout(timer);
      if (!rejected) void forward(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', () => { clearTimeout(timer); rejected = true; reject(400, 'Request body could not be read.'); });
    req.on('aborted', () => { clearTimeout(timer); rejected = true; chunks.length = 0; });
  });
}

export function relayGatewayPlugin(): Plugin {
  return { name: 'relay-gateway-plugin', configureServer: configureGateway, configurePreviewServer: configureGateway };
}
