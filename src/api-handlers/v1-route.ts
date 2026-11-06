import { GATEWAY_HEADERS, handleGatewayRequest } from '../server/gatewayHandler';

export default async function handler(req: any, res: any) {
  try {
    const host = typeof req.headers.host === 'string' ? req.headers.host : 'relayx402.vercel.app';
    const origin = process.env.GATEWAY_ORIGIN || `https://${host}`;
    const response = await handleGatewayRequest(req.method || 'GET', req.url || '/', req.headers, req.body, origin);
    Object.entries(response.headers).forEach(([key, value]) => res.setHeader(key, value));
    if (response.body === null || response.body === undefined || req.method === 'HEAD') return res.status(response.status).end();
    return res.status(response.status).json(response.body);
  } catch {
    Object.entries(GATEWAY_HEADERS).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(500).json({ error: 'Gateway Internal Error' });
  }
}
