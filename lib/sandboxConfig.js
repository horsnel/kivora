// ── Kivora Sandbox Configuration ──
// Manages sandbox availability and fallback to Judge0

// The sandbox worker URL — set this env var to enable Cloudflare Sandbox
// If not set, all code execution falls back to Judge0
const SANDBOX_URL = process.env.KIVORA_SANDBOX_URL || ''
const SANDBOX_API_KEY = process.env.KIVORA_SANDBOX_KEY || ''

// Check if sandbox is configured and available
function isSandboxAvailable() {
  return !!SANDBOX_URL
}

// Get sandbox base URL
function getSandboxUrl() {
  return SANDBOX_URL.replace(/\/$/, '')
}

// Get sandbox headers
function getSandboxHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  if (SANDBOX_API_KEY) {
    headers['Authorization'] = `Bearer ${SANDBOX_API_KEY}`
  }
  return headers
}

// ── Sandbox API Client ──
const sandboxClient = {
  // Execute a command in the sandbox
  async exec(sandboxId, command, options = {}) {
    const url = `${getSandboxUrl()}/exec?sandbox_id=${encodeURIComponent(sandboxId)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: getSandboxHeaders(),
      body: JSON.stringify({
        command,
        timeout: options.timeout || 30000,
        env: options.env,
        cwd: options.cwd || '/workspace',
        stdin: options.stdin,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Sandbox exec failed: ${res.status} ${err}`)
    }
    return res.json()
  },

  // Run Python or JavaScript code
  async runCode(sandboxId, code, language = 'python') {
    const url = `${getSandboxUrl()}/run-code?sandbox_id=${encodeURIComponent(sandboxId)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: getSandboxHeaders(),
      body: JSON.stringify({ code, language }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Sandbox runCode failed: ${res.status} ${err}`)
    }
    return res.json()
  },

  // Write a file to the sandbox
  async writeFile(sandboxId, path, content) {
    const url = `${getSandboxUrl()}/files/write?sandbox_id=${encodeURIComponent(sandboxId)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: getSandboxHeaders(),
      body: JSON.stringify({ path, content }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Sandbox writeFile failed: ${res.status} ${err}`)
    }
    return res.json()
  },

  // Read a file from the sandbox
  async readFile(sandboxId, path) {
    const url = `${getSandboxUrl()}/files/read?sandbox_id=${encodeURIComponent(sandboxId)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: getSandboxHeaders(),
      body: JSON.stringify({ path }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Sandbox readFile failed: ${res.status} ${err}`)
    }
    return res.json()
  },

  // List directory contents
  async ls(sandboxId, path = '/workspace') {
    const url = `${getSandboxUrl()}/files/ls?sandbox_id=${encodeURIComponent(sandboxId)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: getSandboxHeaders(),
      body: JSON.stringify({ path }),
    })
    if (!res.ok) throw new Error(`Sandbox ls failed: ${res.status}`)
    return res.json()
  },

  // Clone a git repo
  async gitCheckout(sandboxId, repoUrl, options = {}) {
    const url = `${getSandboxUrl()}/git/checkout?sandbox_id=${encodeURIComponent(sandboxId)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: getSandboxHeaders(),
      body: JSON.stringify({
        url: repoUrl,
        branch: options.branch,
        depth: options.depth || 1,
        target_dir: options.targetDir,
      }),
    })
    if (!res.ok) throw new Error(`Sandbox gitCheckout failed: ${res.status}`)
    return res.json()
  },

  // Destroy a sandbox
  async destroy(sandboxId) {
    const url = `${getSandboxUrl()}/destroy?sandbox_id=${encodeURIComponent(sandboxId)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: getSandboxHeaders(),
    })
    if (!res.ok) throw new Error(`Sandbox destroy failed: ${res.status}`)
    return res.json()
  },

  // Check sandbox health
  async health() {
    const url = `${getSandboxUrl()}/health`
    const res = await fetch(url, { headers: getSandboxHeaders() })
    if (!res.ok) throw new Error(`Sandbox health check failed: ${res.status}`)
    return res.json()
  },

  // Get sandbox info
  async info(sandboxId) {
    const url = `${getSandboxUrl()}/info?sandbox_id=${encodeURIComponent(sandboxId)}`
    const res = await fetch(url, { headers: getSandboxHeaders() })
    if (!res.ok) throw new Error(`Sandbox info failed: ${res.status}`)
    return res.json()
  },

  // Create a downloadable file URL (returns URL for frontend)
  getDownloadUrl(sandboxId, path) {
    return `${getSandboxUrl()}/files/download?sandbox_id=${encodeURIComponent(sandboxId)}`
  },
}

export { isSandboxAvailable, getSandboxUrl, getSandboxHeaders, sandboxClient, SANDBOX_URL }
