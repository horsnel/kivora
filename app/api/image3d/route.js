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
 * Returns the task object on success, throws on failure or timeout.
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
    const taskId = createData.data?.id

    if (!taskId) {
      return Response.json({ error: 'No task ID returned from Tripo3D.' }, { status: 502 })
    }

    // ── Step 2: Poll until model is generated ──
    const modelTask = await pollTask(taskId, 'model generation')

    // The model output contains various format URLs
    const modelData = modelTask.output
    let glbUrl = null
    let thumbnailUrl = modelTask.thumbnail || null

    if (modelData) {
      // Tripo3D returns model URLs — try GLB first
      glbUrl = modelData.model || modelData.glb || modelData.rendered_image
      // If there's a PBR model, prefer it
      if (modelData.pbr_model) {
        glbUrl = modelData.pbr_model
      }
    }

    if (!glbUrl) {
      // Fallback: check if rendered_image exists (preview)
      if (modelData?.rendered_image) {
        return Response.json({
          glbUrl: null,
          thumbnailUrl: modelData.rendered_image,
          prompt: prompt.trim(),
          hasTexture: false,
          error: '3D model generated but GLB URL unavailable. Showing preview image.',
        })
      }
      return Response.json({ error: 'No 3D model data returned.' }, { status: 502 })
    }

    // ── Step 3: Try to convert to textured GLB (if not already PBR) ──
    // Tripo3D's text_to_model may return untextured model.
    // We can request a texture conversion for better quality.
    let finalGlbUrl = glbUrl
    let hasTexture = !!modelData.pbr_model

    if (!hasTexture && modelData.model) {
      try {
        const textureRes = await fetch(`${TRIPO_API_BASE}/task`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TRIPO_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'convert_model',
            model: modelData.model,
            format: 'GLB',
          }),
        })

        if (textureRes.ok) {
          const textureData = await textureRes.json()
          const textureTaskId = textureData.data?.id
          if (textureTaskId) {
            const textureTask = await pollTask(textureTaskId, 'texturing')
            if (textureTask.output?.model) {
              finalGlbUrl = textureTask.output.model
              hasTexture = true
            }
          }
        }
      } catch (texErr) {
        // Texture step failed — still return the model (untextured)
        console.warn('[image3d] Texturing step failed:', texErr.message)
      }
    }

    // ── Return result ──
    return Response.json({
      glbUrl: finalGlbUrl,
      thumbnailUrl,
      prompt: prompt.trim(),
      hasTexture,
    })
  } catch (err) {
    console.error('[image3d] Error:', err)
    const message = err?.message || '3D generation failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
