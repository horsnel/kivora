export const runtime = 'edge'
import { groq, MODEL, groqChat } from '@/lib/groq'
import { getSupabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/ratelimit'

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }

  try {
    const admin = getSupabaseAdmin()
    if (!admin || !groq) {
      return Response.json({ error: 'Service not configured' }, { status: 503 })
    }
    const { messages, sessionId, userId } = await req.json()
    if (!messages?.length) {
      return Response.json({ error: 'messages required' }, { status: 400 })
    }

    // userId is trusted from client — client validates auth before calling.
    // This avoids cookies() which doesn't work on CloudFlare Edge.

    // Query wiki for context on latest message
    const lastMsg = messages[messages.length - 1]?.content || ''
    let wikiContext = ''
    if (lastMsg.length > 10) {
      try {
        const { data: pages } = await admin
          .from('wiki_pages')
          .select('title, content')
          .or(`title.ilike.%${lastMsg.slice(0, 40)}%,content.ilike.%${lastMsg.slice(0, 40)}%`)
          .not('slug', 'like', 'article-%')
          .limit(3)
        if (pages?.length) {
          wikiContext = pages.map(p => `${p.title}: ${p.content.slice(0, 300)}`).join('\n\n')
        }
      } catch (_) {}
    }

    const chat = await groqChat({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `You are Kivora's AI assistant — direct, practical, globally minded.
You help builders, developers, students, and entrepreneurs worldwide.
Core focus areas: AI tools, business automation, making money online, coding, learning, research.
You're aware that many users are in Africa or the global diaspora — be sensitive to cost, tool availability, and local context.
Be concise. Be honest. Never make up facts. If you don't know something, say so.

FORMATTING RULES — use rich markdown to make responses clear and scannable:
- Use **bold** for key terms, important concepts, and emphasis
- Use tables for comparisons, feature lists, pricing breakdowns, pros/cons — always prefer a table when comparing items
- Use code blocks with language tags (e.g. \`\`\`python, \`\`\`javascript) for any code, commands, or config
- Use numbered lists for step-by-step instructions
- Use bullet lists for feature lists, options, or collections of items
- Use > blockquotes for important notes, warnings, or callouts (prefix with [!note], [!tip], [!warning], or [!caution] for styled callouts)
- Use ## and ### headings to break long responses into clear sections
- Use horizontal rules (---) to separate major sections in long responses
- For tool recommendations, include a table with columns: Tool, Cost, Best For
${wikiContext ? `\nRelevant platform knowledge:\n${wikiContext}` : ''}`
        },
        ...messages.slice(-12)
      ]
    })

    const reply = chat.choices[0].message.content

    // Save session if logged in
    if (userId && sessionId) {
      try {
        const { data: session } = await admin
          .from('chat_sessions')
          .select('messages')
          .eq('id', sessionId)
          .eq('user_id', userId)
          .single()

        await admin.from('chat_sessions').upsert({
          id: sessionId,
          user_id: userId,
          messages: [
            ...(session?.messages || []),
            ...messages.slice(-1),
            { role: 'assistant', content: reply }
          ],
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
      } catch (_) {}
    }

    return Response.json({ reply })
  } catch (err) {
    console.error('[chat]', err)
    return Response.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
