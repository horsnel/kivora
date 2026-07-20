export const runtime = 'edge' 
import { createClient } from '@supabase/supabase-js'
import { groq, MODEL_FAST, groqChat, GroqError, getPrimaryClientAsync, setGeminiApiKey } from '@/lib/groq'
import { getEnvVar } from '@/lib/cfEnv'

export async function POST(req) {
  try {
    const groqKey = await getEnvVar('GROQ_API_KEY')
    const geminiKey = await getEnvVar('GEMINI_API_KEY')
    setGeminiApiKey(geminiKey)
    const groqClient = await getPrimaryClientAsync(groqKey)
    const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
    const supaKey = await getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
    const admin = supaUrl && supaKey ? createClient(supaUrl, supaKey) : null
    if (!groqClient || !admin) {
      return Response.json({ error: 'Service not configured' }, { status: 503 })
    }
    const { topic, category } = await req.json()
    if (!topic) return Response.json({ context: null, pages: [] })

    const { data: pages } = await admin
      .from('wiki_pages')
      .select('slug, title, content')
      .or(`title.ilike.%${topic.slice(0, 40)}%,content.ilike.%${topic.slice(0, 40)}%`)
      .not('slug', 'like', 'article-%')
      .limit(5)

    if (!pages?.length) {
      return Response.json({ context: null, pages: [] })
    }

    const dump = pages
      .map(p => `### ${p.title}\n${p.content.slice(0, 500)}`)
      .join('\n\n---\n\n')

    const chat = await groqChat({
      model: MODEL_FAST,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You synthesize wiki knowledge into brief editorial briefings.
Be factual, practical, and concise. Max 250 words.`
        },
        {
          role: 'user',
          content: `Topic: "${topic}" (${category || 'general'})\n\nWiki pages:\n${dump}\n\nWrite a brief editorial briefing covering what's already known about this topic from our platform.`
        }
      ]
    })

    return Response.json({
      context: chat.choices[0].message.content.trim(),
      pages: pages.map(p => ({ slug: p.slug, title: p.title }))
    })
  } catch (err) {
    console.error('[wiki/query]', err)
    if (err instanceof GroqError && err.code === 'GROQ_QUOTA_EXCEEDED') {
      return Response.json({ error: 'Too many requests, try again later.', quotaExceeded: true }, { status: 429 })
    }
    return Response.json({ context: null, pages: [] })
  }
}
