import { handleGatewayRequest } from '../server/gatewayHandler';

export default async function handler(req: any, res: any) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-payment, X-PAYMENT');
    return res.status(204).end();
  }

  const host = req.headers['host'] || 'relayx402.vercel.app';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const origin = `${protocol}://${host}`;

  let cleanPath = (req.url || '').split('?')[0];

  // If rewritten to [...route] directly without path preservation in req.url
  if (cleanPath === '/api/v1/[...route]' || cleanPath === '/v1/[...route]') {
    const rawPath = req.headers['x-matched-path'] || req.headers['x-invoke-path'] || '';
    if (rawPath) {
      cleanPath = rawPath.split('?')[0];
    }
  }

  const response = await handleGatewayRequest(
    req.method || 'POST',
    cleanPath,
    req.headers as Record<string, string>,
    req.body,
    origin
  );

  Object.entries(response.headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (response.body === null || response.body === undefined) {
    return res.status(response.status).end();
  }

  return res.status(response.status).json(response.body);
}
