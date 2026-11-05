import { handleGatewayRequest } from '../server/gatewayHandler';

export default async function handler(req: any, res: any) {
  const host = req.headers['host'] || 'relayx402.vercel.app';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const origin = `${protocol}://${host}`;

  const cleanPath = (req.url || '').split('?')[0];

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
