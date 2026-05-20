export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ error: 'Missing code' });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: 'postmessage',
      grant_type: 'authorization_code',
    }),
  });
  const data = await response.json();
  return res.status(response.ok ? 200 : 400).json(data);
}
