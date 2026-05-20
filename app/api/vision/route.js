export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'
import { groq } from '@/lib/groq'

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }

  try {
    const { image, prompt = 'Describe this image in detail.' } = await req.json()

    if (!image) {
      return Response.json({ error: 'image is required (base64 data URL or image URL)' }, { status: 400 })
    }

    if (!groq) {
      return Response.json({ error: 'Vision service not configured' }, { status: 503 })
    }

    let imageUrl = image

    // If it's a URL (not base64), fetch it and convert to base64
    if (image.startsWith('http')) {
      try {
        const imgRes = await fetch(image)
        if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`)
        const buffer = await imgRes.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
        imageUrl = `data:${contentType};base64,${btoa(binary)}`
      } catch (fetchErr) {
        console.error('[vision] Failed to fetch image URL:', fetchErr)
        return Response.json({ error: 'Failed to fetch the image URL' }, { status: 400 })
      }
    }

    // Call Groq Vision API
    const chat = await groq.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 1024,
    })

    const description = chat.choices[0]?.message?.content || 'No description generated.'

    return Response.json({ description, model: VISION_MODEL })
  } catch (err) {
    console.error('[vision]', err)
    return Response.json({ error: err.message || 'Vision analysis failed' }, { status: 500 })
  }
}
