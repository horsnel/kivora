export const runtime = 'edge' 
import { groq, MODEL, VISION_MODEL, groqChat, GroqError, ALLOWED_MODELS, getPrimaryClientAsync, getFallbackClientAsync, setCerebrasApiKey, setSambanovaApiKey, setSiliconflowApiKey, setGeminiApiKey, setOpenrouterApiKey } from '@/lib/groq'
import { createClient } from '@supabase/supabase-js'
import { getEnvVar } from '@/lib/cfEnv'
import { rateLimit, anonymousRateLimit, anonymousDailyLimit } from '@/lib/ratelimit'
import { toolDefs, toolHandlers, TOOL_INSTRUCTIONS, filterToolsByQuery } from '@/lib/toolRegistry'
import { buildSystemPrompt } from '@/lib/systemPrompt'
import { requireCredits, refundCredits, CREDIT_COSTS } from '@/lib/credits'

const ALLOWED_MODEL_IDS = ALLOWED_MODELS.map(m => m.id)

// ── Artifact Extraction ──
function extractArtifacts(text) {
  const artifacts = []
  const regex = /<artifact\s+type="(\w+)"\s+title="([^"]*)">([\s\S]*?)<\/artifact>/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const type = match[1]
    const title = match[2]
    const content = match[3].trim()

    if (type === 'project') {
      // Parse multi-file project
      const files = []
      const fileRegex = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g
      let fileMatch
      while ((fileMatch = fileRegex.exec(content)) !== null) {
        files.push({ path: fileMatch[1], content: fileMatch[2].trim() })
      }
      if (files.length > 0) {
        artifacts.push({ type: 'project', title, files })
      }
    } else {
      artifacts.push({ type, title, code: content })
    }
  }
  return artifacts
}

// ── Wiki Ingest (non-blocking) ──────────────────────────────────
// After a substantive assistant reply, fire a background wiki ingest
// so future queries can use the knowledge. We extract entities and
// upsert into wiki_pages. This never blocks the response — failures
// are silently swallowed (logged only).
function slugifyText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 80)
}

async function ingestToWiki(admin, { userMessage, assistantReply, userId }) {
  if (!admin || !userMessage || !assistantReply) return
  // Only ingest substantive replies (>150 chars) — skip greetings, errors, short answers
  if (assistantReply.length < 150) return
  // Skip if it's mostly an error message
  if (/^(sorry|error|failed|unable|i can't)/i.test(assistantReply.trim())) return

  try {
    const title = userMessage.slice(0, 80).trim() || 'Untitled conversation'
    const slug = `chat-${slugifyText(title)}-${Date.now().toString(36)}`
    const content = `User asked: ${userMessage.slice(0, 500)}\n\nKivora answered:\n${assistantReply.slice(0, 2500)}`

    await admin
      .from('wiki_pages')
      .upsert({
        slug,
        title: `Chat: ${title}`,
        content,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'slug' })

    console.log('[chat] Wiki ingest OK:', slug)
  } catch (err) {
    console.warn('[chat] Wiki ingest failed:', err?.message || err)
  }
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  // Hoisted so the catch block can refund on failure
  let chatUser = null
  let chatAction = 'chat'

  try {
    // Access Cloudflare Workers secrets via getEnvVar (process.env has empty values for secrets)
    const groqKey = await getEnvVar('GROQ_API_KEY')
    const groqFallbackKey = await getEnvVar('GROQ_API_KEY_FALLBACK')
    const cerebrasKey = await getEnvVar('CEREBRAS_API_KEY')
    const sambanovaKey = await getEnvVar('SAMBANOVA_API_KEY')
    const siliconflowKey = await getEnvVar('SILICONFLOW_API_KEY')
    const geminiKey = await getEnvVar('GEMINI_API_KEY')
    const openrouterKey = await getEnvVar('OPENROUTER_API_KEY')
    const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
    const supaKey = await getEnvVar('SUPABASE_SERVICE_ROLE_KEY')

    // Wire all provider keys into the multi-provider chain.
    // Order is: Cerebras → SambaNova → SiliconFlow → Groq(primary) → Groq(fallback) → Gemini → OpenRouter
    setCerebrasApiKey(cerebrasKey)
    setSambanovaApiKey(sambanovaKey)
    setSiliconflowApiKey(siliconflowKey)
    setGeminiApiKey(geminiKey)
    setOpenrouterApiKey(openrouterKey)
    const groqClient = await getPrimaryClientAsync(groqKey)
    if (groqFallbackKey) await getFallbackClientAsync(groqFallbackKey)

    const admin = supaUrl && supaKey ? createClient(supaUrl, supaKey) : null
    // Groq client is no longer strictly required — direct providers (Cerebras/SambaNova/SiliconFlow)
    // can serve requests without it. But Supabase is still mandatory for session storage.
    if (!admin) {
      return Response.json({ error: 'Service not configured' }, { status: 503 })
    }
    // If no LLM provider is configured at all, fail fast with a clear error.
    if (!groqClient && !cerebrasKey && !sambanovaKey && !siliconflowKey && !geminiKey && !openrouterKey) {
      return Response.json({ error: 'No LLM providers configured' }, { status: 503 })
    }
    const { messages, sessionId, userId, model: requestedModel, systemPrompt, focusMode, proMode, proModeType } = await req.json()
    if (!messages?.length) {
      return Response.json({ error: 'messages required' }, { status: 400 })
    }

    // ── Charge credits (1 for standard chat, 3 for reasoning model) ──
    // We trust the userId from the body for now (it's authenticated by the
    // Supabase RLS layer when reading sessions). Anonymous users skip charging.
    const authHeader = req.headers.get('authorization') || ''
    const accessToken = authHeader.replace(/^Bearer\s+/i, '')
    const supaAnon = await getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if (accessToken && supaUrl && supaAnon) {
      try {
        const userClient = createClient(supaUrl, supaAnon, {
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
        })
        const { data: { user: u } } = await userClient.auth.getUser()
        chatUser = u
      } catch { /* anonymous */ }
    }

    // Anonymous user — apply daily limit (5 chat messages/day) + per-minute burst protection
    if (!chatUser) {
      // Per-minute burst protection (prevents rapid-fire abuse)
      if (!anonymousRateLimit(ip).ok) {
        return Response.json({
          error: "You're sending messages too quickly. Slow down or sign in for more.",
          quotaExceeded: true,
          upgrade_url: '/auth',
        }, { status: 429 })
      }
      // Daily limit — 5 chat messages per day for anonymous visitors
      const dailyCheck = await anonymousDailyLimit(admin, ip, 'chat', 5)
      if (!dailyCheck.ok) {
        return Response.json({
          error: "You've used all 5 free chat messages for today. Sign in for unlimited access.",
          quotaExceeded: true,
          anonLimitReached: true,
          limit: dailyCheck.limit,
          used: dailyCheck.used,
          upgrade_url: '/auth',
        }, { status: 429 })
      }
    }

    // Determine action: reasoning model costs more
    const isReasoning = proMode || proModeType === 'reasoning' || (requestedModel && /reason|think|o1|o3/i.test(requestedModel))
    chatAction = isReasoning ? 'chat_reasoning' : 'chat'

    if (admin && chatUser?.id) {
      const creditCheck = await requireCredits(req, admin, chatUser, chatAction, {
        cost: CREDIT_COSTS[chatAction],
        description: `Chat: ${messages[messages.length - 1]?.content?.slice(0, 80) || ''}`,
        metadata: {
          session_id: sessionId,
          model: requestedModel || MODEL,
          pro_mode: !!proMode,
          message_count: messages.length,
        },
      })
      if (!creditCheck.ok) return creditCheck.response
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

    // ── Greeting shortcut ──
    // Short-circuit common greetings ("hi", "hello", "hey", "yo", "sup",
    // "good morning", etc.) with a warm canned reply. This guarantees no
    // tool flow ever triggers for greetings, regardless of model behavior.
    // Multi-turn check: only fire if this is the first user message OR the
    // previous assistant message is also a greeting reply.
    if (!hasImage && lastUserMsg?.role === 'user' && typeof lastUserMsg.content === 'string') {
      const trimmed = lastUserMsg.content.trim().toLowerCase()
      // Greeting patterns: bare greeting, or greeting + 1-2 short follow-up words
      const greetingPatterns = [
        /^(hi|hello|hey|yo|sup|hiya|heya|howdy|greetings|good\s+(morning|afternoon|evening)|ello|hay)\b/,
        /^h+e+l+l+o+$/,
        /^h+i+\b/,
      ]
      const isGreeting = greetingPatterns.some(re => re.test(trimmed)) && trimmed.length < 50
      // Don't fire if the user's message has a question mark (likely a real question)
      const hasQuestion = /[?]/.test(trimmed)

      if (isGreeting && !hasQuestion) {
        // Pick a varied greeting — use sessionId hash for deterministic-but-varied pick
        const greetings = [
          "Hey! What can I help you build, research, or figure out today?",
          "Hi there! I'm Kivora. I can search the web, run code, build websites, generate images, and more. What are you working on?",
          "Hello! Ready when you are — ask me anything, or describe what you want to create.",
          "Hey! Good to see you. What's on your mind today?",
          "Hi! Whether it's a quick fact-check, a chunk of code, or a full website — I've got you. What's the task?",
        ]
        const idx = sessionId
          ? Math.abs([...sessionId].reduce((a, c) => a + c.charCodeAt(0), 0)) % greetings.length
          : Math.floor(Math.random() * greetings.length)
        const reply = greetings[idx]

        // Save session so the greeting shows up in history
        if (userId && sessionId) {
          try {
            const { data: session } = await admin
              .from('chat_sessions')
              .select('messages')
              .eq('id', sessionId)
              .eq('user_id', userId)
              .single()
            await admin.from('chat_sessions').upsert({
              id: sessionId, user_id: userId,
              messages: [...(session?.messages || []), lastUserMsg, { role: 'assistant', content: reply }],
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' })
          } catch (_) {}
        }
        return Response.json({ reply, model: 'kivora-greeting', searchUsed: false })
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
          .or(`title.ilike.%${lastMsg.slice(0, 30)}%,content.ilike.%${lastMsg.slice(0, 30)}%`)
          .not('slug', 'like', 'article-%')
          .limit(2)
        if (pages?.length) {
          wikiContext = pages.map(p => `${p.title}: ${p.content.slice(0, 200)}`).join('\n\n')
        }
      } catch (_) {}
    }

    // ── System Prompt ──
    const SYSTEM_PROMPT = buildSystemPrompt({ systemPrompt, wikiContext, toolInstructions: TOOL_INSTRUCTIONS, focusMode, proMode, proModeType })

    // Build messages array
    let apiMessages

    if (hasImage) {
      const textContent = lastUserMsg.content.replace(/^\[Image: .+?\]\ndata:image\/[^;]+;base64,[\s\S]+$/, '').trim()
      apiMessages = [
        {
          role: 'system',
          content: `${systemPrompt ? `Additional instructions: ${systemPrompt}\n\n` : ''}You are Kivora — an advanced AI assistant. The user has attached an image. Describe what you see in precise detail and answer any questions about it. Be thorough: identify objects, text, people, settings, colors, styles, and any relevant context. Use markdown formatting with ## sections for structured analysis. No filler phrases — get straight to the description.`
        },
        ...messages.slice(0, -1).slice(-8),
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
        ...messages.slice(-8)
      ]
    }

    // Filter tools by query relevance. Sending all 28 tools adds ~4.4K tokens
    // to every request, which blows past Groq 8B's 6K TPM and most free-tier
    // limits. By sending only the 1-8 tools relevant to the user's query, we
    // drop input context to ~1-2K tokens — fits every provider's free tier.
    const useTools = !hasImage
    const lastContent = (lastUserMsg?.content || '').trim()
    const relevantTools = useTools ? filterToolsByQuery(lastContent) : []

    const llmParams = {
      model,
      messages: apiMessages,
      max_tokens: 2048,
      ...(relevantTools.length > 0 ? { tools: relevantTools, tool_choice: 'auto' } : {})
    }

    let chat
    try {
      chat = await groqChat(llmParams)
    } catch (firstErr) {
      // If the first call hit a quota/rate-limit error, wait 15s and retry
      // once — SambaNova's free tier is 10 RPM, so a brief wait often clears it.
      if (firstErr instanceof GroqError && firstErr.code === 'GROQ_QUOTA_EXCEEDED') {
        console.warn('[chat] first call quota-exceeded, waiting 15s and retrying once')
        await new Promise(r => setTimeout(r, 15000))
        chat = await groqChat(llmParams)
      } else {
        throw firstErr
      }
    }

    const message = chat.choices[0].message

    // Handle tool calls
    if (useTools && message.tool_calls && message.tool_calls.length > 0) {
      // Pass CF credentials to tools that need them (deploy_site).
      // On CF Pages, secret_text vars are only accessible via getEnvVar(),
      // not via process.env — so we must look them up here and pass them down.
      const cfApiToken = await getEnvVar('CF_API_TOKEN')
      const cfAccountId = await getEnvVar('CF_ACCOUNT_ID')
      const toolContext = {
        supabaseAdmin: admin,
        userId: userId || null,
        cfApiToken,
        cfAccountId,
      }

      // Set Colab access token from server-side env if available (for run_on_gpu tool)
      const colabToken = await getEnvVar('GOOGLE_COLAB_ACCESS_TOKEN')
      if (colabToken) {
        try {
          const { setColabAccessToken } = await import('@/lib/colab')
          setColabAccessToken(colabToken)
        } catch {}
      }

      // Set Kaggle credentials from server-side env if available (for run_on_gpu tool)
      const kaggleUsername = await getEnvVar('KAGGLE_USERNAME')
      const kaggleKey = await getEnvVar('KAGGLE_KEY')
      if (kaggleUsername && kaggleKey) {
        try {
          const { setKaggleCredentials } = await import('@/lib/kaggle')
          setKaggleCredentials(kaggleUsername, kaggleKey)
        } catch {}
      }

      // Set E2B API key from server-side env if available (for run_code tool)
      // Note: E2B SDK uses Node.js APIs (node:path) that are incompatible with edge runtime
      // We only set the key; the actual SDK is loaded dynamically inside the tool handler
      // which runs outside the edge bundle
      const e2bKey = await getEnvVar('E2B_API_KEY')
      if (e2bKey) {
        try {
          const e2bMod = await import('@/lib/e2b')
          e2bMod.setE2BApiKey(e2bKey)
        } catch {}
      }

      // Set Daytona API key from server-side env (primary sandbox provider)
      const daytonaKey = await getEnvVar('DAYTONA_API_KEY')
      if (daytonaKey) {
        try {
          const daytonaMod = await import('@/lib/daytona')
          daytonaMod.setDaytonaApiKey(daytonaKey)
          const daytonaUrl = await getEnvVar('DAYTONA_API_URL')
          if (daytonaUrl) daytonaMod.setDaytonaConfig({ apiUrl: daytonaUrl })
        } catch {}
      }

      // Set Docker host URL from server-side env (self-hosted sandbox fallback)
      const dockerHostUrl = await getEnvVar('DOCKER_HOST_URL')
      if (dockerHostUrl) {
        try {
          const dockerMod = await import('@/lib/dockerSandbox')
          dockerMod.setDockerHost(dockerHostUrl)
        } catch {}
      }

      // Set GitHub token and default repo from server-side env if available (for codespaces tool)
      const githubToken = await getEnvVar('GITHUB_TOKEN')
      if (githubToken) {
        try {
          const csMod = await import('@/lib/codespaces')
          csMod.setGitHubToken(githubToken)
          const defaultRepo = await getEnvVar('GITHUB_DEFAULT_REPO')
          if (defaultRepo) csMod.setDefaultRepository(defaultRepo)
        } catch {}
      }

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

      // Second call with tool results — use the same filtered tools set so
      // the input stays small enough for free-tier providers.
      const finalChat = await groqChat({
        model,
        messages: [...apiMessages, ...toolMessages],
        max_tokens: 2048,
        tools: relevantTools,
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
      const response = { reply, model: chat._provider === 'gemini' ? (chat.model || model) : model }
      // Check which tools were used for UI indicators
      for (const toolCall of message.tool_calls) {
        const name = toolCall.function.name
        if (name === 'web_search') {
          try { response.searchUsed = true; response.searchQuery = JSON.parse(toolCall.function.arguments).query } catch {}
        }
        if (name === 'execute_code' || name === 'calculate_math' || name === 'format_json' || name === 'color_palette') {
          response.codeExecuted = true
        }
        if (name === 'sandbox_exec' || name === 'sandbox_file' || name === 'sandbox_git') {
          response.codeExecuted = true
          response.sandboxUsed = true
        }
        if (name === 'run_on_gpu') {
          response.codeExecuted = true
          response.gpuUsed = true
          try {
            const gpuArgs = JSON.parse(toolCall.function.arguments)
            response.accelerator = gpuArgs.gpu || gpuArgs.tpu || 'T4'
          } catch {}
        }
        if (name === 'run_code') {
          response.codeExecuted = true
          response.remoteExecUsed = true
          try {
            const codeArgs = JSON.parse(toolCall.function.arguments)
            response.execLanguage = codeArgs.language || 'python'
          } catch {}
        }
        if (name === 'generate_downloadable') {
          try {
            const dlResult = JSON.parse(toolResults[toolCall.id])
            if (dlResult.success) {
              response.downloadFile = {
                filename: dlResult.filename,
                data_url: dlResult.data_url,
                download_url: dlResult.download_url,
                download_body: dlResult.download_body,
                path: dlResult.path,
                size: dlResult.size,
                executor: dlResult.executor,
              }
            }
          } catch {}
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
        if (name === 'recommend_opportunities') {
          try {
            const oppResult = JSON.parse(toolResults[toolCall.id])
            if (oppResult.opportunities && oppResult.opportunities.length > 0) {
              response.opportunityCards = oppResult.opportunities
            }
          } catch {}
        }
        if (name === 'deploy_site') {
          try {
            const deployResult = JSON.parse(toolResults[toolCall.id])
            if (deployResult.success) {
              response.siteDeployed = true
              response.deployUrl = deployResult.url
              response.deployProject = deployResult.project_name
              // Pass file contents so the new CodePreviewCard can render
              // HTML / CSS / JS tabs alongside the live preview iframe.
              if (deployResult.html) response.deployHtml = deployResult.html
              if (deployResult.css)  response.deployCss  = deployResult.css
              if (deployResult.js)   response.deployJs   = deployResult.js
            }
          } catch {}
        }
      }
      if (artifacts.length > 0) response.artifacts = artifacts
      // Background wiki ingest (non-blocking — fire and forget)
      ingestToWiki(admin, { userMessage: lastUserMsg.content, assistantReply: reply, userId })
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
    // Background wiki ingest (non-blocking — fire and forget)
    ingestToWiki(admin, { userMessage: lastUserMsg.content, assistantReply: reply, userId })
    return Response.json(response)
  } catch (err) {
    console.error('[chat]', err)

    // Refund credits on failure — the chat didn't complete
    if (admin && chatUser?.id) {
      try {
        await refundCredits(admin, chatUser.id, CREDIT_COSTS[chatAction], chatAction,
          err instanceof GroqError ? err.code : (err.name || 'unknown'))
      } catch (refundErr) {
        console.error('[chat] refund failed:', refundErr)
      }
    }

    if (err instanceof GroqError && err.code === 'GROQ_QUOTA_EXCEEDED') {
      return Response.json({
        error: 'Too many requests, try again later.',
        quotaExceeded: true,
      }, { status: 429 })
    }
    // Generic friendly error — never expose the underlying provider's HTML
    // error page (e.g. Cerebras's Cloudflare WAF 403 challenge page) or
    // provider-specific status codes. The detailed providerOutcomes are
    // logged server-side but not surfaced to the client.
    return Response.json({
      error: 'I hit a snag reaching the AI service. Please try again in a moment.',
    }, { status: 503 })
  }
}
