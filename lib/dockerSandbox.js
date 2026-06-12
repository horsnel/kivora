// ── Docker Sandbox Client for Kivora ──
// Uses the Docker Engine REST API for sandbox execution on a remote Docker host.
// Auth: DOCKER_HOST_URL (e.g. https://your-host:2376) + optional DOCKER_TLS_*
//
// This backend is ideal for self-hosted sandboxes — works with any Docker host:
//   - Docker Desktop (local or remote)
//   - VPS with Docker installed (Hetzner, DigitalOcean, etc.)
//   - Docker-in-Docker (DinD) setups
//   - Kubernetes pods with Docker socket
//
// The Docker Engine API provides full container lifecycle:
//   create → start → exec → logs → stop → remove
// Plus filesystem operations via archive upload/download.
//
// Provider priority: Daytona → Docker → Cloudflare Sandbox → Judge0 (fallback)

let dockerHostUrl = null       // e.g. 'https://host:2376' or 'http://host:2375'
let dockerTlsCa = null         // TLS CA cert (PEM string)
let dockerTlsCert = null       // TLS client cert (PEM string)
let dockerTlsKey = null        // TLS client key (PEM string)

// Default images for each language
const DEFAULT_IMAGES = {
  python: 'python:3.12-slim',
  javascript: 'node:20-slim',
  typescript: 'node:20-slim',
  bash: 'bash:5',
  java: 'eclipse-temurin:21-jre',
  cpp: 'gcc:13',
  c: 'gcc:13',
  go: 'golang:1.22',
  rust: 'rust:1.77-slim',
  ruby: 'ruby:3.3-slim',
  php: 'php:8.3-cli',
  r: 'rocker/r-base:latest',
}

// In-memory container cache (sessionId → { containerId, image, createdAt })
const activeContainers = new Map()

// ── Credential Management ──

export function setDockerHost(url) {
  dockerHostUrl = url?.replace(/\/$/, '')
}

export function setDockerTls({ ca, cert, key } = {}) {
  if (ca) dockerTlsCa = ca
  if (cert) dockerTlsCert = cert
  if (key) dockerTlsKey = key
}

export function isDockerSandboxAvailable() {
  return !!dockerHostUrl
}

// ── Docker Engine API Helper ──

async function dockerFetch(path, options = {}) {
  if (!dockerHostUrl) throw new Error('Docker host URL not configured')

  const url = `${dockerHostUrl}${path}`
  const headers = options.headers || {}

  // Note: In Cloudflare Workers edge runtime, we can't use custom TLS certs directly.
  // For production, use a TCP → HTTPS proxy (like docker-socket-proxy) or SSH tunnel.
  // The simplest setup: expose Docker API over HTTP on a private network,
  // or use tecnativa/docker-socket-proxy which adds auth + filtering.

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    signal: options.signal || AbortSignal.timeout(options.timeout || 30000),
  })

  return res
}

// ── Container Lifecycle ──

/**
 * Create and start a Docker container for sandbox use.
 * @param {Object} options
 * @param {string} options.sessionId - Optional session ID for container reuse
 * @param {string} options.image - Docker image (default: python:3.12-slim)
 * @param {string} options.language - Language key for auto-selecting image
 * @param {Object} options.envVars - Environment variables
 * @param {number} options.memoryMB - Memory limit in MB (default: 512)
 * @param {number} options.cpuQuota - CPU quota in microseconds (default: 100000 = 1 CPU)
 * @param {string} options.workingDir - Working directory inside container
 * @returns {Promise<{containerId: string, sessionId: string}>}
 */
export async function createContainer(options = {}) {
  const {
    sessionId = `kivora-docker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    image,
    language = 'python',
    envVars = {},
    memoryMB = 512,
    cpuQuota = 100000,
    workingDir = '/workspace',
  } = options

  if (!isDockerSandboxAvailable()) {
    return { success: false, error: 'Docker host not configured. Set DOCKER_HOST_URL.' }
  }

  // Reuse existing container for this session
  const existing = activeContainers.get(sessionId)
  if (existing) {
    try {
      const inspectRes = await dockerFetch(`/containers/${existing.containerId}/json`)
      if (inspectRes.ok) {
        const data = await inspectRes.json()
        if (data.State?.Running) {
          return { containerId: existing.containerId, sessionId }
        }
        // Container exists but stopped — restart it
        const startRes = await dockerFetch(`/containers/${existing.containerId}/start`, { method: 'POST' })
        if (startRes.ok || startRes.status === 204) {
          return { containerId: existing.containerId, sessionId }
        }
      }
    } catch {
      // Container gone — create a new one
      activeContainers.delete(sessionId)
    }
  }

  const resolvedImage = image || DEFAULT_IMAGES[language] || DEFAULT_IMAGES.python

  // Create the container
  const envArray = Object.entries(envVars).map(([k, v]) => `${k}=${v}`)

  const createBody = {
    Image: resolvedImage,
    Cmd: ['sleep', '3600'],  // Keep container alive for 1 hour
    Tty: true,
    OpenStdin: true,
    WorkingDir: workingDir,
    Env: envArray,
    HostConfig: {
      Memory: memoryMB * 1024 * 1024,      // bytes
      NanoCpus: cpuQuota * 1e7,              // convert microseconds to nanocpus
      AutoRemove: false,
      NetworkMode: 'bridge',                 // Allow internet access
    },
  }

  try {
    const createRes = await dockerFetch('/containers/create', {
      method: 'POST',
      body: JSON.stringify(createBody),
      timeout: 60000, // Image pull can take time
    })

    if (!createRes.ok) {
      // If image not found locally, try to pull it first
      if (createRes.status === 404) {
        const pullRes = await dockerFetch(`/images/create?fromImage=${encodeURIComponent(resolvedImage)}`, {
          method: 'POST',
          timeout: 120000, // Pull can take a while
        })
        if (!pullRes.ok && pullRes.status !== 200) {
          const errText = await pullRes.text()
          return { success: false, error: `Failed to pull image ${resolvedImage}: ${errText.slice(0, 300)}` }
        }
        // Retry container creation after pull
        const retryRes = await dockerFetch('/containers/create', {
          method: 'POST',
          body: JSON.stringify(createBody),
          timeout: 30000,
        })
        if (!retryRes.ok) {
          const errText = await retryRes.text()
          return { success: false, error: `Docker create failed after pull: ${errText.slice(0, 300)}` }
        }
        const retryData = await retryRes.json()
        const containerId = retryData.Id

        // Start the container
        await dockerFetch(`/containers/${containerId}/start`, { method: 'POST' })

        // Create workspace directory
        await dockerExec(containerId, `mkdir -p ${workingDir}`)

        activeContainers.set(sessionId, { containerId, image: resolvedImage, createdAt: Date.now() })
        return { containerId, sessionId }
      }

      const errText = await createRes.text()
      return { success: false, error: `Docker create failed: ${errText.slice(0, 300)}` }
    }

    const createData = await createRes.json()
    const containerId = createData.Id

    // Start the container
    const startRes = await dockerFetch(`/containers/${containerId}/start`, { method: 'POST' })
    if (!startRes.ok && startRes.status !== 204) {
      const errText = await startRes.text()
      // Cleanup failed start
      try { await dockerFetch(`/containers/${containerId}?force=true`, { method: 'DELETE' }) } catch {}
      return { success: false, error: `Docker start failed: ${errText.slice(0, 300)}` }
    }

    // Create workspace directory
    await dockerExec(containerId, `mkdir -p ${workingDir}`)

    activeContainers.set(sessionId, { containerId, image: resolvedImage, createdAt: Date.now() })
    return { containerId, sessionId }
  } catch (err) {
    return { success: false, error: `Docker sandbox creation failed: ${err.message}` }
  }
}

/**
 * Get or create a container for a session.
 */
export async function getOrCreateContainer(sessionId, options = {}) {
  if (sessionId) {
    const existing = activeContainers.get(sessionId)
    if (existing) {
      try {
        const inspectRes = await dockerFetch(`/containers/${existing.containerId}/json`)
        if (inspectRes.ok) {
          const data = await inspectRes.json()
          if (data.State?.Running) {
            return { containerId: existing.containerId, sessionId }
          }
          // Restart stopped container
          const startRes = await dockerFetch(`/containers/${existing.containerId}/start`, { method: 'POST' })
          if (startRes.ok || startRes.status === 204) {
            return { containerId: existing.containerId, sessionId }
          }
        }
      } catch {
        activeContainers.delete(sessionId)
      }
    }
  }

  return await createContainer({ sessionId: sessionId || undefined, ...options })
}

// ── Command Execution ──

/**
 * Execute a command inside a Docker container.
 * @param {string} containerId - Docker container ID
 * @param {string} command - Shell command to run
 * @param {Object} options
 * @param {string} options.workingDir - Working directory (default: /workspace)
 * @param {number} options.timeout - Timeout in seconds (default: 30)
 * @returns {Promise<{success: boolean, output: string, exitCode: number}>}
 */
async function dockerExec(containerId, command, options = {}) {
  const {
    workingDir = '/workspace',
    timeout = 30,
  } = options

  // Create exec instance
  const execCreateRes = await dockerFetch(`/containers/${containerId}/exec`, {
    method: 'POST',
    body: JSON.stringify({
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: workingDir,
      Cmd: ['/bin/sh', '-c', command],
    }),
  })

  if (!execCreateRes.ok) {
    const errText = await execCreateRes.text()
    return { success: false, output: '', exitCode: -1, error: `Exec create failed: ${errText.slice(0, 300)}` }
  }

  const execData = await execCreateRes.json()
  const execId = execData.Id

  // Start the exec instance
  const execStartRes = await dockerFetch(`/exec/${execId}/start`, {
    method: 'POST',
    body: JSON.stringify({
      Detach: false,
      Tty: false,
    }),
    headers: {
      'Content-Type': 'application/json',
      // Docker API returns raw stream with multiplexed headers
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(timeout * 1000),
  })

  // Get the output (Docker streams have 8-byte headers: [stream_type(1), padding(3), size(4)])
  let output = ''
  try {
    const buffer = await execStartRes.arrayBuffer()
    output = demuxDockerStream(buffer)
  } catch {
    output = ''
  }

  // Get exit code
  const execInspectRes = await dockerFetch(`/exec/${execId}/json`)
  let exitCode = 0
  if (execInspectRes.ok) {
    const inspectData = await execInspectRes.json()
    exitCode = inspectData.ExitCode ?? 0
  }

  return {
    success: exitCode === 0,
    output: output || '(no output)',
    exitCode,
  }
}

/**
 * Demultiplex Docker's stream format.
 * Docker API returns: [1-byte stream type (1=stdout, 2=stderr)][3 bytes padding][4-byte size][payload]...
 */
function demuxDockerStream(buffer) {
  const view = new DataView(buffer)
  const chunks = []
  let offset = 0

  while (offset + 8 <= view.byteLength) {
    const streamType = view.getUint8(offset)
    // Skip 3 padding bytes
    const size = view.getUint32(offset + 4, false) // big-endian
    offset += 8

    if (offset + size > view.byteLength) break

    const chunk = new Uint8Array(buffer, offset, size)
    chunks.push(new TextDecoder().decode(chunk))
    offset += size
  }

  // If no multiplexed headers found, treat as raw output
  if (chunks.length === 0 && buffer.byteLength > 0) {
    return new TextDecoder().decode(buffer)
  }

  return chunks.join('')
}

// ── High-Level API ──

/**
 * Execute a shell command in a Docker sandbox.
 * @param {string} sessionId - Session ID for container reuse
 * @param {string} command - Shell command to run
 * @param {Object} options
 * @param {string} options.cwd - Working directory
 * @param {Object} options.env - Environment variables
 * @param {number} options.timeout - Timeout in seconds
 * @returns {Promise<{success: boolean, output: string, exitCode: number, executor: string}>}
 */
export async function execCommand(sessionId, command, options = {}) {
  const {
    cwd = '/workspace',
    env = {},
    timeout = 120,
  } = options

  if (!isDockerSandboxAvailable()) {
    return { success: false, output: null, error: 'Docker host not configured', executor: 'docker' }
  }

  try {
    const { containerId } = await getOrCreateContainer(sessionId)

    // Build env prefix if provided
    let envPrefix = ''
    if (Object.keys(env).length > 0) {
      envPrefix = Object.entries(env).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ') + ' '
    }

    const fullCommand = envPrefix + command
    const result = await dockerExec(containerId, fullCommand, { workingDir: cwd, timeout })

    return {
      ...result,
      executor: 'docker',
      backendName: 'Docker Sandbox',
      sessionId,
    }
  } catch (err) {
    return {
      success: false,
      output: null,
      error: `Docker exec failed: ${err.message}`,
      executor: 'docker',
    }
  }
}

/**
 * Run code in a Docker sandbox (stateless — creates, runs, optionally cleans up).
 * @param {string} code - Code to execute
 * @param {Object} options
 * @param {string} options.language - 'python', 'javascript', 'typescript', etc.
 * @param {string} options.sessionId - Optional session for persistent container
 * @param {number} options.timeout - Timeout in seconds (default 120)
 * @returns {Promise<{success: boolean, output: string, exitCode: number, executor: string}>}
 */
export async function runDockerCode(code, options = {}) {
  const {
    language = 'python',
    sessionId,
    timeout = 120,
  } = options

  if (!isDockerSandboxAvailable()) {
    return { success: false, output: null, error: 'Docker host not configured. Set DOCKER_HOST_URL.', executor: 'docker' }
  }

  let containerId = null
  let shouldCleanup = false

  try {
    if (sessionId) {
      const result = await getOrCreateContainer(sessionId, { language })
      containerId = result.containerId
    } else {
      // One-shot: create, execute, destroy
      const result = await createContainer({ language })
      if (!result.containerId) {
        return { success: false, output: null, error: result.error || 'Failed to create container', executor: 'docker' }
      }
      containerId = result.containerId
      shouldCleanup = true
    }

    // Determine how to run the code based on language
    let command
    switch (language) {
      case 'python':
        command = `python3 -c ${JSON.stringify(code)}`
        break
      case 'javascript':
      case 'node':
        command = `node -e ${JSON.stringify(code)}`
        break
      case 'typescript':
        const tsFile = `/workspace/_exec_${Date.now()}.ts`
        await writeFileToContainer(containerId, tsFile, code)
        command = `npx tsx ${tsFile}`
        break
      case 'bash':
        command = code
        break
      case 'java':
        const javaFile = '/workspace/Main.java'
        await writeFileToContainer(containerId, javaFile, code)
        command = 'cd /workspace && javac Main.java && java Main'
        break
      case 'cpp':
        const cppFile = '/workspace/_exec.cpp'
        await writeFileToContainer(containerId, cppFile, code)
        command = 'cd /workspace && g++ -o _exec _exec.cpp && ./_exec'
        break
      case 'c':
        const cFile = '/workspace/_exec.c'
        await writeFileToContainer(containerId, cFile, code)
        command = 'cd /workspace && gcc -o _exec _exec.c && ./_exec'
        break
      case 'go':
        const goFile = '/workspace/_exec.go'
        await writeFileToContainer(containerId, goFile, code)
        command = 'cd /workspace && go run _exec.go'
        break
      case 'rust':
        const rsFile = '/workspace/_exec.rs'
        await writeFileToContainer(containerId, rsFile, code)
        command = 'cd /workspace && rustc _exec.rs -o _exec && ./_exec'
        break
      case 'ruby':
        command = `ruby -e ${JSON.stringify(code)}`
        break
      case 'php':
        command = `php -r ${JSON.stringify(code)}`
        break
      case 'r':
        const rFile = '/workspace/_exec.R'
        await writeFileToContainer(containerId, rFile, code)
        command = `Rscript ${rFile}`
        break
      default:
        command = `python3 -c ${JSON.stringify(code)}`
    }

    const result = await dockerExec(containerId, command, {
      workingDir: '/workspace',
      timeout,
    })

    return {
      ...result,
      executor: 'docker',
      backendName: 'Docker Sandbox',
      sessionId,
    }
  } catch (err) {
    return {
      success: false,
      output: null,
      error: `Docker execution failed: ${err.message}`,
      executor: 'docker',
    }
  } finally {
    if (shouldCleanup && containerId) {
      try {
        await dockerFetch(`/containers/${containerId}?force=true`, { method: 'DELETE' })
      } catch { /* cleanup failed */ }
    }
  }
}

// ── File Operations ──

/**
 * Write a file to a Docker container.
 * Uses the Docker Engine API /containers/{id}/archive endpoint.
 */
async function writeFileToContainer(containerId, path, content) {
  // Docker's archive endpoint expects a tar archive
  const fileName = path.split('/').pop()
  const tarBuffer = createTarBuffer(fileName, content)

  const url = `/containers/${containerId}/archive?path=${encodeURIComponent(path.substring(0, path.lastIndexOf('/')) || '/')}`
  const res = await dockerFetch(url, {
    method: 'PUT',
    body: tarBuffer,
    headers: {
      'Content-Type': 'application/x-tar',
    },
  })

  if (!res.ok) {
    // Fallback: use shell to write the file
    const base64 = btoa(unescape(encodeURIComponent(content)))
    const writeCmd = `mkdir -p ${path.substring(0, path.lastIndexOf('/'))} && echo "${base64}" | base64 -d > ${path}`
    return await dockerExec(containerId, writeCmd)
  }

  return { success: true, path }
}

/**
 * Read a file from a Docker container.
 */
async function readFileFromContainer(containerId, path) {
  // Use cat via exec — simpler and more reliable than tar archive extraction
  const result = await dockerExec(containerId, `cat ${path}`)
  if (result.success) {
    return { success: true, content: result.output, path }
  }
  return { success: false, error: result.output || 'File not found' }
}

/**
 * Write a file to a sandbox session.
 */
export async function writeFile(sessionId, path, content) {
  if (!isDockerSandboxAvailable()) {
    return { success: false, error: 'Docker host not configured' }
  }

  try {
    const { containerId } = await getOrCreateContainer(sessionId)
    const result = await writeFileToContainer(containerId, path, content)
    return result
  } catch (err) {
    return { success: false, error: `Docker write failed: ${err.message}` }
  }
}

/**
 * Read a file from a sandbox session.
 */
export async function readFile(sessionId, path) {
  if (!isDockerSandboxAvailable()) {
    return { success: false, error: 'Docker host not configured' }
  }

  try {
    const { containerId } = await getOrCreateContainer(sessionId)
    const result = await readFileFromContainer(containerId, path)
    return result
  } catch (err) {
    return { success: false, error: `Docker read failed: ${err.message}` }
  }
}

/**
 * List files in a directory inside a container.
 */
export async function listFiles(sessionId, path = '/workspace') {
  if (!isDockerSandboxAvailable()) {
    return { success: false, error: 'Docker host not configured' }
  }

  try {
    const { containerId } = await getOrCreateContainer(sessionId)
    const result = await dockerExec(containerId,
      `ls -la --time-style=+%s ${path} 2>/dev/null || echo "DIR_NOT_FOUND"`
    )

    if (!result.success || result.output.includes('DIR_NOT_FOUND')) {
      return { success: false, error: 'Directory not found' }
    }

    // Parse ls -la output
    const files = []
    for (const line of result.output.split('\n').slice(1)) { // Skip header line
      const match = line.match(/^([drwx-]{10})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+\d+\s+(\S+)\s+(.+)$/)
      if (match) {
        const [, perms, size, , name] = match
        if (name === '.' || name === '..') continue
        files.push({
          name,
          isDir: perms.startsWith('d'),
          size: parseInt(size, 10),
          path: `${path}/${name}`.replace(/\/+/g, '/'),
        })
      }
    }

    return { success: true, files }
  } catch (err) {
    return { success: false, error: `Docker list failed: ${err.message}` }
  }
}

/**
 * Create a folder inside a container.
 */
export async function createFolder(sessionId, path) {
  if (!isDockerSandboxAvailable()) {
    return { success: false, error: 'Docker host not configured' }
  }

  try {
    const { containerId } = await getOrCreateContainer(sessionId)
    const result = await dockerExec(containerId, `mkdir -p ${path}`)
    return { success: result.success, path }
  } catch (err) {
    return { success: false, error: `Docker mkdir failed: ${err.message}` }
  }
}

// ── Git Operations ──

/**
 * Clone a git repo into a Docker container.
 */
export async function gitClone(sessionId, repoUrl, options = {}) {
  const { branch, targetDir = '/workspace/repo' } = options

  if (!isDockerSandboxAvailable()) {
    return { success: false, error: 'Docker host not configured' }
  }

  try {
    const { containerId } = await getOrCreateContainer(sessionId)

    // Install git if not present
    await dockerExec(containerId, 'which git || (apt-get update -qq && apt-get install -y -qq git 2>/dev/null) || true', { timeout: 60 })

    let command = `git clone --depth 1`
    if (branch) command += ` --branch ${branch}`
    command += ` ${repoUrl} ${targetDir}`

    const result = await dockerExec(containerId, command, { timeout: 120 })

    return {
      success: result.success,
      output: result.output,
      exitCode: result.exitCode,
    }
  } catch (err) {
    return { success: false, error: `Docker git clone failed: ${err.message}` }
  }
}

// ── Container Management ──

/**
 * Stop a Docker container (can be restarted).
 */
export async function stopContainer(sessionId) {
  const entry = activeContainers.get(sessionId)
  if (!entry) return { success: false, error: 'Session not found' }

  try {
    await dockerFetch(`/containers/${entry.containerId}/stop`, { method: 'POST' })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Remove a Docker container and clean up.
 */
export async function removeContainer(sessionId) {
  const entry = activeContainers.get(sessionId)
  if (!entry) return { success: true }

  try {
    await dockerFetch(`/containers/${entry.containerId}?force=true`, { method: 'DELETE' })
  } catch { /* may already be gone */ }
  activeContainers.delete(sessionId)
  return { success: true }
}

/**
 * List all active Docker sandbox containers.
 */
export async function listContainers() {
  if (!isDockerSandboxAvailable()) return []

  const result = []
  for (const [sessionId, entry] of activeContainers.entries()) {
    try {
      const res = await dockerFetch(`/containers/${entry.containerId}/json`)
      if (res.ok) {
        const data = await res.json()
        result.push({
          sessionId,
          containerId: entry.containerId,
          image: entry.image,
          running: data.State?.Running || false,
          createdAt: entry.createdAt,
        })
      }
    } catch { /* container gone */ }
  }
  return result
}

// ── Cleanup All ──

export async function cleanup() {
  for (const [sessionId, entry] of activeContainers.entries()) {
    try {
      await dockerFetch(`/containers/${entry.containerId}?force=true`, { method: 'DELETE' })
    } catch { /* ignore */ }
  }
  activeContainers.clear()
  dockerHostUrl = null
}

// ── Health Check ──

export async function healthCheck() {
  if (!isDockerSandboxAvailable()) {
    return { available: false, reason: 'Docker host URL not set' }
  }

  try {
    const res = await dockerFetch('/info', { timeout: 5000 })
    if (res.ok) {
      const data = await res.json()
      return {
        available: true,
        dockerVersion: data.ServerVersion,
        containers: data.Containers,
        images: data.Images,
        os: data.OperatingSystem,
      }
    }
    return { available: false, reason: `Docker API returned ${res.status}` }
  } catch (err) {
    return { available: false, reason: err.message }
  }
}

// ── Tar Helper ──
// Creates a minimal tar archive in memory for file upload to Docker

function createTarBuffer(fileName, content) {
  const contentBytes = new TextEncoder().encode(content)
  const contentLen = contentBytes.length

  // Tar header: 512 bytes
  const header = new Uint8Array(512)
  const headerView = new DataView(header.buffer)

  // File name (0-99)
  writeString(header, fileName, 0, 100)
  // File mode (100-107)
  writeString(header, '0000644\0', 100, 8)
  // Owner ID (108-115)
  writeString(header, '0000000\0', 108, 8)
  // Group ID (116-123)
  writeString(header, '0000000\0', 116, 8)
  // File size in octal (124-135)
  writeString(header, contentLen.toString(8).padStart(11, '0') + '\0', 124, 12)
  // Modification time (136-147)
  writeString(header, Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136, 12)
  // Checksum placeholder (148-155) — spaces for calculation
  writeString(header, '        ', 148, 8)
  // Type flag (156)
  header[156] = 0x30 // '0' = regular file

  // Calculate checksum
  let checksum = 0
  for (let i = 0; i < 512; i++) checksum += header[i]
  writeString(header, checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8)

  // Padding to round content to 512-byte blocks
  const paddingLen = (512 - (contentLen % 512)) % 512

  // Combine: header + content + padding + end-of-archive (2x 512 zero bytes)
  const totalLen = 512 + contentLen + paddingLen + 1024
  const result = new Uint8Array(totalLen)
  result.set(header, 0)
  result.set(contentBytes, 512)
  // Rest is already zero (padding + end-of-archive)

  return result
}

function writeString(buffer, str, offset, maxLen) {
  for (let i = 0; i < Math.min(str.length, maxLen - 1); i++) {
    buffer[offset + i] = str.charCodeAt(i)
  }
}
