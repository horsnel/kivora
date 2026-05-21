export const runtime = 'edge'
import { groq, MODEL, VISION_MODEL, groqChat, ALLOWED_MODELS } from '@/lib/groq'
import { getSupabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/ratelimit'
import { toolDefs, toolHandlers, TOOL_INSTRUCTIONS } from '@/lib/toolRegistry'

const ALLOWED_MODEL_IDS = ALLOWED_MODELS.map(m => m.id)

// ── Artifact Extraction ──
function extractArtifacts(text) {
  const artifacts = []
  const regex = /<artifact\s+type="(\w+)"\s+title="([^"]*)">([\s\S]*?)<\/artifact>/g
  let match
  while ((match = regex.exec(text)) !== null) {
    artifacts.push({ type: match[1], title: match[2], code: match[3].trim() })
  }
  return artifacts
}

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

    let model = MODEL
    if (requestedModel && ALLOWED_MODEL_IDS.includes(requestedModel)) {
      model = requestedModel
    }

    // Check if the last user message contains an image attachment
    const lastUserMsg = messages[messages.length - 1]
    let hasImage = false
    let imageBase64 = null

    if (lastUserMsg?.role === 'user' && typeof lastUserMsg.content === 'string') {
      const imageMatch = lastUserMsg.content.match(/^\[Image: .+?\]\n(data:image\/[^;]+;base64,[\s\S]+)$/)
      if (imageMatch) {
        hasImage = true
        imageBase64 = imageMatch[1]
      }
    }

    // Query wiki for context
    const lastMsg = messages[messages.length - 1]?.content || ''
    let wikiContext = ''
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

    // ── System Prompt ──
    const SYSTEM_PROMPT = `${systemPrompt ? `Additional instructions: ${systemPrompt}\n\n` : ''}You are Kivora — a thoughtful, precise, and thorough AI assistant. You help builders, developers, students, and entrepreneurs worldwide, with deep sensitivity to cost, tool availability, internet connectivity, and local context — especially for users in Africa and the global diaspora.

<stance>
Default to helping. Only decline when helping would create concrete, specific risk of serious harm. When uncertain, say so honestly rather than guessing. If you don't know something, say "I'm not sure" — never fabricate facts, URLs, package names, API endpoints, or citations.
</stance>

<tone>
- Never use filler phrases: no "Great question!", "Certainly!", "I'd be happy to help!", "Let me know if you need anything else!"
- Get to the point directly. No preamble, no recap of what you're about to do — just do it.
- No emojis unless the user uses them first.
- Avoid "genuinely", "honestly", "straightforward", "it's worth noting".
- Match the user's energy: brief for brief, detailed for detailed.
- When the user sends a simple greeting (hi, hello, hey, what's up), respond in 1-2 short sentences maximum.
- When the user says thanks, acknowledge briefly (one sentence) and stop.
- Never apologize for being an AI or for limitations. If you make a mistake, acknowledge in one sentence and fix it.
</tone>

<formatting>
- Use ## and ### for sections. Never # (the user's message is the title).
- Use **bold** for key terms, \`backticks\` for code/file/function names.
- Use numbered lists for steps, bullet lists for non-sequential items (3+).
- Use tables for comparisons, tool recommendations (Tool, Cost, Best For columns).
- Use > blockquotes with [!note], [!tip], [!warning] for callouts.
- Use --- to separate major sections in long responses.
- Keep paragraphs 3-5 sentences. Every section heading must have substantive content.
</formatting>

<search_first>
For any factual question about the present-day world — people, events, prices, releases, statistics, news — you MUST use web search before answering. Never rely on training data alone for current information. When in doubt, search.
</search_first>

<code_rules>
Before presenting any code, silently verify: syntax, variable consistency, all imports, function signatures, return types, null/edge-case handling. If code is wrong, fix it silently — never output broken code. Always provide complete, runnable code with all imports. Never use "..." to skip parts. Tag code blocks with the correct language.

Code style: meaningful names (no 1-2 char names), verb-phrase functions, guard clauses, early returns, match existing code patterns. If editing, understand surrounding context first. Max 3 fix attempts per file, then ask user.
</code_rules>

<artifacts>
When generating visually renderable code, ALWAYS wrap it in: <artifact type="html|svg|mermaid|markdown" title="...">CODE</artifact>
Use for: web pages (html), diagrams (mermaid), SVG graphics (svg), documents (markdown). NOT for: small snippets, terminal commands, config files.
HTML artifacts must be self-contained with inline CSS/JS, responsive, modern CSS.
</artifacts>

<context>
- Reference earlier messages, frameworks, language preferences
- Think project-wide: file locations, missing dependencies, security, performance
- Proactively suggest improvements (security vulnerabilities, deprecated APIs, performance issues)
- Expertise: programming, web dev, AI/ML, data science, DevOps, system design, math, science, business, academic writing, music/film, African markets
</context>

<copyright>
Quote at most 15 words per source, 1 quote per source. Never reproduce song lyrics or poems. Paraphrase instead of quoting. Always cite sources.
</copyright>

<self_correction>
If you made an error, acknowledge in one sentence and fix it. If going down the wrong path, stop and recalibrate. Never add "As an AI" disclaimers.
</self_correction>
${wikiContext ? `\nRelevant platform knowledge:\n${wikiContext}` : ''}${TOOL_INSTRUCTIONS}`

    // Build messages array
    let apiMessages

    if (hasImage) {
      const textContent = lastUserMsg.content.replace(/^\[Image: .+?\]\ndata:image\/[^;]+;base64,[\s\S]+$/, '').trim()
      apiMessages = [
        {
          role: 'system',
          content: `${systemPrompt ? `Additional instructions: ${systemPrompt}\n\n` : ''}You are Kivora's AI assistant — thoughtful, precise, and thorough. The user has attached an image. Describe what you see in detail and answer any questions about it. Use markdown formatting.`
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
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.slice(-12)
      ]
    }

    const useTools = !hasImage

    const chat = await groqChat({
      model,
      messages: apiMessages,
      ...(useTools ? { tools: toolDefs, tool_choice: 'auto' } : {})
    })

    const message = chat.choices[0].message

    // Handle tool calls
    if (useTools && message.tool_calls && message.tool_calls.length > 0) {
      const toolContext = { supabaseAdmin: admin, userId: userId || null }
      const toolResults = {}

      // Execute all tool calls
      for (const toolCall of message.tool_calls) {
        const handler = toolHandlers[toolCall.function.name]
        if (handler) {
          try {
            const args = JSON.parse(toolCall.function.arguments)
            toolResults[toolCall.id] = await handler(args, toolContext)
          } catch (err) {
            toolResults[toolCall.id] = `Tool error: ${err.message}`
          }
        } else {
          toolResults[toolCall.id] = `Unknown tool: ${toolCall.function.name}`
        }
      }

      // Build tool response messages
      const toolMessages = [message]
      for (const toolCall of message.tool_calls) {
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResults[toolCall.id] || 'No result'
        })
      }

      // Second call with tool results
      const finalChat = await groqChat({
        model,
        messages: [...apiMessages, ...toolMessages],
        tools: toolDefs,
        tool_choice: 'none'
      })

      const reply = finalChat.choices[0].message.content
      const artifacts = extractArtifacts(reply)

      // Save session
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
            id: sessionId, user_id: userId,
            messages: [...(session?.messages || []), storedUserMsg, { role: 'assistant', content: reply }],
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' })
        } catch (_) {}
      }

      // Build response metadata
      const response = { reply, model }
      // Check which tools were used for UI indicators
      for (const toolCall of message.tool_calls) {
        const name = toolCall.function.name
        if (name === 'web_search') {
          try { response.searchUsed = true; response.searchQuery = JSON.parse(toolCall.function.arguments).query } catch {}
        }
        if (name === 'execute_code' || name === 'calculate_math' || name === 'format_json' || name === 'color_palette') {
          response.codeExecuted = true
        }
        if (name === 'read_url' || name === 'web_scrape') {
          try { response.urlRead = true; response.urlReadSource = 'jina' } catch {}
        }
        if (name === 'generate_image') {
          try {
            const imgResult = JSON.parse(toolResults[toolCall.id])
            if (imgResult.base64) {
              response.imageGenerated = true
              response.imageData = `data:image/jpeg;base64,${imgResult.base64}`
              response.imagePrompt = imgResult.prompt
            }
          } catch {}
        }
      }
      if (artifacts.length > 0) response.artifacts = artifacts
      return Response.json(response)
    }

    // Normal response (no tool calls)
    const reply = message.content
    const artifacts = extractArtifacts(reply)

    // Save session
    if (userId && sessionId) {
      try {
        const { data: session } = await admin
          .from('chat_sessions')
          .select('messages')
          .eq('id', sessionId)
          .eq('user_id', userId)
          .single()

        let storedUserMsg = { ...messages.slice(-1)[0] }
        if (hasImage) {
          const imageFileName = lastUserMsg.content.match(/^\[Image: (.+?)\]/)?.[1] || 'image'
          const textOnly = lastUserMsg.content.replace(/^\[Image: .+?\]\ndata:image\/[^;]+;base64,[\s\S]+$/, '').trim()
          storedUserMsg = { role: 'user', content: `[Image: ${imageFileName}]${textOnly ? '\n' + textOnly : ''}` }
        }

        await admin.from('chat_sessions').upsert({
          id: sessionId, user_id: userId,
          messages: [...(session?.messages || []), storedUserMsg, { role: 'assistant', content: reply }],
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
      } catch (_) {}
    }

    const response = { reply, model, searchUsed: false }
    if (artifacts.length > 0) response.artifacts = artifacts
    return Response.json(response)
  } catch (err) {
    console.error('[chat]', err)
    return Response.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
