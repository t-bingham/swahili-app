export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  const { refresh_token } = req.body ?? {};
  if (!refresh_token) return res.status(400).json({ error: 'Missing refresh_token' });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  return res.status(response.ok ? 200 : 400).json(data);
}
