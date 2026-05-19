export const runtime = 'edge'
import { groq, MODEL, VISION_MODEL, groqChat, ALLOWED_MODELS } from '@/lib/groq'
import { getSupabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/ratelimit'

const ALLOWED_MODEL_IDS = ALLOWED_MODELS.map(m => m.id)

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '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'

const tools = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information, real-time data, news, prices, facts, or anything that requires up-to-date knowledge. Use this when the user asks about current events, prices, recent news, weather, or any time-sensitive information.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant information'
          }
        },
        required: ['query']
      }
    }
  }
]

const SEARCH_TOOL_INSTRUCTION = `

You have access to a web_search tool. USE IT when the user asks about:
- Current prices, exchange rates, stock prices
- Recent news or events
- Weather, sports results
- Anything that changes over time
- Comparisons of current tools/software/pricing
DO NOT use search for general knowledge, coding help, math, or creative writing.`

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
    const { messages, sessionId, userId, model: requestedModel, systemPrompt } = await req.json()
    if (!messages?.length) {
      return Response.json({ error: 'messages required' }, { status: 400 })
    }

    // Validate model — fall back to default if invalid or not provided
    let model = MODEL
    if (requestedModel && ALLOWED_MODEL_IDS.includes(requestedModel)) {
      model = requestedModel
    }

    // Check if the last user message contains an image attachment
    const lastUserMsg = messages[messages.length - 1]
    let hasImage = false
    let imageBase64 = null
    let imageMediaUrl = null

    if (lastUserMsg?.role === 'user' && typeof lastUserMsg.content === 'string') {
      // Detect [Image: filename] prefix followed by base64 data
      const imageMatch = lastUserMsg.content.match(/^\[Image: .+?\]\n(data:image\/[^;]+;base64,[\s\S]+)$/)
      if (imageMatch) {
        hasImage = true
        imageBase64 = imageMatch[1]
      }
    }

    // userId is trusted from client — client validates auth before calling.
    // This avoids cookies() which doesn't work on CloudFlare Edge.

    // Query wiki for context on latest message
    const lastMsg = messages[messages.length - 1]?.content || ''
    let wikiContext = ''
    // Only query wiki if no image (skip expensive DB query for image messages)
    if (!hasImage && lastMsg.length > 10) {
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

    // Build messages array for the API call
    let apiMessages

    if (hasImage) {
      // Use vision model for image messages
      // Build the content as a content array with text + image_url
      const textContent = lastUserMsg.content.replace(/^\[Image: .+?\]\ndata:image\/[^;]+;base64,[\s\S]+$/, '').trim()
      apiMessages = [
        {
          role: 'system',
          content: `${systemPrompt ? `Additional instructions from the user: ${systemPrompt}\n\n` : ''}You are Kivora's AI assistant — direct, practical, globally minded.
You help builders, developers, students, and entrepreneurs worldwide.
Core focus areas: AI tools, business automation, making money online, coding, learning, research.
You're aware that many users are in Africa or the global diaspora — be sensitive to cost, tool availability, and local context.
Be concise. Be honest. Never make up facts. If you don't know something, say so.

The user has attached an image. Describe what you see and answer any questions about it.
Use markdown formatting for clarity.`
        },
        ...messages.slice(0, -1).slice(-12),
        {
          role: 'user',
          content: [
            { type: 'text', text: textContent || 'Please describe this image in detail.' },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }
      ]
      model = VISION_MODEL
    } else {
      apiMessages = [
        {
          role: 'system',
          content: `${systemPrompt ? `Additional instructions from the user: ${systemPrompt}\n\n` : ''}You are Kivora's AI assistant — direct, practical, globally minded.
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
${wikiContext ? `\nRelevant platform knowledge:\n${wikiContext}` : ''}${SEARCH_TOOL_INSTRUCTION}`
        },
        ...messages.slice(-12)
      ]
    }

    // For image messages, don't use tools (vision model doesn't support them)
    const useTools = !hasImage

    const chat = await groqChat({
      model,
      messages: apiMessages,
      ...(useTools ? { tools, tool_choice: 'auto' } : {})
    })

    const message = chat.choices[0].message

    // Handle tool calls — AI decides when to search
    if (useTools && message.tool_calls && message.tool_calls.length > 0) {
      let searchResults = null
      let searchQuery = ''

      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name === 'web_search') {
          const args = JSON.parse(toolCall.function.arguments)
          searchQuery = args.query

          // Call Tavily search
          try {
            const searchResponse = await fetch('https://api.tavily.com/search', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${TAVILY_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                query: args.query,
                search_depth: 'basic',
                include_answer: true,
                max_results: 5
              })
            })

            if (searchResponse.ok) {
              searchResults = await searchResponse.json()
            }
          } catch (searchErr) {
            console.error('[chat] Tavily search error:', searchErr)
          }
        }
      }

      // Build tool response message
      const toolMessages = [
        message,  // The assistant's tool_call message
        {
          role: 'tool',
          tool_call_id: message.tool_calls[0].id,
          content: searchResults
            ? JSON.stringify({
                answer: searchResults.answer,
                results: searchResults.results?.map(r => ({
                  title: r.title,
                  url: r.url,
                  content: r.content?.slice(0, 500)
                }))
              })
            : 'Search failed. Respond based on your existing knowledge.'
        }
      ]

      // Make a second call with the search results
      const finalChat = await groqChat({
        model,
        messages: [...apiMessages, ...toolMessages],
        tools,
        tool_choice: 'none'  // Force the model to respond, not call more tools
      })

      const reply = finalChat.choices[0].message.content

      // Save session if logged in — store only the final reply (no tool_call messages)
      if (userId && sessionId) {
        try {
          const { data: session } = await admin
            .from('chat_sessions')
            .select('messages')
            .eq('id', sessionId)
            .eq('user_id', userId)
            .single()

          const storedUserMsg = { ...messages.slice(-1)[0] }

          await admin.from('chat_sessions').upsert({
            id: sessionId,
            user_id: userId,
            messages: [
              ...(session?.messages || []),
              storedUserMsg,
              { role: 'assistant', content: reply }
            ],
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' })
        } catch (_) {}
      }

      // Return with search metadata so the UI can show a search indicator
      return Response.json({
        reply,
        model,
        searchUsed: true,
        searchQuery
      })
    }

    // Normal response, no search needed
    const reply = message.content

    // Save session if logged in — store the original user message format (without base64 for images)
    if (userId && sessionId) {
      try {
        const { data: session } = await admin
          .from('chat_sessions')
          .select('messages')
          .eq('id', sessionId)
          .eq('user_id', userId)
          .single()

        // For image messages, store a simplified version without the base64 data
        let storedUserMsg = { ...messages.slice(-1)[0] }
        if (hasImage) {
          const imageFileName = lastUserMsg.content.match(/^\[Image: (.+?)\]/)?.[1] || 'image'
          const textOnly = lastUserMsg.content.replace(/^\[Image: .+?\]\ndata:image\/[^;]+;base64,[\s\S]+$/, '').trim()
          storedUserMsg = { role: 'user', content: `[Image: ${imageFileName}]${textOnly ? '\n' + textOnly : ''}` }
        }

        await admin.from('chat_sessions').upsert({
          id: sessionId,
          user_id: userId,
          messages: [
            ...(session?.messages || []),
            storedUserMsg,
            { role: 'assistant', content: reply }
          ],
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
      } catch (_) {}
    }

    return Response.json({ reply, model, searchUsed: false })
  } catch (err) {
    console.error('[chat]', err)
    return Response.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
