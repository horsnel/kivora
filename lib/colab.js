// ── Kivora Colab CLI Integration ──
// Client library for Google Colab CLI — GPU/TPU code execution from Kivora
// Follows Kivora's lazy-initialization pattern (see lib/groq.js)

// ── Configuration ──
const COLAB_API_BASE = 'https://colab.sandbox.google.com'
const COLAB_SESSION_API = 'https://colab.research.google.com'
const COLAB_KEEPALIVE_API = 'https://colab.pa.googleapis.com'

// Required OAuth scopes
const PUBLIC_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/colaboratory',
]

// Supported accelerator types
const GPU_TYPES = ['T4', 'L4', 'G4', 'A100', 'H100']
const TPU_TYPES = ['v5e1', 'v6e1', 'V2-8']

// ── Lazy-initialized state ──
let _accessToken = null
let _sessions = {} // In-memory session cache: { name: { id, accelerator, assignedAt, lastKeepAlive } }
let _keepAliveIntervals = {} // { sessionId: intervalId }

/**
 * Set the Google OAuth access token for Colab API calls.
 * Called in API routes after obtaining credentials via getEnvVar or user auth.
 */
export function setColabAccessToken(token) {
  _accessToken = token || null
}

/**
 * Get the current access token.
 */
export function getColabAccessToken() {
  return _accessToken
}

/**
 * Check if Colab integration is configured (has a valid access token).
 */
export function isColabAvailable() {
  return !!_accessToken
}

/**
 * Get supported accelerator types for UI display.
 */
export function getAcceleratorOptions() {
  return {
    cpu: { id: 'cpu', label: 'CPU', description: 'Standard CPU (free)', tier: 'free' },
    gpus: GPU_TYPES.map(gpu => ({
      id: gpu,
      label: `${gpu} GPU`,
      description: getGpuDescription(gpu),
      tier: getGpuTier(gpu),
    })),
    tpus: TPU_TYPES.map(tpu => ({
      id: tpu,
      label: `${tpu.toUpperCase()} TPU`,
      description: getTpuDescription(tpu),
      tier: 'pro',
    })),
  }
}

function getGpuDescription(gpu) {
  const descriptions = {
    T4: '16GB VRAM — Standard free-tier GPU',
    L4: '24GB VRAM — Cost-effective training',
    G4: 'NVIDIA GPU — Balanced performance',
    A100: '40GB/80GB VRAM — High-performance training',
    H100: '80GB VRAM — Latest-gen, fastest training',
  }
  return descriptions[gpu] || 'GPU accelerator'
}

function getGpuTier(gpu) {
  if (gpu === 'T4') return 'free'
  if (gpu === 'L4') return 'pro'
  return 'premium'
}

function getTpuDescription(tpu) {
  const descriptions = {
    v5e1: '1 core — Inference & efficient training',
    v6e1: '1 core — High performance TPU',
    'V2-8': '8 cores — Parallel training workloads',
  }
  return descriptions[tpu] || 'TPU accelerator'
}

// ══════════════════════════════════════════
// API Client Methods
// ══════════════════════════════════════════

function getAuthHeaders() {
  if (!_accessToken) throw new Error('Colab access token not configured')
  return {
    'Authorization': `Bearer ${_accessToken}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Provision a new Colab session (equivalent to `colab new`).
 * @param {Object} options
 * @param {string} [options.name] - Session name
 * @param {string} [options.gpu] - GPU type (T4, L4, A100, H100)
 * @param {string} [options.tpu] - TPU type (v5e1, v6e1, V2-8)
 * @returns {Promise<{sessionId: string, name: string, accelerator: string, status: string}>}
 */
export async function createSession({ name, gpu, tpu } = {}) {
  const sessionName = name || `kivora-${Date.now()}`
  const accelerator = gpu || tpu || null

  const params = new URLSearchParams()
  if (accelerator) {
    if (GPU_TYPES.includes(accelerator)) {
      params.set('gpu', accelerator)
    } else if (TPU_TYPES.includes(accelerator)) {
      params.set('tpu', accelerator)
    }
  }

  try {
    const assignUrl = `${COLAB_API_BASE}/tun/m/assign${params.toString() ? '?' + params.toString() : ''}`
    const res = await fetch(assignUrl, {
      method: 'GET',
      headers: getAuthHeaders(),
    })

    if (!res.ok) {
      const errorText = await res.text()
      // 400 usually means no quota for the requested accelerator
      if (res.status === 400) {
        // Fallback to T4 or CPU
        if (accelerator && accelerator !== 'T4') {
          console.warn(`[colab] No quota for ${accelerator}, falling back to T4`)
          return createSession({ name: sessionName, gpu: 'T4' })
        }
        return { error: `No quota available. Try a different accelerator or CPU.`, status: 'no_quota' }
      }
      if (res.status === 401 || res.status === 403) {
        return { error: 'Authentication failed. Please reconnect your Google account.', status: 'auth_failed' }
      }
      throw new Error(`Colab assign failed: ${res.status} ${errorText.slice(0, 200)}`)
    }

    const data = await res.json()
    const sessionId = data.session_id || data.id || data.assignmentId

    if (!sessionId) {
      throw new Error('No session ID returned from Colab API')
    }

    // Start keep-alive for this session
    startKeepAlive(sessionId)

    const sessionInfo = {
      sessionId,
      name: sessionName,
      accelerator: accelerator || 'cpu',
      status: 'active',
      assignedAt: new Date().toISOString(),
      lastKeepAlive: new Date().toISOString(),
    }

    _sessions[sessionName] = sessionInfo

    return sessionInfo
  } catch (err) {
    console.error('[colab] createSession error:', err.message)
    return { error: err.message, status: 'error' }
  }
}

/**
 * Execute Python code on a Colab session (equivalent to `colab exec`).
 * @param {string} sessionName - The session name to execute on
 * @param {string} code - Python code to execute
 * @param {Object} [options]
 * @param {number} [options.timeout=60000] - Execution timeout in ms
 * @returns {Promise<{success: boolean, output: string, error: string|null, executor: string}>}
 */
export async function executeCode(sessionName, code, { timeout = 60000 } = {}) {
  const session = _sessions[sessionName]
  if (!session) {
    return { error: `Session "${sessionName}" not found. Create a session first.`, success: false }
  }

  try {
    // Use Jupyter kernel messaging to execute code
    const execUrl = `${COLAB_API_BASE}/tun/m/execute/${session.sessionId}`
    const res = await fetch(execUrl, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        code,
        timeout: Math.min(timeout, 300000) / 1000, // Max 5 minutes
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return {
        success: false,
        output: '',
        error: `Execution failed: ${res.status} ${errorText.slice(0, 300)}`,
        executor: 'colab',
      }
    }

    const data = await res.json()
    return {
      success: data.status === 'ok' || data.exit_code === 0,
      output: data.stdout || data.output || data.result || '',
      error: data.stderr || data.error || null,
      exitCode: data.exit_code ?? 0,
      executor: 'colab',
      accelerator: session.accelerator,
      sessionId: session.sessionId,
    }
  } catch (err) {
    return {
      success: false,
      output: '',
      error: `Colab execution error: ${err.message}`,
      executor: 'colab',
    }
  }
}

/**
 * Run a one-shot GPU job — provision, execute, download, stop (equivalent to `colab run`).
 * @param {string} code - Python code to execute
 * @param {Object} options
 * @param {string} [options.gpu='T4'] - GPU type
 * @param {string} [options.tpu] - TPU type
 * @param {number} [options.timeout=120000] - Total timeout in ms
 * @returns {Promise<{success: boolean, output: string, error: string|null, files: string[]}>}
 */
export async function runGpuJob(code, { gpu = 'T4', tpu, timeout = 120000 } = {}) {
  const sessionName = `kivora-job-${Date.now()}`

  // 1. Create session
  const session = await createSession({ name: sessionName, gpu, tpu })
  if (session.error) {
    return { success: false, output: '', error: session.error, files: [] }
  }

  try {
    // 2. Execute code
    const result = await executeCode(sessionName, code, { timeout: timeout - 20000 })

    // 3. Try to list generated files
    let files = []
    try {
      const lsResult = await listFiles(sessionName, '/content')
      if (lsResult.success) {
        files = lsResult.files.map(f => f.name).filter(n =>
          !n.startsWith('__') && !n.startsWith('.') && n !== 'sample_data'
        )
      }
    } catch {}

    return {
      ...result,
      files,
      accelerator: session.accelerator,
      sessionName,
    }
  } finally {
    // 4. Always stop the session
    await stopSession(sessionName)
  }
}

/**
 * Stop and release a Colab session (equivalent to `colab stop`).
 * @param {string} sessionName
 */
export async function stopSession(sessionName) {
  const session = _sessions[sessionName]
  if (!session) return { success: false, error: 'Session not found' }

  try {
    // Stop keep-alive
    stopKeepAlive(session.sessionId)

    const unassignUrl = `${COLAB_API_BASE}/tun/m/unassign/${session.sessionId}`
    const res = await fetch(unassignUrl, {
      method: 'POST',
      headers: getAuthHeaders(),
    })

    delete _sessions[sessionName]

    if (!res.ok) {
      console.warn(`[colab] stopSession warning: ${res.status}`)
    }

    return { success: true, name: sessionName }
  } catch (err) {
    delete _sessions[sessionName]
    return { success: false, error: err.message }
  }
}

/**
 * List active sessions (equivalent to `colab sessions`).
 */
export async function listSessions() {
  try {
    const res = await fetch(`${COLAB_SESSION_API}/tun/m/assignments`, {
      method: 'GET',
      headers: getAuthHeaders(),
    })

    if (!res.ok) {
      return { success: false, sessions: [], error: `API returned ${res.status}` }
    }

    const data = await res.json()
    return {
      success: true,
      sessions: (data.sessions || data || []).map(s => ({
        id: s.session_id || s.id,
        accelerator: s.accelerator_type || s.gpu || 'cpu',
        status: s.status || 'active',
        assignedAt: s.assigned_at || s.created,
      })),
    }
  } catch (err) {
    return { success: false, sessions: [], error: err.message }
  }
}

/**
 * Get session status (equivalent to `colab status`).
 */
export async function getSessionStatus(sessionName) {
  const session = _sessions[sessionName]
  if (!session) return { error: 'Session not found' }

  try {
    const res = await fetch(`${COLAB_SESSION_API}/tun/m/assignments`, {
      method: 'GET',
      headers: getAuthHeaders(),
    })

    if (!res.ok) return { ...session, status: 'unknown' }

    const data = await res.json()
    const match = (data.sessions || data || []).find(
      s => (s.session_id || s.id) === session.sessionId
    )

    return match
      ? { ...session, ...match, status: match.status || 'active' }
      : { ...session, status: 'expired' }
  } catch {
    return { ...session, status: 'unknown' }
  }
}

/**
 * Install packages on a Colab session (equivalent to `colab install`).
 */
export async function installPackages(sessionName, packages) {
  const pkgList = Array.isArray(packages) ? packages.join(' ') : packages
  const code = `import subprocess; subprocess.check_call(['pip', 'install', '-q', ${JSON.stringify(pkgList).replace(/^\[/, '').replace(/\]$/, '')}])`
  return executeCode(sessionName, `import subprocess\nsubprocess.check_call(['pip', 'install', '-q'] + ${JSON.stringify(Array.isArray(packages) ? packages : packages.split(' '))})`)
}

/**
 * List files on a Colab session (equivalent to `colab ls`).
 */
export async function listFiles(sessionName, path = '/content') {
  const code = `
import os, json
path = ${JSON.stringify(path)}
entries = []
for entry in os.listdir(path):
    full = os.path.join(path, entry)
    try:
        stat = os.stat(full)
        entries.append({
            'name': entry,
            'path': full,
            'size': stat.st_size,
            'is_dir': os.path.isdir(full),
            'modified': stat.st_mtime,
        })
    except:
        entries.append({'name': entry, 'path': full, 'size': 0, 'is_dir': False, 'modified': 0})
print(json.dumps(entries))
`
  const result = await executeCode(sessionName, code)
  if (!result.success) return { success: false, files: [], error: result.error }

  try {
    const files = JSON.parse(result.output)
    return { success: true, files }
  } catch {
    return { success: false, files: [], error: 'Failed to parse file listing' }
  }
}

/**
 * Download a file from a Colab session (equivalent to `colab download`).
 * Returns the file content as base64.
 */
export async function downloadFile(sessionName, remotePath) {
  const code = `
import base64, json
path = ${JSON.stringify(remotePath)}
try:
    with open(path, 'rb') as f:
        data = f.read()
    print(json.dumps({'success': True, 'base64': base64.b64encode(data).decode(), 'size': len(data)}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`
  const result = await executeCode(sessionName, code)
  if (!result.success) return { success: false, error: result.error }

  try {
    const data = JSON.parse(result.output)
    return data
  } catch {
    return { success: false, error: 'Failed to parse download response' }
  }
}

/**
 * Upload a file to a Colab session (equivalent to `colab upload`).
 */
export async function uploadFile(sessionName, remotePath, content) {
  // content should be base64 encoded
  const code = `
import base64, json
path = ${JSON.stringify(remotePath)}
content_b64 = ${JSON.stringify(content)}
try:
    data = base64.b64decode(content_b64)
    with open(path, 'wb') as f:
        f.write(data)
    print(json.dumps({'success': True, 'path': path, 'size': len(data)}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`
  return executeCode(sessionName, code)
}

/**
 * Mount Google Drive on a Colab session (equivalent to `colab drivemount`).
 */
export async function mountDrive(sessionName, mountPath = '/content/drive') {
  const code = `
from google.colab import drive
drive.mount(${JSON.stringify(mountPath)})
print(f"Drive mounted at ${mountPath}")
`
  return executeCode(sessionName, code, { timeout: 60000 })
}

/**
 * Export session log as notebook (equivalent to `colab log`).
 */
export async function exportLog(sessionName, format = 'ipynb') {
  // This would require the session history — simplified version
  const session = _sessions[sessionName]
  if (!session) return { error: 'Session not found' }

  return {
    success: true,
    format,
    sessionName,
    accelerator: session.accelerator,
    assignedAt: session.assignedAt,
    note: 'Full log export requires the Colab CLI tool installed locally',
  }
}

// ══════════════════════════════════════════
// Keep-Alive Management
// ══════════════════════════════════════════

/**
 * Start keep-alive pings for a session (prevents idle termination ~90min).
 * Daemon sends KeepAlive RPC every 60 seconds.
 * Auto-terminates after 24 hours as a safety fallback.
 */
function startKeepAlive(sessionId) {
  if (_keepAliveIntervals[sessionId]) return // Already running

  const MAX_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  const startTime = Date.now()

  // Pre-flight check
  sendKeepAlive(sessionId).then(ok => {
    if (!ok) {
      console.warn(`[colab] Keep-alive pre-flight failed for ${sessionId}, session may be invalid`)
      return
    }

    _keepAliveIntervals[sessionId] = setInterval(async () => {
      // Safety: auto-stop after 24h
      if (Date.now() - startTime > MAX_DURATION) {
        stopKeepAlive(sessionId)
        console.warn(`[colab] Keep-alive auto-terminated after 24h for ${sessionId}`)
        return
      }

      const ok = await sendKeepAlive(sessionId)
      if (!ok) {
        console.warn(`[colab] Keep-alive failed for ${sessionId}, stopping`)
        stopKeepAlive(sessionId)
      }
    }, 60000) // Every 60 seconds
  })
}

function stopKeepAlive(sessionId) {
  if (_keepAliveIntervals[sessionId]) {
    clearInterval(_keepAliveIntervals[sessionId])
    delete _keepAliveIntervals[sessionId]
  }
}

async function sendKeepAlive(sessionId) {
  try {
    const res = await fetch(`${COLAB_KEEPALIVE_API}/google.internal.colab.v1.RuntimeService/KeepAliveAssignment`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json+protobuf',
        'X-Goog-Api-Client': 'grpc-web/0.1',
      },
      body: JSON.stringify([' ']),
    })
    return res.ok
  } catch {
    return false
  }
}

// ══════════════════════════════════════════
// Cleanup on process exit
// ══════════════════════════════════════════

// Clean up all keep-alive intervals and sessions
export async function cleanup() {
  for (const sessionId of Object.keys(_keepAliveIntervals)) {
    stopKeepAlive(sessionId)
  }
  for (const name of Object.keys(_sessions)) {
    await stopSession(name)
  }
}

// ══════════════════════════════════════════
// Google OAuth2 Flow (for user-facing auth)
// ══════════════════════════════════════════

/**
 * Generate the Google OAuth2 authorization URL for Colab access.
 * The user must visit this URL, grant access, and return with an auth code.
 */
export function getOAuthUrl(redirectUri, clientId, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: PUBLIC_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: state || 'colab-auth',
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchange an OAuth2 authorization code for access/refresh tokens.
 */
export async function exchangeOAuthCode(code, redirectUri, clientId, clientSecret) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OAuth token exchange failed: ${res.status} ${err.slice(0, 200)}`)
  }

  return res.json() // { access_token, refresh_token, expires_in, token_type }
}

/**
 * Refresh an expired access token using a refresh token.
 */
export async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token refresh failed: ${res.status} ${err.slice(0, 200)}`)
  }

  return res.json() // { access_token, expires_in, token_type }
}
