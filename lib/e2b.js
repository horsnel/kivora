// ── E2B Code Interpreter Client for Kivora ──
// Executes code in E2B Firecracker microVMs with Jupyter kernel
// Sub-150ms cold start, stateful execution, filesystem access
// npm: @e2b/code-interpreter | Auth: E2B_API_KEY

let e2bApiKey = null

// ── Credential Management ──

export function setE2BApiKey(key) {
  e2bApiKey = key
}

export function isE2BAvailable() {
  return !!e2bApiKey
}

// ── Internal: Get the SDK ──
// Use string-based dynamic import to prevent webpack from bundling the E2B SDK
// which uses Node.js APIs (node:path) incompatible with edge runtime

async function getSDK() {
  if (!e2bApiKey) throw new Error('E2B_API_KEY not set')
  // String concatenation prevents webpack from resolving this at build time
  const mod = await import(/* webpackIgnore: true */ '@e2b/code-interpreter')
  const Sandbox = mod.Sandbox
  return { Sandbox, apiKey: e2bApiKey }
}

// ── High-Level: Run Code (One-shot) ──
// Creates a sandbox, runs code, captures output, destroys sandbox

export async function runE2BCode(code, options = {}) {
  const { language = 'python', timeout = 120, installPackages = [] } = options
  const timeoutMs = Math.min(timeout * 1000, 300000)

  let sandbox = null
  try {
    const { Sandbox, apiKey } = await getSDK()

    // Create sandbox
    sandbox = await Sandbox.create({ apiKey, timeoutMs })

    // Install packages if specified
    if (installPackages.length > 0) {
      const installCmd = language === 'python'
        ? `pip install -q ${installPackages.join(' ')}`
        : `npm install ${installPackages.join(' ')}`
      await sandbox.commands.run(installCmd, { timeoutMs: 60000 })
    }

    // Run the code
    const execution = await sandbox.runCode(code, { language, timeoutMs })

    // Parse results
    let output = execution.text || ''
    let error = null

    if (execution.error) {
      error = execution.error.toString()
    }

    // Collect any rich results (DataFrames, charts, images as base64)
    const results = []
    if (execution.results && execution.results.length > 0) {
      for (const r of execution.results) {
        results.push({
          type: r.type || 'text',
          text: r.text || '',
          // E2B can return PNG/JPEG/SVG for plots
          extra: r.extra || undefined,
        })
      }
    }

    return {
      success: !error,
      output: output.trim() || '(no output)',
      error,
      executor: 'e2b',
      accelerator: 'cpu',
      results,
      logs: {
        stdout: execution.logs?.stdout || '',
        stderr: execution.logs?.stderr || '',
      },
    }
  } catch (err) {
    return {
      success: false,
      output: null,
      error: `E2B execution failed: ${err.message}`,
      executor: 'e2b',
      accelerator: 'cpu',
    }
  } finally {
    // Always clean up
    if (sandbox) {
      try { await sandbox.close() } catch {}
    }
  }
}

// ── Stateful Sandbox Session ──
// For multi-step workflows where you need variable persistence

const activeSandboxes = new Map()

export async function createSandboxSession(sessionId, options = {}) {
  const { Sandbox, apiKey } = await getSDK()
  const timeoutMs = Math.min((options.timeout || 300) * 1000, 3600000)

  const sandbox = await Sandbox.create({ apiKey, timeoutMs })
  activeSandboxes.set(sessionId, { sandbox, createdAt: Date.now() })

  return {
    sessionId,
    status: 'running',
    executor: 'e2b',
  }
}

export async function executeInSession(sessionId, code, options = {}) {
  const entry = activeSandboxes.get(sessionId)
  if (!entry) throw new Error(`No E2B session: ${sessionId}`)

  const { sandbox } = entry
  const execution = await sandbox.runCode(code, {
    language: options.language || 'python',
    timeoutMs: Math.min((options.timeout || 120) * 1000, 300000),
  })

  let output = execution.text || ''
  let error = null
  if (execution.error) error = execution.error.toString()

  return {
    success: !error,
    output: output.trim() || '(no output)',
    error,
    executor: 'e2b',
    results: execution.results || [],
  }
}

export async function closeSandboxSession(sessionId) {
  const entry = activeSandboxes.get(sessionId)
  if (!entry) return { success: true }
  try { await entry.sandbox.close() } catch {}
  activeSandboxes.delete(sessionId)
  return { success: true }
}

// ── File Operations ──

export async function writeFile(sessionId, path, content) {
  const entry = activeSandboxes.get(sessionId)
  if (!entry) throw new Error(`No E2B session: ${sessionId}`)
  await entry.sandbox.filesystem.write(path, content)
  return { success: true, path }
}

export async function readFile(sessionId, path) {
  const entry = activeSandboxes.get(sessionId)
  if (!entry) throw new Error(`No E2B session: ${sessionId}`)
  const content = await entry.sandbox.filesystem.read(path)
  return { success: true, content, path }
}

export async function listFiles(sessionId, path = '/') {
  const entry = activeSandboxes.get(sessionId)
  if (!entry) throw new Error(`No E2B session: ${sessionId}`)
  const entries = await entry.sandbox.filesystem.list(path)
  return { success: true, entries, path }
}

// ── Shell Commands ──

export async function runCommand(sessionId, command, options = {}) {
  const entry = activeSandboxes.get(sessionId)
  if (!entry) throw new Error(`No E2B session: ${sessionId}`)
  const result = await entry.sandbox.commands.run(command, {
    timeoutMs: Math.min((options.timeout || 30) * 1000, 300000),
  })
  return {
    success: result.exitCode === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.exitCode,
  }
}

// ── Cleanup ──

export function cleanup() {
  e2bApiKey = null
  // Close all active sandboxes
  for (const [id, entry] of activeSandboxes) {
    try { entry.sandbox.close() } catch {}
  }
  activeSandboxes.clear()
}
