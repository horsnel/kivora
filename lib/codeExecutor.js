// ── Unified Code Executor — Smart Router for Kivora ──
// Routes code execution requests to the best available backend:
//   1. E2B       — fastest (150ms cold start), ephemeral, Jupyter-based, multi-language
//   2. Kaggle    — free GPU (T4/P100), TPU v3-8, API key auth
//   3. Colab     — more GPU types (T4/L4/A100/H100), TPUs, needs OAuth token
//   4. Codespaces — full IDE, any language, persistent, 30-90s cold start
//
// Decision logic:
//   - Needs GPU/TPU?  → Kaggle (free T4) or Colab (premium GPUs)
//   - Quick CPU task?  → E2B (fastest, Jupyter stateful)
//   - Full dev env?    → Codespaces (devcontainer, persistent)
//   - Fallback:        → E2B → Kaggle → Colab → Codespaces → Judge0 (CPU)

// ── Backend Availability Checks ──

let backends = {}

export function registerBackend(name, available, executor) {
  backends[name] = { available, executor }
}

export function getAvailableBackends() {
  const available = {}
  for (const [name, backend] of Object.entries(backends)) {
    if (backend.available()) available[name] = true
  }
  return available
}

// ── Routing Decision Engine ──

export function selectBackend(requirements = {}) {
  const {
    needsGpu = false,
    needsTpu = false,
    needsLargeMemory = false,
    needsPersistentEnv = false,
    needsDevContainer = false,
    needsMultiLanguage = false,
    language = 'python',
    gpuType,
    tpuType,
    preferredPlatform,
    maxColdStart = Infinity,  // ms — reject backends slower than this
  } = requirements

  const available = getAvailableBackends()

  // ── If user explicitly picks a platform, use it ──
  if (preferredPlatform) {
    const key = preferredPlatform.toLowerCase()
    if (available[key]) return key
    // Try aliases
    const aliases = {
      'e2b': 'e2b', 'sandbox': 'e2b',
      'kaggle': 'kaggle', 'kernels': 'kaggle',
      'colab': 'colab', 'google-colab': 'colab',
      'codespaces': 'codespaces', 'github': 'codespaces', 'gh': 'codespaces',
    }
    const resolved = aliases[key]
    if (resolved && available[resolved]) return resolved
    return null // Preferred but not available
  }

  // ── Smart routing based on requirements ──

  // Full dev environment needed → Codespaces
  if (needsDevContainer || needsPersistentEnv) {
    if (available.codespaces) return 'codespaces'
  }

  // GPU/TPU needed → Kaggle (free T4) or Colab (premium GPUs)
  if (needsGpu || needsTpu) {
    // Premium GPU types (L4, A100, H100) → only Colab has them
    const premiumGpus = ['L4', 'A100', 'H100']
    if (gpuType && premiumGpus.includes(gpuType) && available.colab) return 'colab'

    // TPU types beyond v3-8 → Colab only
    const colabTpus = ['v5e1', 'v6e1', 'V2-8']
    if (tpuType && colabTpus.includes(tpuType) && available.colab) return 'colab'

    // Standard GPU (T4, P100) → Kaggle first (easiest, free), then Colab
    if (available.kaggle) return 'kaggle'
    if (available.colab) return 'colab'

    // No GPU backends available — fall through to CPU
  }

  // Large memory needed → Codespaces (up to 64GB)
  if (needsLargeMemory && available.codespaces) return 'codespaces'

  // Multi-language (not Python) → E2B (Jupyter supports JS/R/Java/Bash) or Codespaces
  if (needsMultiLanguage) {
    if (available.e2b) return 'e2b'
    if (available.codespaces) return 'codespaces'
  }

  // Default: E2B is fastest for CPU tasks
  if (available.e2b) return 'e2b'

  // Fallback chain for CPU tasks
  if (available.kaggle) return 'kaggle'  // Can run CPU kernels too
  if (available.colab) return 'colab'    // Can run CPU notebooks
  if (available.codespaces) return 'codespaces'

  return null // No backend available
}

// ── Execute with Smart Routing ──

export async function executeWithRouting(code, options = {}) {
  const {
    needsGpu = false,
    needsTpu = false,
    gpu = 'T4',
    tpu,
    language = 'python',
    installPackages = [],
    timeout = 120,
    preferredPlatform,
    repository,        // For Codespaces
    machine,           // For Codespaces
  } = options

  // Select the best backend
  const backend = selectBackend({
    needsGpu: needsGpu || !!gpu,
    needsTpu: needsTpu || !!tpu,
    gpuType: gpu,
    tpuType: tpu,
    language,
    preferredPlatform,
    needsMultiLanguage: language !== 'python',
  })

  if (!backend) {
    return {
      success: false,
      output: null,
      error: 'No code execution backend available. Set at least one: E2B_API_KEY, KAGGLE_USERNAME+KAGGLE_KEY, GOOGLE_COLAB_ACCESS_TOKEN, or GITHUB_TOKEN.',
      executor: 'none',
      fallback: 'cpu',
      suggestion: 'For easiest setup, add KAGGLE_USERNAME + KAGGLE_KEY (free T4 GPU) or E2B_API_KEY (fastest CPU execution).',
    }
  }

  // ── Execute on selected backend ──
  try {
    switch (backend) {
      case 'e2b': {
        const e2b = await import('@/lib/e2b')
        const result = await e2b.runE2BCode(code, {
          language,
          timeout,
          installPackages,
        })
        return {
          ...result,
          backend: 'e2b',
          backendName: 'E2B Sandbox',
        }
      }

      case 'kaggle': {
        const kaggle = await import('@/lib/kaggle')
        const result = await kaggle.runKaggleGpuJob(code, {
          gpu: tpu ? undefined : (gpu || 'T4'),
          tpu: tpu === 'v3-8' ? 'v3-8' : undefined,
          installPackages,
          timeout,
        })
        return {
          success: result.success,
          output: result.output,
          error: result.error,
          executor: 'kaggle',
          backend: 'kaggle',
          backendName: 'Kaggle Kernels',
          accelerator: result.accelerator || gpu || 'T4',
          acceleratorName: result.acceleratorName || 'NVIDIA T4 (Free)',
          files: result.files || [],
          sessionUsed: result.sessionUsed,
        }
      }

      case 'colab': {
        const colab = await import('@/lib/colab')
        const colabGpu = tpu ? undefined : (gpu || 'T4')
        const result = await colab.runGpuJob(code, {
          gpu: colabGpu,
          tpu,
          timeout: Math.min(timeout * 1000, 300000),
        })
        return {
          success: result.success,
          output: result.output,
          error: result.error,
          executor: 'google-colab',
          backend: 'colab',
          backendName: 'Google Colab',
          accelerator: result.accelerator || colabGpu || tpu || 'T4',
          files: result.files || [],
          sessionUsed: result.sessionName,
        }
      }

      case 'codespaces': {
        const cs = await import('@/lib/codespaces')
        const result = await cs.runInCodespace(code, {
          repository,
          machine: machine || 'standardLinux8gb',
          language,
          timeout,
        })
        return {
          ...result,
          backend: 'codespaces',
          backendName: 'GitHub Codespaces',
        }
      }

      default:
        return {
          success: false,
          error: `Unknown backend: ${backend}`,
          executor: 'none',
        }
    }
  } catch (err) {
    // ── Auto-fallback: try next best backend ──
    const fallbackChain = getFallbackChain(backend)
    for (const fallback of fallbackChain) {
      if (getAvailableBackends()[fallback]) {
        try {
          return await executeWithRouting(code, {
            ...options,
            preferredPlatform: fallback,
          })
        } catch {
          continue // Try next fallback
        }
      }
    }

    return {
      success: false,
      output: null,
      error: `${backend} failed: ${err.message}. All fallbacks also failed.`,
      executor: backend,
      fallback: 'cpu',
    }
  }
}

// ── Fallback Priority Chain ──

function getFallbackChain(failedBackend) {
  const chains = {
    'e2b': ['kaggle', 'colab', 'codespaces'],
    'kaggle': ['colab', 'e2b', 'codespaces'],
    'colab': ['kaggle', 'e2b', 'codespaces'],
    'codespaces': ['e2b', 'kaggle', 'colab'],
  }
  return chains[failedBackend] || ['e2b', 'kaggle', 'colab', 'codespaces']
}

// ── Backend Comparison (for UI/decision transparency) ──

export function getBackendComparison() {
  return [
    {
      id: 'e2b',
      name: 'E2B Sandbox',
      description: 'Fastest CPU execution — Firecracker microVMs, 150ms cold start, Jupyter stateful',
      bestFor: 'Quick code execution, data analysis, multi-language',
      gpu: false,
      coldStart: '150ms',
      languages: ['Python', 'JavaScript', 'R', 'Java', 'Bash'],
      auth: 'E2B_API_KEY',
      free: '$100 credits',
    },
    {
      id: 'kaggle',
      name: 'Kaggle Kernels',
      description: 'Free GPU (T4/P100) + TPU v3-8, simple API key auth',
      bestFor: 'ML training, GPU inference, competitions',
      gpu: true,
      gpuTypes: ['T4', 'P100'],
      tpuTypes: ['v3-8'],
      coldStart: '~30s',
      languages: ['Python', 'R'],
      auth: 'KAGGLE_USERNAME + KAGGLE_KEY',
      free: '30h/week GPU',
    },
    {
      id: 'colab',
      name: 'Google Colab',
      description: 'Premium GPUs (L4/A100/H100) + advanced TPUs, OAuth required',
      bestFor: 'Heavy ML workloads, large model training',
      gpu: true,
      gpuTypes: ['T4', 'L4', 'A100', 'H100'],
      tpuTypes: ['v5e1', 'v6e1', 'V2-8'],
      coldStart: '~30s',
      languages: ['Python'],
      auth: 'GOOGLE_COLAB_ACCESS_TOKEN',
      free: 'T4 free tier',
    },
    {
      id: 'codespaces',
      name: 'GitHub Codespaces',
      description: 'Full dev environment, any language, up to 64GB RAM, persistent',
      bestFor: 'Full-stack development, devcontainers, long-running tasks',
      gpu: false,
      coldStart: '30-90s',
      languages: ['Any'],
      auth: 'GITHUB_TOKEN (codespace scope)',
      free: '120 core-hours/month',
    },
  ]
}
