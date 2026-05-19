export const runtime = 'edge'

const MESHY_API_BASE = 'https://api.meshy.ai/openapi/v2/text-to-3d'
const MESHY_API_KEY = process.env.MESHY_API_KEY || ''

const POLL_INTERVAL = 3000  // 3s between polls
const MAX_POLL_TIME = 180000 // 3 min max wait per phase
const MAX_POLLS = Math.ceil(MAX_POLL_TIME / POLL_INTERVAL)

/**
 * Poll a Meshy task until it reaches a terminal state.
 * Returns the task object on SUCCEEDED, throws on FAILED or timeout.
 */
async function pollTask(taskId, phase = 'preview') {
  for (let i = 0; i < MAX_POLLS; i++) {
    const res = await fetch(`${MESHY_API_BASE}/${taskId}`, {
      headers: { 'Authorization': `Bearer ${MESHY_API_KEY}` },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Meshy poll error (${res.status}): ${text}`)
    }
    const task = await res.json()

    if (task.status === 'SUCCEEDED') return task
    if (task.status === 'FAILED') {
      const msg = task.task_error?.message || 'Generation failed'
      throw new Error(`Meshy ${phase} failed: ${msg}`)
    }

    // Still IN_PROGRESS or PENDING — wait and retry
    await new Promise(r => setTimeout(r, POLL_INTERVAL))
  }
  throw new Error(`Meshy ${phase} timed out after ${MAX_POLL_TIME / 1000}s`)
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { prompt, mode } = body

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return Response.json(
        { error: 'Prompt is required and must be a non-empty string.' },
        { status: 400 }
      )
    }

    if (!MESHY_API_KEY) {
      return Response.json(
        { error: '3D generation is not configured. Please set MESHY_API_KEY.' },
        { status: 503 }
      )
    }

    // ── Step 1: Create preview task (geometry) ──
    const previewRes = await fetch(MESHY_API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'preview',
        prompt: prompt.trim().slice(0, 600),
        ai_model: 'meshy-6',
        model_type: 'standard',
        output_formats: ['glb'],
        topology: 'triangle',
        target_polycount: 30000,
      }),
    })

    if (!previewRes.ok) {
      const errText = await previewRes.text()
      console.error('[image3d] Preview create error:', previewRes.status, errText)

      if (previewRes.status === 402) {
        return Response.json(
          { error: '3D generation credits exhausted. Please try again later or contact support.' },
          { status: 402 }
        )
      }
      if (previewRes.status === 429) {
        return Response.json(
          { error: '3D generation is busy. Please wait a moment and try again.' },
          { status: 429 }
        )
      }
      return Response.json(
        { error: `Failed to start 3D generation (${previewRes.status})` },
        { status: 502 }
      )
    }

    const previewData = await previewRes.json()
    const previewTaskId = previewData.id

    if (!previewTaskId) {
      return Response.json({ error: 'No task ID returned from Meshy.' }, { status: 502 })
    }

    // ── Step 2: Poll preview until done ──
    const previewTask = await pollTask(previewTaskId, 'preview')

    const previewGlbUrl = previewTask.model_urls?.glb
    const thumbnailUrl = previewTask.thumbnail_url

    // ── Step 3: Create refine task (textures) ──
    // We always refine to get a textured model — much better UX
    let refineGlbUrl = previewGlbUrl
    let refineThumbnailUrl = thumbnailUrl
    let refineTask = null

    try {
      const refineRes = await fetch(MESHY_API_BASE, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MESHY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'refine',
          preview_task_id: previewTaskId,
          enable_pbr: true,
        }),
      })

      if (refineRes.ok) {
        const refineData = await refineRes.json()
        if (refineData.id) {
          refineTask = await pollTask(refineData.id, 'refine')
          refineGlbUrl = refineTask.model_urls?.glb || previewGlbUrl
          refineThumbnailUrl = refineTask.thumbnail_url || thumbnailUrl
        }
      } else {
        // Refine failed — still return the preview model (untextured but usable)
        console.warn('[image3d] Refine creation failed, returning preview model')
      }
    } catch (refineErr) {
      // Refine polling failed — still return preview
      console.warn('[image3d] Refine polling failed:', refineErr.message)
    }

    // ── Return result ──
    return Response.json({
      glbUrl: refineGlbUrl,
      thumbnailUrl: refineThumbnailUrl,
      prompt: prompt.trim(),
      hasTexture: !!refineTask,
      creditsUsed: (previewTask.consumed_credits || 20) + (refineTask?.consumed_credits || 10),
    })
  } catch (err) {
    console.error('[image3d] Error:', err)
    const message = err?.message || '3D generation failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
