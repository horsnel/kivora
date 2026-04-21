export const runtime = 'edge'
import { supabaseAdmin } from '@/lib/supabase'
import { groq, MODEL_FAST } from '@/lib/groq'

export async function POST(req) {
  try {
    if (!supabaseAdmin || !groq) {
      return Response.json({ error: 'Service not configured' }, { status: 503 })
    }
    const { topic, category } = await req.json()
    if (!topic) return Response.json({ context: null, pages: [] })

    const { data: pages } = await supabaseAdmin
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

    const chat = await groq.chat.completions.create({
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
    return Response.json({ context: null, pages: [] })
  }
}
