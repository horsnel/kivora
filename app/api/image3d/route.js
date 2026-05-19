export const runtime = 'edge'

// ── Tripo3D API — 2,000 free credits on signup ──
// Sign up at https://platform.tripo3d.ai to get your API key
const TRIPO_API_BASE = 'https://api.tripo3d.ai/v2/openapi'
const TRIPO_API_KEY = process.env.TRIPO_API_KEY || ''

const POLL_INTERVAL = 3000  // 3s between polls
const MAX_POLL_TIME = 180000 // 3 min max wait
const MAX_POLLS = Math.ceil(MAX_POLL_TIME / POLL_INTERVAL)

/**
 * Poll a Tripo3D task until it reaches a terminal state.
 * Returns the task data object on success, throws on failure or timeout.
 *
 * Tripo3D task response shape:
 *   { code: 0, data: { task_id, status, output: { pbr_model, rendered_image, generated_image }, ... } }
 *   status: queued | running | success | failed
 *   output.pbr_model = GLB download URL  (type: "glb")
 *   output.rendered_image = webp preview (type: "webp")
 *   output.generated_image = text2image preview
 */
async function pollTask(taskId, phase = 'generation') {
  for (let i = 0; i < MAX_POLLS; i++) {
    const res = await fetch(`${TRIPO_API_BASE}/task/${taskId}`, {
      headers: { 'Authorization': `Bearer ${TRIPO_API_KEY}` },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Tripo3D poll error (${res.status}): ${text}`)
    }
    const data = await res.json()
    const task = data.data

    if (!task) {
      throw new Error(`Tripo3D unexpected response: ${JSON.stringify(data)}`)
    }

    // Tripo3D statuses: queued, running, success, failed
    if (task.status === 'success') return task
    if (task.status === 'failed') {
      const msg = task.error || 'Generation failed'
      throw new Error(`Tripo3D ${phase} failed: ${msg}`)
    }

    // Still queued or running — wait and retry
    await new Promise(r => setTimeout(r, POLL_INTERVAL))
  }
  throw new Error(`Tripo3D ${phase} timed out after ${MAX_POLL_TIME / 1000}s`)
}

/**
 * Generate a high-quality preview image using Pollinations AI.
 * This gives us a beautiful 2D render while the 3D model generates.
 * Falls back gracefully if Pollinations is unavailable.
 */
async function generatePreviewImage(prompt) {
  try {
    const enhancedPrompt = `${prompt}, 3D render, professional product photography, studio lighting, clean background, isometric view, high detail`
    const encodedPrompt = encodeURIComponent(enhancedPrompt)
    const params = new URLSearchParams({
      width: '1024',
      height: '1024',
      model: 'flux',
      nologo: 'true',
      enhance: 'true',
    })
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`

    const imgResponse = await fetch(imageUrl, {
      method: 'GET',
      headers: { 'Accept': 'image/*' },
      signal: AbortSignal.timeout(30000), // 30s timeout for preview
    })

    if (imgResponse.ok) {
      const imgBuffer = await imgResponse.arrayBuffer()
      const contentType = imgResponse.headers.get('content-type') || 'image/jpeg'
      const bytes = new Uint8Array(imgBuffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)
      return `data:${contentType};base64,${base64}`
    }
  } catch (err) {
    console.warn('[image3d] Preview image generation failed:', err.message)
  }
  return null
}

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

    if (!TRIPO_API_KEY) {
      return Response.json(
        { error: '3D generation is not configured yet. Set TRIPO_API_KEY to enable it.' },
        { status: 503 }
      )
    }

    // ── Step 1: Create text-to-model task ──
    const createRes = await fetch(`${TRIPO_API_BASE}/task`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TRIPO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'text_to_model',
        prompt: prompt.trim().slice(0, 600),
      }),
    })

    if (!createRes.ok) {
      const errText = await createRes.text()
      console.error('[image3d] Create task error:', createRes.status, errText)

      if (createRes.status === 402) {
        return Response.json(
          { error: '3D generation credits exhausted. Please try again later.' },
          { status: 402 }
        )
      }
      if (createRes.status === 429) {
        return Response.json(
          { error: '3D generation is busy. Please wait a moment and try again.' },
          { status: 429 }
        )
      }
      return Response.json(
        { error: `Failed to start 3D generation (${createRes.status})` },
        { status: 502 }
      )
    }

    const createData = await createRes.json()
    // Tripo3D returns { data: { task_id: "..." } } — NOT data.id
    const taskId = createData.data?.task_id || createData.data?.id

    if (!taskId) {
      console.error('[image3d] Unexpected create response:', JSON.stringify(createData))
      return Response.json({ error: 'No task ID returned from Tripo3D.' }, { status: 502 })
    }

    // ── Step 2: Generate a quick 2D preview while the 3D model processes ──
    // This gives the user something beautiful to look at immediately
    const previewBase64 = await generatePreviewImage(prompt.trim())

    // ── Step 3: Poll until model is generated ──
    const modelTask = await pollTask(taskId, 'model generation')

    // Parse the output — Tripo3D returns:
    //   output.pbr_model       → GLB file URL (already textured)
    //   output.rendered_image  → webp preview image
    //   output.generated_image → text-to-image preview
    //   thumbnail              → same as rendered_image
    const output = modelTask.output || {}
    const glbUrl = output.pbr_model || null
    // Prefer our Pollinations preview (higher quality) over Tripo3D's thumbnail
    const tripoThumbnail = modelTask.thumbnail || output.rendered_image || output.generated_image || null
    const thumbnailUrl = previewBase64 || tripoThumbnail
    const isPollinationsPreview = !!previewBase64

    if (!glbUrl) {
      // Model generated but no GLB URL — return preview image if available
      if (thumbnailUrl) {
        return Response.json({
          glbUrl: null,
          thumbnailUrl,
          tripoThumbnail,
          prompt: prompt.trim(),
          hasTexture: false,
          isPollinationsPreview,
          error: '3D model generated but GLB download unavailable. Showing preview image.',
        })
      }
      return Response.json({ error: 'No 3D model data returned.' }, { status: 502 })
    }

    // ── Return result ──
    // text_to_model already produces a PBR-textured GLB, no separate convert step needed
    return Response.json({
      glbUrl,
      thumbnailUrl,
      tripoThumbnail,
      prompt: prompt.trim(),
      hasTexture: !!output.pbr_model,
      isPollinationsPreview,
    })
  } catch (err) {
    console.error('[image3d] Error:', err)
    const message = err?.message || '3D generation failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
