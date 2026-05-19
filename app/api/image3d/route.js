export const runtime = 'edge'

export async function POST(req) {
  try {
    const body = await req.json()
    const { prompt } = body

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return Response.json(
        { error: 'Prompt is required and must be a non-empty string.' },
        { status: 400 }
      )
    }

    // 3D generation stub — coming soon in Pro mode
    // Future: Meshy API integration
    return Response.json({
      message: '3D generation is coming soon in Pro mode!',
      preview: true
    })
  } catch (err) {
    console.error('[image3d] Error:', err)
    return Response.json({ error: err?.message || 'Request failed.' }, { status: 500 })
  }
}
