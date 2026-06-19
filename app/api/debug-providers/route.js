export const runtime = 'edge'
import { getEnvVar } from '@/lib/cfEnv'

/**
 * Debug endpoint — tests each LLM provider directly from CF Pages.
 * Returns per-provider status so we can see which ones are failing in production.
 *
 * Usage:
 *   GET /api/debug-providers           — simple ping (no tools)
 *   GET /api/debug-providers?with_tools=1  — full body with tools array
 */
export async function GET(req) {
  const url = new URL(req.url)
  const withTools = url.searchParams.get('with_tools') === '1'

  const results = {}

  // Read all provider keys
  const keys = {
    cerebras:    await getEnvVar('CEREBRAS_API_KEY'),
    sambanova:   await getEnvVar('SAMBANOVA_API_KEY'),
    siliconflow: await getEnvVar('SILICONFLOW_API_KEY'),
    gemini:      await getEnvVar('GEMINI_API_KEY'),
    openrouter:  await getEnvVar('OPENROUTER_API_KEY'),
  }
  results.keys_present = Object.fromEntries(
    Object.entries(keys).map(([k, v]) => [k, !!v])
  )

  // Build a sample tools array (subset of Kivora's actual tools)
  const sampleTools = withTools ? [
    {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web.',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'execute_code',
        description: 'Execute Python code.',
        parameters: {
          type: 'object',
          properties: { code: { type: 'string' }, language: { type: 'string' } },
          required: ['code'],
        },
      },
    },
  ] : undefined

  const simpleBody = {
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Reply with exactly: OK' },
    ],
    max_tokens: 30,
    ...(sampleTools ? { tools: sampleTools, tool_choice: 'auto' } : {}),
  }

  const providerTests = [
    {
      name: 'cerebras',
      url: 'https://api.cerebras.ai/v1/chat/completions',
      key: keys.cerebras,
      body: { ...simpleBody, model: 'llama3.3-70b' },
    },
    {
      name: 'sambanova',
      url: 'https://api.sambanova.ai/v1/chat/completions',
      key: keys.sambanova,
      body: { ...simpleBody, model: 'Meta-Llama-3.3-70B-Instruct' },
    },
    {
      name: 'siliconflow',
      url: 'https://api.siliconflow.com/v1/chat/completions',
      key: keys.siliconflow,
      body: { ...simpleBody, model: 'Qwen/Qwen2.5-72B-Instruct' },
    },
    {
      name: 'gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      key: keys.gemini,
      body: { ...simpleBody, model: 'gemini-2.0-flash' },
    },
    {
      name: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: keys.openrouter,
      body: { ...simpleBody, model: 'meta-llama/llama-3.3-70b-instruct' },
      extraHeaders: { 'HTTP-Referer': 'https://kivora.pages.dev', 'X-Title': 'Kivora' },
    },
  ]

  results.providers = {}
  results.with_tools = withTools
  for (const p of providerTests) {
    if (!p.key) {
      results.providers[p.name] = { status: 'no_key' }
      continue
    }
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${p.key}`,
        ...(p.extraHeaders || {}),
      }
      const start = Date.now()
      const res = await fetch(p.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(p.body),
        signal: AbortSignal.timeout(20000),
      })
      const elapsed = Date.now() - start
      const text = await res.text()
      let json
      try { json = JSON.parse(text) } catch { json = null }

      results.providers[p.name] = {
        http_status: res.status,
        elapsed_ms: elapsed,
        ok: res.ok,
        content: json?.choices?.[0]?.message?.content || null,
        tool_calls: json?.choices?.[0]?.message?.tool_calls || null,
        finish_reason: json?.choices?.[0]?.finish_reason || null,
        error: json?.error?.message || (res.ok ? null : text.slice(0, 300)),
        raw_first_300: res.ok ? null : text.slice(0, 300),
      }
    } catch (e) {
      results.providers[p.name] = {
        http_status: 0,
        error: e.message,
        error_name: e.name,
      }
    }
  }

  // Test Groq proxy
  const groqKey = await getEnvVar('GROQ_API_KEY')
  if (groqKey) {
    try {
      const start = Date.now()
      const res = await fetch('https://kivora-groq-proxy.vercel.app/api/groq/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({ ...simpleBody, model: 'llama-3.3-70b-versatile' }),
        signal: AbortSignal.timeout(25000),
      })
      const elapsed = Date.now() - start
      const text = await res.text()
      let json
      try { json = JSON.parse(text) } catch { json = null }
      results.providers['groq-proxy'] = {
        http_status: res.status,
        elapsed_ms: elapsed,
        ok: res.ok,
        content: json?.choices?.[0]?.message?.content || null,
        tool_calls: json?.choices?.[0]?.message?.tool_calls || null,
        finish_reason: json?.choices?.[0]?.finish_reason || null,
        error: json?.error?.message || (res.ok ? null : text.slice(0, 300)),
      }
    } catch (e) {
      results.providers['groq-proxy'] = { http_status: 0, error: e.message }
    }
  } else {
    results.providers['groq-proxy'] = { status: 'no_key' }
  }

  return Response.json(results, { headers: { 'cache-control': 'no-store' } })
}

