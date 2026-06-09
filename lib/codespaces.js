// ── GitHub Codespaces Client for Kivora ──
// Manages codespace lifecycle and executes code via SSH
// Auth: GitHub PAT with 'codespace' scope
// Note: Codespaces = persistent dev environments (30-90s cold start)
// Best for: full IDE, devcontainers, long-running tasks. Not for quick one-shots.

let githubToken = null

// ── Credential Management ──

export function setGitHubToken(token) {
  githubToken = token
}

export function isCodespacesAvailable() {
  return !!githubToken
}

// ── Internal Helpers ──

async function githubFetch(path, options = {}) {
  if (!githubToken) throw new Error('GitHub token not set')
  const url = path.startsWith('http') ? path : `https://api.github.com${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub API ${res.status}: ${text || res.statusText}`)
  }
  if (res.status === 204) return null // No content
  return res.json()
}

// ── Machine Types ──

export function getCodespaceMachineTypes() {
  return [
    { id: 'standardLinux4gb', name: '2-core · 4GB RAM', vcpus: 2, ram: '4GB', storage: '32GB' },
    { id: 'standardLinux8gb', name: '4-core · 8GB RAM', vcpus: 4, ram: '8GB', storage: '32GB' },
    { id: 'standardLinux16gb', name: '8-core · 16GB RAM', vcpus: 8, ram: '16GB', storage: '32GB' },
    { id: 'standardLinux32gb', name: '16-core · 32GB RAM', vcpus: 16, ram: '32GB', storage: '32GB' },
    { id: 'standardLinux64gb', name: '32-core · 64GB RAM', vcpus: 32, ram: '64GB', storage: '32GB' },
  ]
}

// ── List Codespaces ──

export async function listCodespaces() {
  const data = await githubFetch('/user/codespaces?per_page=30')
  return data?.codespaces || []
}

// ── Create Codespace ──

export async function createCodespace(options = {}) {
  const {
    repositoryId,
    repository,    // "owner/repo" format — will look up ID
    ref = 'main',
    machine = 'standardLinux4gb',
    idleTimeout = 30,
    devcontainerPath,
    location,
  } = options

  let repoId = repositoryId
  if (!repoId && repository) {
    const repo = await githubFetch(`/repos/${repository}`)
    repoId = repo.id
  }
  if (!repoId) throw new Error('repositoryId or repository (owner/repo) required')

  const body = {
    repository_id: repoId,
    ref,
    machine,
    idle_timeout_minutes: idleTimeout,
  }
  if (devcontainerPath) body.devcontainer_path = devcontainerPath
  if (location) body.location = location

  const codespace = await githubFetch('/user/codespaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    name: codespace.name,
    owner: codespace.owner?.login,
    repository: codespace.repository?.full_name,
    status: codespace.state,
    machine: codespace.machine?.displayName,
    webUrl: codespace.web_url,
    idleTimeout: codespace.idle_timeout_minutes,
    createdAt: codespace.created_at,
  }
}

// ── Get Codespace Status ──

export async function getCodespaceStatus(name) {
  const data = await githubFetch(`/user/codespaces/${name}`)
  return {
    name: data.name,
    status: data.state, // 'Creating', 'Available', 'Shutdown', 'Deleted'
    machine: data.machine?.displayName,
    webUrl: data.web_url,
    connection: data.connection,
  }
}

// ── Start/Stop Codespace ──

export async function startCodespace(name) {
  const data = await githubFetch(`/user/codespaces/${name}/start`, { method: 'POST' })
  return { name, status: data.state, connection: data.connection }
}

export async function stopCodespace(name) {
  await githubFetch(`/user/codespaces/${name}/stop`, { method: 'POST' })
  return { name, status: 'Shutdown' }
}

// ── Delete Codespace ──

export async function deleteCodespace(name) {
  await githubFetch(`/user/codespaces/${name}`, { method: 'DELETE' })
  return { name, deleted: true }
}

// ── Execute Code via SSH ──
// Uses the GitHub API's SSH connection info to run commands
// Requires: codespace must be in 'Available' state

export async function executeInCodespace(name, command, options = {}) {
  const { timeout = 120, language = 'bash' } = options

  // Get codespace connection info
  const status = await getCodespaceStatus(name)
  if (status.status !== 'Available') {
    // Try to start it
    const started = await startCodespace(name)
    // Wait for it to become available
    const maxWait = 60000
    const start = Date.now()
    while (Date.now() - start < maxWait) {
      const s = await getCodespaceStatus(name)
      if (s.status === 'Available') break
      await new Promise(r => setTimeout(r, 5000))
    }
  }

  // Build the command based on language
  let fullCommand = command
  if (language === 'python') {
    fullCommand = `python3 -c ${JSON.stringify(command)}`
  } else if (language === 'node') {
    fullCommand = `node -e ${JSON.stringify(command)}`
  }

  // Use the GitHub API to execute via SSH
  // The codespace SSH endpoint uses the gh CLI proxy
  // For server-side execution, we use the REST API's "export" trick
  // or write to a file and execute via the codespace's terminal

  // Approach: Write code to a temp file, then execute it
  // We'll use the Codespaces secrets API as a workaround
  // Actually, GitHub doesn't have a direct exec API.
  // Best approach for server-side: use the SSH connection with WebSockets

  // For now, return instructions for SSH-based execution
  // In production, this would use `gh codespace ssh` or direct SSH
  return {
    success: false,
    output: null,
    error: 'Direct code execution in Codespaces requires SSH access. Use the gh CLI or connect via WebSocket.',
    executor: 'codespaces',
    codespaceName: name,
    webUrl: status.webUrl,
    suggestion: `Run: gh codespace ssh -c ${name} -- ${fullCommand}`,
  }
}

// ── High-Level: Create & Execute (Full Lifecycle) ──

export async function runInCodespace(code, options = {}) {
  const {
    repository,
    machine = 'standardLinux8gb',
    language = 'python',
    timeout = 120,
  } = options

  if (!repository) {
    throw new Error('repository (owner/repo) is required for Codespaces')
  }

  let codespaceName = null
  try {
    // 1. Create codespace
    const cs = await createCodespace({
      repository,
      machine,
      idleTimeout: 5, // Auto-stop after 5 min idle
    })
    codespaceName = cs.name

    // 2. Wait for it to be available (can take 30-90s)
    const maxWait = 120000
    const start = Date.now()
    while (Date.now() - start < maxWait) {
      const s = await getCodespaceStatus(codespaceName)
      if (s.status === 'Available') break
      if (s.status === 'Deleted' || s.status === 'Failed') {
        throw new Error(`Codespace entered ${s.status} state`)
      }
      await new Promise(r => setTimeout(r, 5000))
    }

    // 3. Execute code
    const result = await executeInCodespace(codespaceName, code, { language, timeout })
    return {
      ...result,
      codespaceName,
      executor: 'codespaces',
      accelerator: 'cpu',
      machine,
    }
  } catch (err) {
    return {
      success: false,
      output: null,
      error: `Codespaces execution failed: ${err.message}`,
      executor: 'codespaces',
      accelerator: 'cpu',
      codespaceName,
    }
  } finally {
    // 4. Clean up — delete the codespace
    if (codespaceName) {
      try { await deleteCodespace(codespaceName) } catch {}
    }
  }
}

// ── Available Repos for Codespaces ──

export async function listAvailableRepos() {
  // List user's repos that support codespaces
  const data = await githubFetch('/user/repos?per_page=30&sort=updated&affiliation=owner')
  return data.map(r => ({
    id: r.id,
    full_name: r.full_name,
    private: r.private,
    language: r.language,
    default_branch: r.default_branch,
  }))
}

// ── Cleanup ──

export function cleanup() {
  githubToken = null
}
