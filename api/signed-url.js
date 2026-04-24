export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const agentId = process.env.ELEVENLABS_AGENT_ID
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!agentId || !apiKey) {
    console.error('Missing ELEVENLABS_AGENT_ID or ELEVENLABS_API_KEY')
    return res.status(500).json({ error: 'Server not configured' })
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { 'xi-api-key': apiKey } }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error('ElevenLabs get-signed-url failed:', response.status, text)
      return res.status(500).json({ error: 'Failed to get signed URL' })
    }

    const body = await response.json()
    res.status(200).json({ signedUrl: body.signed_url })
  } catch (err) {
    console.error('Signed URL error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}