export const runtime = 'edge'

// ── 3D Image Generation: hitem3d (primary) → Tripo3D (fallback) ──
//
// hitem3d API: https://api.hitem3d.ai
//   - Auth: Basic base64(access_key:secret_key) → get accessToken
//   - POST /open-api/v1/submit-task (image-to-3D, multipart/form-data)
//   - GET  /open-api/v1/query-task?task_id=xxx (poll until success)
//   - Returns GLB model URL + cover image URL
//
// Tripo3D API (fallback): https://api.tripo3d.ai/v2/openapi
//   - POST /task (text-to-model)
//   - GET  /task/{id} (poll until success)
//   - Returns GLB + rendered image

import { getEnvVar } from '@/lib/cfEnv'

const HITEM3D_API_BASE = 'https://api.hitem3d.ai'

const TRIPO_API_BASE = 'https://api.tripo3d.ai/v2/openapi'

const POLL_INTERVAL = 3000   // 3s between polls
const MAX_POLL_TIME = 180000 // 3 min max wait
const MAX_POLLS = Math.ceil(MAX_POLL_TIME / POLL_INTERVAL)

// Helper to convert ArrayBuffer to base64 efficiently
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk)
  }
  return btoa(binary)
}

// ── hitem3d Auth ──

async function getHitem3dToken() {
  // Basic auth: base64(access_key:secret_key)
  const accessKey = await getEnvVar('HITEM3D_ACCESS_KEY')
  const secretKey = await getEnvVar('HITEM3D_SECRET_KEY')
  if (!accessKey || !secretKey) throw new Error('hitem3d API keys not configured')
  const credentials = btoa(`${accessKey}:${secretKey}`)
  const res = await fetch(`${HITEM3D_API_BASE}/open-api/v1/auth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`hitem3d auth error ${res.status}: ${text}`)
  }
  const data = await res.json()
  if (data.code !== 200 && data.code !== '200') {
    throw new Error(`hitem3d auth failed: ${data.msg || JSON.stringify(data)}`)
  }
  return data.data?.accessToken || data.data?.access_token
}

// ── hitem3d Task Creation (Image-to-3D) ──
// hitem3d requires an image input — we generate one from the prompt first

async function generatePreviewForHitem(prompt) {
  // Use Pollinations to generate a preview image from the prompt
  const pollApiKey = await getEnvVar('POLLINATIONS_API_KEY')
  const enhancedPrompt = `${prompt}, 3D render, isometric view, clean white background, studio lighting, high detail`
  const encodedPrompt = encodeURIComponent(enhancedPrompt)
  const params = new URLSearchParams({
    width: '1024', height: '1024',
    model: 'flux', nologo: 'true',
  })
  if (pollApiKey) params.set('key', pollApiKey)

  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`
  const imgRes = await fetch(imageUrl, { headers: { 'Accept': 'image/*' } })

  if (!imgRes.ok) {
    throw new Error(`Preview image generation failed (${imgRes.status})`)
  }
  return await imgRes.blob()
}

async function submitHitem3dTask(accessToken, imageBlob) {
  // hitem3d uses multipart/form-data
  const formData = new FormData()
  formData.append('request_type', '3')           // 3 = geometry+texture
  formData.append('model', 'hitem3dv2.1')        // Latest model
  formData.append('resolution', '1536fast')       // Fast resolution
  formData.append('images', imageBlob, 'image.png')

  const res = await fetch(`${HITEM3D_API_BASE}/open-api/v1/submit-task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`hitem3d submit error ${res.status}: ${text}`)
  }
  const data = await res.json()
  if (data.code !== 200 && data.code !== '200') {
    throw new Error(`hitem3d submit failed: ${data.msg || JSON.stringify(data)}`)
  }
  return data.data?.task_id
}

async function pollHitem3dTask(accessToken, taskId) {
  for (let i = 0; i < MAX_POLLS; i++) {
    const res = await fetch(`${HITEM3D_API_BASE}/open-api/v1/query-task?task_id=${encodeURIComponent(taskId)}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`hitem3d poll error ${res.status}: ${text}`)
    }
    const data = await res.json()
    const task = data.data

    if (!task) {
      throw new Error(`hitem3d unexpected response: ${JSON.stringify(data)}`)
    }

    if (task.state === 'success') return task
    if (task.state === 'failed') {
      throw new Error(`hitem3d generation failed: ${task.msg || 'unknown error'}`)
    }

    // Still processing (created, queueing, processing) — wait and retry
    await new Promise(r => setTimeout(r, POLL_INTERVAL))
  }
  throw new Error(`hitem3d timed out after ${MAX_POLL_TIME / 1000}s`)
}

async function generateWithHitem3d(prompt) {
  // Step 1: Get access token (throws if keys not configured)
  const accessToken = await getHitem3dToken()

  // Step 2: Generate preview image from prompt (hitem3d needs image input)
  const imageBlob = await generatePreviewForHitem(prompt.trim())

  // Step 3: Submit 3D generation task
  const taskId = await submitHitem3dTask(accessToken, imageBlob)
  if (!taskId) throw new Error('hitem3d returned no task ID')

  // Step 4: Poll until done
  const result = await pollHitem3dTask(accessToken, taskId)

  return {
    glbUrl: result.url || null,
    thumbnailUrl: result.cover_url || null,
    provider: 'hitem3d',
    model: 'hitem3dv2.1',
    prompt: prompt.trim(),
    hasTexture: true,
  }
}

// ── Tripo3D (Fallback) ──

async function pollTripoTask(taskId, phase = 'generation') {
  const tripoApiKey = await getEnvVar('TRIPO_API_KEY')
  for (let i = 0; i < MAX_POLLS; i++) {
    const res = await fetch(`${TRIPO_API_BASE}/task/${taskId}`, {
      headers: { 'Authorization': `Bearer ${tripoApiKey}` },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Tripo3D poll error (${res.status}): ${text}`)
    }
    const data = await res.json()
    const task = data.data
    if (!task) throw new Error(`Tripo3D unexpected response: ${JSON.stringify(data)}`)
    if (task.status === 'success') return task
    if (task.status === 'failed') throw new Error(`Tripo3D ${phase} failed: ${task.error || 'unknown'}`)
    await new Promise(r => setTimeout(r, POLL_INTERVAL))
  }
  throw new Error(`Tripo3D ${phase} timed out after ${MAX_POLL_TIME / 1000}s`)
}

async function generateWithTripo(prompt) {
  const tripoApiKey = await getEnvVar('TRIPO_API_KEY')
  if (!tripoApiKey) {
    throw new Error('Tripo3D API key not configured')
  }

  // Create text-to-model task
  const createRes = await fetch(`${TRIPO_API_BASE}/task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tripoApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'text_to_model',
      prompt: prompt.trim().slice(0, 600),
    }),
  })

  if (!createRes.ok) {
    const errText = await createRes.text()
    if (createRes.status === 402) throw new Error('Tripo3D credits exhausted')
    if (createRes.status === 429) throw new Error('Tripo3D rate limited')
    throw new Error(`Tripo3D create error (${createRes.status}): ${errText}`)
  }

  const createData = await createRes.json()
  const taskId = createData.data?.task_id || createData.data?.id
  if (!taskId) throw new Error('Tripo3D returned no task ID')

  // Generate a quick 2D preview while the 3D model processes
  const previewBase64 = await generatePollinationsPreview(prompt.trim())

  // Poll until model is generated
  const modelTask = await pollTripoTask(taskId, 'model generation')
  const output = modelTask.output || {}
  const glbUrl = output.pbr_model || null
  const tripoThumbnail = modelTask.thumbnail || output.rendered_image || output.generated_image || null
  const thumbnailUrl = previewBase64 || tripoThumbnail

  return {
    glbUrl,
    thumbnailUrl,
    tripoThumbnail,
    provider: 'tripo',
    model: 'tripo3d',
    prompt: prompt.trim(),
    hasTexture: !!output.pbr_model,
    isPollinationsPreview: !!previewBase64,
  }
}

// ── Pollinations Preview (for Tripo fallback) ──

async function generatePollinationsPreview(prompt) {
  try {
    const pollApiKey = await getEnvVar('POLLINATIONS_API_KEY')
    const enhancedPrompt = `${prompt}, 3D render, professional product photography, studio lighting, clean background, isometric view, high detail`
    const encodedPrompt = encodeURIComponent(enhancedPrompt)
    const params = new URLSearchParams({
      width: '1024', height: '1024',
      model: 'flux', nologo: 'true',
    })
    if (pollApiKey) params.set('key', pollApiKey)

    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?${params.toString()}`
    const imgRes = await fetch(imageUrl, {
      headers: { 'Accept': 'image/*' },
      signal: AbortSignal.timeout(30000),
    })

    if (imgRes.ok) {
      const imgBuffer = await imgRes.arrayBuffer()
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
      const base64 = arrayBufferToBase64(imgBuffer)
      return `data:${contentType};base64,${base64}`
    }
  } catch (err) {
    console.warn('[image3d] Preview image failed:', err.message)
  }
  return null
}

// ── Main Handler ──

export async function POST(req) {
  try {
    const body = await req.json()
    const { prompt } = body

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return Response.json({ error: 'Prompt is required and must be a non-empty string.' }, { status: 400 })
    }

    // ── Try hitem3d first (primary) ──
    try {
      const result = await generateWithHitem3d(prompt.trim())
      return Response.json(result)
    } catch (hitemErr) {
      const hitemMsg = hitemErr?.message || 'Unknown hitem3d error'
      console.warn(`[image3d] hitem3d failed, falling back to Tripo3D: ${hitemMsg}`)

      // ── Fallback to Tripo3D ──
      try {
        const fallbackResult = await generateWithTripo(prompt.trim())
        fallbackResult.hitem3dFallback = true
        fallbackResult.hitem3dError = hitemMsg
        return Response.json(fallbackResult)
      } catch (tripoErr) {
        const tripoMsg = tripoErr?.message || 'Unknown Tripo3D error'
        console.error(`[image3d] Both providers failed. hitem3d: ${hitemMsg} | Tripo: ${tripoMsg}`)
        return Response.json(
          {
            error: '3D generation failed from all providers.',
            details: {
              hitem3d: hitemMsg,
              tripo: tripoMsg,
            }
          },
          { status: 502 }
        )
      }
    }
  } catch (err) {
    console.error('[image3d] Error:', err)
    return Response.json({ error: err?.message || '3D generation failed.' }, { status: 500 })
  }
}
