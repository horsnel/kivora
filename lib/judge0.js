// ── Centralized Judge0 code-execution client ─────────────────────
// Single shared client used by /api/execute, lib/toolRegistry.js
// (execute_code tool) and any sandbox fallback path.
//
// Config (read via getEnvVar in route.js, passed through setJudge0Config):
//   JUDGE0_URL      — base URL. Defaults to the public CE endpoint.
//                     For production throughput use a dedicated host, e.g.
//                     https://judge0-ce.p.rapidapi.com or a self-hosted URL.
//   JUDGE0_API_KEY  — optional. Sent as X-RapidAPI-Key (RapidAPI hosts) and
//                     X-Auth-Token (self-hosted instances with auth) so both
//                     hosting styles work with one variable.
//
// Language IDs (Judge0 CE):
//   71=Python 63=JavaScript(Node) 74=TypeScript 62=Java 54=C++ 50=C
//   60=Go 73=Rust 72=Ruby 68=PHP 46=Bash 82=SQL

const DEFAULT_URL = 'https://ce.judge0.com'

export const VALID_LANGUAGE_IDS = new Set([71, 63, 74, 62, 54, 50, 60, 73, 72, 68, 46, 82])

let _config = { url: null, apiKey: null }

/** Called by routes after reading env/CF secrets via getEnvVar(). */
export function setJudge0Config(url, apiKey) {
  _config = {
    url: (url || '').trim() || null,
    apiKey: (apiKey || '').trim() || null,
  }
}

/** Base URL without trailing slashes. */
function judge0Base() {
  return (_config.url || DEFAULT_URL).replace(/\/+$/, '')
}

/** The public CE endpoint works without a key, so Judge0 is always usable. */
export function isJudge0Available() {
  return true
}

/**
 * Execute code on Judge0 and return a normalized result:
 *   { stdout, stderr, compile_output, status_id, status, exit_code, time, memory }
 * or { error } on invalid input / transport failure.
 */
export async function runJudge0(code, languageId, stdin = '') {
  if (!code || !languageId || !VALID_LANGUAGE_IDS.has(languageId)) {
    return { error: `Invalid or unsupported language_id: ${languageId}` }
  }

  const headers = { 'Content-Type': 'application/json' }
  if (_config.apiKey) {
    headers['X-RapidAPI-Key'] = _config.apiKey
    headers['X-Auth-Token'] = _config.apiKey
  }

  let res
  try {
    res = await fetch(`${judge0Base()}/submissions?base64_encoded=false&wait=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        source_code: code,
        language_id: languageId,
        stdin: stdin || '',
      }),
      signal: AbortSignal.timeout(45_000),
    })
  } catch (err) {
    return { error: `Judge0 unreachable: ${err.message}` }
  }

  if (!res.ok) {
    let details = ''
    try {
      details = (await res.text()).slice(0, 200)
    } catch {}
    return { error: `Judge0 error: ${res.status}${details ? ` — ${details}` : ''}` }
  }

  let data
  try {
    data = await res.json()
  } catch (err) {
    return { error: `Judge0 returned invalid JSON: ${err.message}` }
  }

  return {
    stdout: data.stdout || null,
    stderr: data.stderr || null,
    compile_output: data.compile_output || null,
    status_id: data.status?.id ?? null,
    status: {
      id: data.status?.id ?? null,
      description: data.status?.description || 'Unknown',
    },
    exit_code: data.exit_code ?? null,
    time: data.time || null,
    memory: data.memory || null,
  }
}
