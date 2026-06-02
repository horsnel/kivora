/**
 * Cerebras API Client — Edge Runtime Compatible
 *
 * Direct fetch-based client for Cerebras (https://api.cerebras.ai/v1).
 * Ultra-fast inference for quick research mode.
 *
 * Required env vars:
 *   CEREBRAS_API_KEY — your Cerebras API key
 */

import { getEnvVar } from '@/lib/cfEnv'

const CEREBRAS_BASE = 'https://api.cerebras.ai/v1'

async function getHeaders() {
  const apiKey = await getEnvVar('CEREBRAS_API_KEY')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

/**
 * Chat completions via Cerebras
 * @param {Object} body - { model, messages, temperature, max_tokens, ... }
 * @returns {Object} - Cerebras API response
 */
export async function cerebrasChat(body) {
  const headers = await getHeaders()
  const model = body.model || 'llama-4-scout-17b-16e-instruct'

  const res = await fetch(`${CEREBRAS_BASE}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, ...body }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Cerebras error ${res.status}: ${text}`)
  }

  return await res.json()
}
