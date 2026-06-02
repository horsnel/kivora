/**
 * Gemini API Client — Edge Runtime Compatible
 *
 * Direct fetch-based client for Google Gemini API using the
 * OpenAI-compatible endpoint at generativelanguage.googleapis.com
 *
 * Required env vars:
 *   GEMINI_API_KEY — your Google AI Studio API key
 */

import { getEnvVar } from '@/lib/cfEnv'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai'

/**
 * Chat completions via Gemini (OpenAI-compatible endpoint)
 * @param {Object} body - { model, messages, temperature, max_tokens, ... }
 * @returns {Object} - OpenAI-format API response
 */
export async function geminiChat(body) {
  const apiKey = await getEnvVar('GEMINI_API_KEY')
  const model = body.model || 'gemini-2.5-flash'

  const res = await fetch(`${GEMINI_BASE}/chat/completions?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, ...body }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini error ${res.status}: ${text}`)
  }

  return await res.json()
}
