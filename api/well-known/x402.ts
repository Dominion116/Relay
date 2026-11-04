import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleGatewayRequest } from '../../src/server/gatewayHandler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const host = req.headers['host'] || 'relay.base.org';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const origin = `${protocol}://${host}`;

  const response = await handleGatewayRequest(
    req.method || 'GET',
    '/.well-known/x402',
    req.headers as Record<string, string>,
    req.body,
    origin
  );

  Object.entries(response.headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(response.status).json(response.body);
}
