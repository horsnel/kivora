export const runtime = 'edge'
import { groq, MODEL, VISION_MODEL, groqChat, ALLOWED_MODELS } from '@/lib/groq'
import { getSupabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/ratelimit'

const ALLOWED_MODEL_IDS = ALLOWED_MODELS.map(m => m.id)

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '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'

const JUDGE0_URL = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true'

const VALID_LANGUAGE_IDS = new Set([71, 63, 74, 62, 54, 50, 60, 73, 72, 68, 46, 82])

const tools = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information, real-time data, news, prices, facts, or anything that requires up-to-date knowledge.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'execute_code',
      description: 'Execute code in an isolated sandbox and return the output. Supports Python, JavaScript, TypeScript, Java, C++, C, Go, Rust, Bash, SQL.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Complete source code to execute' },
          language_id: { type: 'number', description: 'Judge0 language ID (71=Python, 63=JS, 74=TS, 62=Java, 54=C++, 46=Bash)' },
          stdin: { type: 'string', description: 'Optional stdin input' }
        },
        required: ['code', 'language_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_url',
      description: 'Read and extract the content of a web page URL. Returns clean markdown text. Use when the user shares a URL and wants a summary or analysis of its content.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to read' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Generate an image from a text description. Use when the user explicitly asks to create, generate, or draw an image, picture, photo, illustration, or icon.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Detailed image description' },
          size: { type: 'string', description: 'Image size: 1024x1024, 1344x768, 768x1344, etc.', enum: ['1024x1024', '1344x768', '768x1344', '1152x864', '864x1152'] }
        },
        required: ['prompt']
      }
    }
  }
]

const TOOL_INSTRUCTIONS = `

You have access to these tools:

1. **web_search** — USE when the user asks about current prices, news, weather, sports, or any time-sensitive info. DO NOT use for general knowledge, coding help, math, or creative writing.

2. **execute_code** — USE when you need to verify code, test outputs, perform calculations, or demonstrate results. Always present the code in a markdown code block FIRST, then show the execution output.

3. **read_url** — USE when the user shares a URL and wants a summary or analysis. Returns the page content as clean markdown.

4. **generate_image** — USE when the user explicitly asks to create/generate/draw an image, picture, illustration, or icon.

IMPORTANT — ARTIFACTS:
When you generate code that can be visually rendered, wrap it in an artifact tag so the user can see it live:
<artifact type="html" title="My Website">
<!DOCTYPE html>...complete HTML...</html>
</artifact>

Supported artifact types:
- type="html" — Complete HTML pages with inline CSS/JS
- type="svg" — SVG graphics and diagrams
- type="mermaid" — Mermaid diagram code (will be rendered as a diagram)
- type="markdown" — Rich markdown documents
- type="react" — React component JSX (will be rendered in a sandbox)

Rules for artifacts:
- Always include COMPLETE, self-contained code — no external dependencies except CDN links
- HTML artifacts should include <!DOCTYPE html>, full <head>, and <body>
- Include inline styles or <style> tags — no external CSS files
- Give each artifact a descriptive title
- You can create multiple artifacts in one response
- Artifact code goes INSIDE the <artifact> tags, NOT in a separate code block`

// ── Artifact Extraction ──
function extractArtifacts(text) {
  const artifacts = []
  const regex = /<artifact\s+type="(\w+)"\s+title="([^"]*)">([\s\S]*?)<\/artifact>/g
  let match
  while ((match = regex.exec(text)) !== null) {
    artifacts.push({
      type: match[1],
      title: match[2],
      code: match[3].trim()
    })
  }
  return artifacts
}

// ── DuckDuckGo + Tavily Search ──
async function performSearch(query) {
  // Try DuckDuckGo first (free, no key)
  try {
    const ddgRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (ddgRes.ok) {
      const ddgData = await ddgRes.json()
      const results = []
      if (ddgData.Abstract) {
        results.push({ title: ddgData.Heading || query, url: ddgData.AbstractURL || '', content: ddgData.Abstract })
      }
      if (ddgData.RelatedTopics) {
        for (const topic of ddgData.RelatedTopics.slice(0, 5)) {
          if (topic.Text && topic.FirstURL) {
            results.push({ title: topic.Text.slice(0, 80), url: topic.FirstURL, content: topic.Text })
          }
        }
      }
      if (results.length > 0) {
        return { answer: ddgData.Abstract || '', results, source: 'duckduckgo' }
      }
    }
  } catch {}

  // Fallback to Tavily
  try {
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TAVILY_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, search_depth: 'basic', include_answer: true, max_results: 5 })
    })
    if (tavilyRes.ok) {
      const data = await tavilyRes.json()
      return {
        answer: data.answer || '',
        results: (data.results || []).map(r => ({ title: r.title, url: r.url, content: r.content, score: r.score })),
        source: 'tavily'
      }
    }
  } catch {}

  return null
}

// ── Jina Reader ──
async function readUrl(url) {
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/markdown', 'X-Return-Format': 'markdown' }
    })
    if (jinaRes.ok) {
      const content = await jinaRes.text()
      return { content: content.slice(0, 15000), source: 'jina' }
    }
  } catch {}
  return null
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
        {
          role: 'system',
          content: `${systemPrompt ? `Additional instructions: ${systemPrompt}\n\n` : ''}You are Kivora's AI assistant — thoughtful, precise, and thorough. You help builders, developers, students, and entrepreneurs worldwide, with sensitivity to cost, tool availability, and local context especially for users in Africa and the global diaspora. Never use filler phrases like "Great question!" or "Certainly!" — get to the point directly. When uncertain, say so honestly rather than guessing.

IMPORTANT — GREETINGS: When the user sends a simple greeting (hi, hello, hey, what's up, etc.), respond in 1-2 short sentences maximum. Do NOT give long introductions or offer lists of things you can help with. Just greet back naturally and briefly.

Structure responses with clear headings, bullet points, numbered lists, and tables for comparisons. Use **bold** for key terms and > blockquotes with [!note], [!tip], [!warning] for callouts.

Before presenting any code, silently verify: syntax correctness, variable consistency (declared before use), all imports included, function signatures matching their usage, correct return types, and null/edge-case handling. If code is wrong, fix it silently before presenting — never output broken code. Always provide complete, runnable code with all imports and setup, never using "..." to skip parts. Tag code blocks with the correct language.

When generating code that can be visually rendered (websites, SVGs, diagrams, dashboards), ALWAYS wrap it in an artifact tag: <artifact type="html|svg|mermaid|markdown" title="...">CODE</artifact>. This allows the user to preview the result live in a side panel.

Stay context-aware: reference the user's earlier messages, frameworks, and language preferences. Think project-wide — suggest where files belong, flag missing dependencies, and consider configuration. Proactively suggest improvements when you spot issues. Your expertise spans programming, web development, AI/ML, data science, DevOps, system design, mathematics, science, business strategy, and academic writing. For tool recommendations, include a table with Tool, Cost, and Best For columns. Keep responses comprehensive yet scannable — use --- to separate major sections in long responses.
${wikiContext ? `\nRelevant platform knowledge:\n${wikiContext}` : ''}${TOOL_INSTRUCTIONS}`
        },
        ...messages.slice(-12)
      ]
    }

    const useTools = !hasImage

    const chat = await groqChat({
      model,
      messages: apiMessages,
      ...(useTools ? { tools, tool_choice: 'auto' } : {})
    })

    const message = chat.choices[0].message

    // Handle tool calls
    if (useTools && message.tool_calls && message.tool_calls.length > 0) {
      let searchResults = null
      let searchQuery = ''
      let codeExecResult = null
      let codeExecMeta = null
      let urlReadResult = null
      let imageGenResult = null

      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name === 'web_search') {
          const args = JSON.parse(toolCall.function.arguments)
          searchQuery = args.query
          searchResults = await performSearch(args.query)
        }

        if (toolCall.function.name === 'execute_code') {
          const args = JSON.parse(toolCall.function.arguments)
          const { code, language_id, stdin = '' } = args

          if (!code || !language_id || !VALID_LANGUAGE_IDS.has(language_id)) {
            codeExecResult = { error: `Invalid or unsupported language_id: ${language_id}` }
          } else {
            try {
              const execResponse = await fetch(JUDGE0_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_code: code, language_id, stdin })
              })

              if (!execResponse.ok) {
                codeExecResult = { error: `Execution service error: ${execResponse.status}` }
              } else {
                const execData = await execResponse.json()
                codeExecResult = {
                  stdout: execData.stdout || null,
                  stderr: execData.stderr || null,
                  compile_output: execData.compile_output || null,
                  status: execData.status?.description || 'Unknown',
                  status_id: execData.status?.id || null,
                  exit_code: execData.exit_code ?? null,
                  time: execData.time || null,
                  memory: execData.memory || null
                }
                codeExecMeta = { language_id, time: execData.time, memory: execData.memory }
              }
            } catch (execErr) {
              console.error('[chat] Code execution error:', execErr)
              codeExecResult = { error: 'Code execution failed' }
            }
          }
        }

        if (toolCall.function.name === 'read_url') {
          const args = JSON.parse(toolCall.function.arguments)
          let targetUrl = args.url
          if (targetUrl && !targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl
          urlReadResult = await readUrl(targetUrl)
        }

        if (toolCall.function.name === 'generate_image') {
          const args = JSON.parse(toolCall.function.arguments)
          try {
            const imgRes = await fetch('https://image.pollinations.ai/prompt/' + encodeURIComponent(args.prompt) + '?width=1024&height=1024&nologo=true&model=flux', {
              headers: { 'Accept': 'image/*' }
            })
            if (imgRes.ok) {
              const imgBuffer = await imgRes.arrayBuffer()
              const bytes = new Uint8Array(imgBuffer)
              let binary = ''
              for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
              imageGenResult = { base64: btoa(binary), prompt: args.prompt, source: 'pollinations' }
            }
          } catch {}
        }
      }

      // Build tool response messages
      const toolMessages = [message]

      for (const toolCall of message.tool_calls) {
        let content = ''

        if (toolCall.function.name === 'web_search') {
          content = searchResults
            ? JSON.stringify({ answer: searchResults.answer, results: searchResults.results?.map(r => ({ title: r.title, url: r.url, content: r.content?.slice(0, 500) })) })
            : 'Search failed. Respond based on your existing knowledge.'
        }

        if (toolCall.function.name === 'execute_code') {
          if (codeExecResult?.error) {
            content = JSON.stringify({ error: codeExecResult.error })
          } else {
            const STATUS_OK = new Set([3, 4])
            const isOk = STATUS_OK.has(codeExecResult.status_id)
            let output = ''
            if (codeExecResult.stdout) output += codeExecResult.stdout
            if (codeExecResult.compile_output) output += (output ? '\n' : '') + codeExecResult.compile_output
            if (codeExecResult.stderr) output += (output ? '\n' : '') + codeExecResult.stderr
            if (!output) output = '(no output)'
            content = JSON.stringify({ success: isOk, status: codeExecResult.status, exit_code: codeExecResult.exit_code, output, time: codeExecResult.time, memory: codeExecResult.memory })
          }
        }

        if (toolCall.function.name === 'read_url') {
          content = urlReadResult
            ? JSON.stringify({ content: urlReadResult.content, source: urlReadResult.source })
            : 'Failed to read URL. Respond based on your existing knowledge.'
        }

        if (toolCall.function.name === 'generate_image') {
          content = imageGenResult
            ? JSON.stringify({ success: true, prompt: imageGenResult.prompt, source: imageGenResult.source })
            : 'Image generation failed. Describe what the image would look like instead.'
        }

        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content
        })
      }

      // Make a second call with the tool results
      const finalChat = await groqChat({
        model,
        messages: [...apiMessages, ...toolMessages],
        tools,
        tool_choice: 'none'
      })

      const reply = finalChat.choices[0].message.content

      // Extract artifacts from reply
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

      const response = { reply, model }
      if (searchQuery) {
        response.searchUsed = true
        response.searchQuery = searchQuery
      }
      if (codeExecResult) {
        response.codeExecuted = true
        response.codeExecMeta = codeExecMeta
      }
      if (urlReadResult) {
        response.urlRead = true
        response.urlReadSource = urlReadResult.source
      }
      if (imageGenResult) {
        response.imageGenerated = true
        response.imageData = `data:image/jpeg;base64,${imageGenResult.base64}`
        response.imagePrompt = imageGenResult.prompt
      }
      if (artifacts.length > 0) {
        response.artifacts = artifacts
      }
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

    const response = { reply, model, searchUsed: false }
    if (artifacts.length > 0) {
      response.artifacts = artifacts
    }
    return Response.json(response)
  } catch (err) {
    console.error('[chat]', err)
    return Response.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
