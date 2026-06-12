// ── Daytona Sandbox Client for Kivora ──
// Uses @daytona/sdk for real shell access, code execution, and filesystem ops
// Auth: DAYTONA_API_KEY (get from https://app.daytona.io/dashboard/keys)
//
// Provider priority: Daytona → Cloudflare Sandbox → Judge0 (fallback)
// Daytona is the preferred provider: sub-90ms cold start, persistent sandboxes,
// full filesystem, shell access, GPU support, self-hostable

let daytonaApiKey = null
let daytonaApiUrl = 'https://app.daytona.io/api'
let daytonaTarget = 'us'

// ── In-memory session cache ──
// Maps session IDs to Daytona sandbox objects for reuse
const activeSandboxes = new Map()

// ── SDK singleton (lazy-loaded to avoid edge runtime bundling issues) ──
let _daytonaSdk = null

async function getDaytona() {
  if (_daytonaSdk) return _daytonaSdk
  try {
    // Dynamic import to avoid bundler issues in edge runtime
    const mod = await Function('return import("@daytona/sdk")')()
    _daytonaSdk = new mod.Daytona({
      apiKey: daytonaApiKey,
      apiUrl: daytonaApiUrl,
      target: daytonaTarget,
    })
    return _daytonaSdk
  } catch (err) {
    throw new Error(`Failed to initialize Daytona SDK: ${err.message}`)
  }
}

// ── Credential Management ──

export function setDaytonaApiKey(key) {
  daytonaApiKey = key
  _daytonaSdk = null // Reset SDK so it reinitializes with new key
}

export function setDaytonaConfig(config = {}) {
  if (config.apiUrl) daytonaApiUrl = config.apiUrl
  if (config.target) daytonaTarget = config.target
  _daytonaSdk = null
}

export function isDaytonaAvailable() {
  return !!daytonaApiKey
}

// ── Sandbox Lifecycle ──

/**
 * Create a new Daytona sandbox.
 * @param {Object} options
 * @param {string} options.sessionId - Optional session ID for reuse
 * @param {string} options.language - Default code language ('python', 'typescript', 'javascript')
 * @param {Object} options.envVars - Environment variables
 * @param {number} options.cpu - vCPUs (1-4)
 * @param {number} options.memory - RAM in GB (1-8)
 * @param {number} options.disk - Disk in GiB (3-10)
 * @returns {Promise<{sandboxId: string, sessionId: string}>}
 */
export async function createSandbox(options = {}) {
  const {
    sessionId = `kivora-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    language = 'python',
    envVars = {},
    cpu,
    memory,
    disk,
  } = options

  // Check if session already exists
  const existing = activeSandboxes.get(sessionId)
  if (existing) {
    // Verify the sandbox is still alive
    try {
      const daytona = await getDaytona()
      const sb = await daytona.get(existing.sandboxId)
      if (sb) {
        return { sandboxId: existing.sandboxId, sessionId }
      }
    } catch {
      // Sandbox no longer exists, create a new one
      activeSandboxes.delete(sessionId)
    }
  }

  const daytona = await getDaytona()

  const createOpts = {
    language,
    envVars,
  }
  if (cpu) createOpts.cpu = cpu
  if (memory) createOpts.memory = memory
  if (disk) createOpts.disk = disk

  const sandbox = await daytona.create(createOpts)

  const result = { sandboxId: sandbox.id, sessionId }
  activeSandboxes.set(sessionId, { sandboxId: sandbox.id, sandbox, createdAt: Date.now() })

  return result
}

/**
 * Get or create a sandbox for a session.
 */
export async function getOrCreateSandbox(sessionId, options = {}) {
  if (sessionId) {
    const existing = activeSandboxes.get(sessionId)
    if (existing) {
      try {
        const daytona = await getDaytona()
        const sb = await daytona.get(existing.sandboxId)
        if (sb) return { sandboxId: existing.sandboxId, sessionId, sandbox: sb }
      } catch {
        activeSandboxes.delete(sessionId)
      }
    }
  }

  const result = await createSandbox({ sessionId: sessionId || undefined, ...options })
  const daytona = await getDaytona()
  const sandbox = await daytona.get(result.sandboxId)
  return { ...result, sandbox }
}

// ── Code Execution ──

/**
 * Run code in a Daytona sandbox (stateless — each call is independent).
 * @param {string} code - Code to execute
 * @param {Object} options
 * @param {string} options.language - 'python', 'typescript', 'javascript'
 * @param {string} options.sessionId - Optional session for persistent sandbox
 * @param {number} options.timeout - Timeout in seconds (default 120)
 * @returns {Promise<{success: boolean, output: string, exitCode: number, executor: string}>}
 */
export async function runDaytonaCode(code, options = {}) {
  const {
    language = 'python',
    sessionId,
    timeout = 120,
  } = options

  if (!isDaytonaAvailable()) {
    return { success: false, output: null, error: 'Daytona API key not configured. Set DAYTONA_API_KEY.', executor: 'daytona' }
  }

  let sandboxId = null
  let sandbox = null
  let shouldCleanup = false

  try {
    // Reuse or create sandbox
    if (sessionId) {
      const result = await getOrCreateSandbox(sessionId, { language })
      sandboxId = result.sandboxId
      sandbox = result.sandbox
    } else {
      // One-shot: create, execute, destroy
      const daytona = await getDaytona()
      sandbox = await daytona.create({ language })
      sandboxId = sandbox.id
      shouldCleanup = true
    }

    // Execute code
    const codeResult = await sandbox.process.codeRun(code, { timeout })

    return {
      success: codeResult.exitCode === 0,
      output: codeResult.result || '',
      exitCode: codeResult.exitCode ?? 0,
      executor: 'daytona',
      backendName: 'Daytona Sandbox',
      sandboxId,
      sessionId,
    }
  } catch (err) {
    return {
      success: false,
      output: null,
      error: `Daytona execution failed: ${err.message}`,
      executor: 'daytona',
      sandboxId,
    }
  } finally {
    if (shouldCleanup && sandboxId) {
      try {
        const daytona = await getDaytona()
        const sb = await daytona.get(sandboxId)
        await sb.delete()
      } catch { /* cleanup failed */ }
    }
  }
}

// ── Shell Command Execution ──

/**
 * Execute a shell command in a Daytona sandbox.
 * @param {string} sessionId - Session ID (creates sandbox if needed)
 * @param {string} command - Shell command to run
 * @param {Object} options
 * @param {string} options.cwd - Working directory (default: 'workspace')
 * @param {Object} options.env - Environment variables
 * @param {number} options.timeout - Timeout in seconds
 * @returns {Promise<{success: boolean, output: string, exitCode: number, sandboxId: string}>}
 */
export async function execCommand(sessionId, command, options = {}) {
  const {
    cwd = 'workspace',
    env = {},
    timeout = 120,
  } = options

  if (!isDaytonaAvailable()) {
    return { success: false, output: null, error: 'Daytona not configured', executor: 'daytona' }
  }

  try {
    const { sandboxId, sandbox } = await getOrCreateSandbox(sessionId)

    const result = await sandbox.process.executeCommand(command, cwd, env, timeout)

    return {
      success: result.exitCode === 0,
      output: result.result || '',
      exitCode: result.exitCode ?? 0,
      executor: 'daytona',
      backendName: 'Daytona Sandbox',
      sandboxId,
      sessionId,
    }
  } catch (err) {
    return {
      success: false,
      output: null,
      error: `Daytona exec failed: ${err.message}`,
      executor: 'daytona',
    }
  }
}

// ── File Operations ──

/**
 * Write a file to a Daytona sandbox.
 */
export async function writeFile(sessionId, path, content) {
  if (!isDaytonaAvailable()) {
    return { success: false, error: 'Daytona not configured' }
  }

  try {
    const { sandbox } = await getOrCreateSandbox(sessionId)
    await sandbox.fs.uploadFile(Buffer.from(content), path)
    return { success: true, path }
  } catch (err) {
    return { success: false, error: `Daytona write failed: ${err.message}` }
  }
}

/**
 * Read a file from a Daytona sandbox.
 */
export async function readFile(sessionId, path) {
  if (!isDaytonaAvailable()) {
    return { success: false, error: 'Daytona not configured' }
  }

  try {
    const { sandbox } = await getOrCreateSandbox(sessionId)
    const content = await sandbox.fs.downloadFile(path)
    return { success: true, content: content.toString(), path }
  } catch (err) {
    return { success: false, error: `Daytona read failed: ${err.message}` }
  }
}

/**
 * List files in a Daytona sandbox directory.
 */
export async function listFiles(sessionId, path = 'workspace') {
  if (!isDaytonaAvailable()) {
    return { success: false, error: 'Daytona not configured' }
  }

  try {
    const { sandbox } = await getOrCreateSandbox(sessionId)
    const files = await sandbox.fs.listFiles(path)
    return {
      success: true,
      files: files.map(f => ({
        name: f.name,
        isDir: f.isDir,
        size: f.size,
        path: `${path}/${f.name}`,
      })),
    }
  } catch (err) {
    return { success: false, error: `Daytona list failed: ${err.message}` }
  }
}

/**
 * Create a folder in a Daytona sandbox.
 */
export async function createFolder(sessionId, path) {
  if (!isDaytonaAvailable()) {
    return { success: false, error: 'Daytona not configured' }
  }

  try {
    const { sandbox } = await getOrCreateSandbox(sessionId)
    await sandbox.fs.createFolder(path)
    return { success: true, path }
  } catch (err) {
    return { success: false, error: `Daytona mkdir failed: ${err.message}` }
  }
}

// ── Git Operations ──

/**
 * Clone a git repo into a Daytona sandbox.
 */
export async function gitClone(sessionId, repoUrl, options = {}) {
  const { branch, targetDir = 'workspace' } = options

  if (!isDaytonaAvailable()) {
    return { success: false, error: 'Daytona not configured' }
  }

  try {
    const { sandbox } = await getOrCreateSandbox(sessionId)
    let command = `git clone --depth 1`
    if (branch) command += ` --branch ${branch}`
    command += ` ${repoUrl} ${targetDir}`

    const result = await sandbox.process.executeCommand(command, 'workspace', {}, 60)

    return {
      success: result.exitCode === 0,
      output: result.result,
      exitCode: result.exitCode,
    }
  } catch (err) {
    return { success: false, error: `Daytona git clone failed: ${err.message}` }
  }
}

// ── Sandbox Management ──

/**
 * Stop a Daytona sandbox (can be restarted later).
 */
export async function stopSandbox(sessionId) {
  const entry = activeSandboxes.get(sessionId)
  if (!entry) return { success: false, error: 'Session not found' }

  try {
    const daytona = await getDaytona()
    const sandbox = await daytona.get(entry.sandboxId)
    await sandbox.stop()
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Delete a Daytona sandbox and remove from session cache.
 */
export async function deleteSandbox(sessionId) {
  const entry = activeSandboxes.get(sessionId)
  if (!entry) return { success: true } // Already gone

  try {
    const daytona = await getDaytona()
    const sandbox = await daytona.get(entry.sandboxId)
    await sandbox.delete()
  } catch { /* may already be deleted */ }
  activeSandboxes.delete(sessionId)
  return { success: true }
}

/**
 * Get info about a Daytona sandbox.
 */
export async function getSandboxInfo(sessionId) {
  const entry = activeSandboxes.get(sessionId)
  if (!entry) return { success: false, error: 'Session not found' }

  try {
    const daytona = await getDaytona()
    const sandbox = await daytona.get(entry.sandboxId)
    return {
      success: true,
      sandboxId: entry.sandboxId,
      sessionId,
      createdAt: entry.createdAt,
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * List all active Daytona sandboxes.
 */
export async function listSandboxes() {
  if (!isDaytonaAvailable()) return []

  try {
    const daytona = await getDaytona()
    const sandboxes = []
    for await (const sb of daytona.list()) {
      sandboxes.push({ id: sb.id })
    }
    return sandboxes
  } catch {
    return []
  }
}

// ── Cleanup All ──

export async function cleanup() {
  for (const [sessionId, entry] of activeSandboxes.entries()) {
    try {
      const daytona = await getDaytona()
      const sandbox = await daytona.get(entry.sandboxId)
      await sandbox.delete()
    } catch { /* ignore */ }
  }
  activeSandboxes.clear()
  _daytonaSdk = null
  daytonaApiKey = null
}

// ── Health Check ──

export async function healthCheck() {
  if (!isDaytonaAvailable()) {
    return { available: false, reason: 'API key not set' }
  }

  try {
    const daytona = await getDaytona()
    const sandboxes = []
    for await (const sb of daytona.list()) {
      sandboxes.push(sb.id)
    }
    return { available: true, activeSandboxes: sandboxes.length }
  } catch (err) {
    return { available: false, reason: err.message }
  }
}
