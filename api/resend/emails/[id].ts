export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const RESEND_API_KEY =
      process.env.VITE_RESEND_API_KEY ||
      process.env.RESEND_API_KEY ||
      '';

    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Missing email ID' });
    }

    const response = await fetch(`https://api.resend.com/emails/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch email from Resend' });
  }
}
