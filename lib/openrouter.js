/**
 * OpenRouter API Client — Edge Runtime Compatible
 *
 * Direct fetch-based client for OpenRouter (https://openrouter.ai/api/v1).
 * Supports multiple models via OpenRouter's unified API.
 *
 * Required env vars:
 *   OPENROUTER_API_KEY — your OpenRouter API key
 */

import { getEnvVar } from '@/lib/cfEnv'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

async function getHeaders() {
  const apiKey = await getEnvVar('OPENROUTER_API_KEY')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://kivora.pages.dev',
    'X-Title': 'Kivora Research',
  }
}

/**
 * Chat completions via OpenRouter
 * @param {Object} body - { model, messages, temperature, max_tokens, ... }
 * @returns {Object} - OpenRouter API response
 */
export async function openrouterChat(body) {
  const headers = await getHeaders()
  const model = body.model || 'google/gemini-2.0-flash-001'

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, ...body }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${text}`)
  }

  return await res.json()
}
