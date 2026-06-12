// ── Kaggle API Client for Kivora ──
// Executes Python code on Kaggle Kernels (free T4/P100 GPUs, TPU v3-8)
// Auth: API key (username + key from kaggle.json)
// API docs: https://github.com/Kaggle/kaggle-api

let kaggleCredentials = null // { username, key }

// ── Credential Management ──

export function setKaggleCredentials(username, key) {
  kaggleCredentials = { username, key }
}

export function isKaggleAvailable() {
  return !!kaggleCredentials?.key
}

export function getKaggleCredentials() {
  return kaggleCredentials
}

// ── Internal Helpers ──

function getAuthHeader() {
  if (!kaggleCredentials) throw new Error('Kaggle credentials not set')
  const { username, key } = kaggleCredentials
  return 'Basic ' + btoa(`${username}:${key}`)
}

async function kaggleFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `https://www.kaggle.com/api/v1${path}`
  const headers = {
    'Authorization': getAuthHeader(),
    'Content-Type': 'application/json',
    ...options.headers,
  }
  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Kaggle API ${res.status}: ${text || res.statusText}`)
  }
  // Some endpoints return empty body
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  return res.text()
}

// ── Kernel Metadata Builder ──

function buildKernelMetadata(code, options = {}) {
  const {
    gpu = false,
    tpu = false,
    internet = true,
    competitionDataSources = [],
    datasetDataSources = [],
    kernelDataSources = [],
    language = 'python',
  } = options

  // Determine accelerator
  let accelerator = 'none'
  if (tpu) accelerator = 'tpuv3-8'
  else if (gpu) accelerator = 'nvidia-tesla-t4' // Default free GPU

  // Generate a unique slug
  const slug = `kivora-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    id: `kivora/kivora-gpu-job`,
    title: `Kivora GPU Job ${Date.now()}`,
    code_file: 'script.py',
    language,
    kernel_type: 'script',
    is_private: 'true',
    enable_gpu: gpu || tpu ? 'true' : 'false',
    enable_internet: internet ? 'true' : 'false',
    enable_tpu: tpu ? 'true' : 'false',
    competition_data_sources: competitionDataSources,
    dataset_data_sources: datasetDataSources,
    kernel_data_sources: kernelDataSources,
    keywords: ['kivora', 'gpu-job'],
    slug,
  }
}

// ── GPU Accelerator Options ──

export function getKaggleAcceleratorOptions() {
  return [
    { id: 'T4', name: 'NVIDIA T4 (Free)', vram: '16GB', type: 'gpu', accelerator: 'nvidia-tesla-t4' },
    { id: 'P100', name: 'NVIDIA P100', vram: '16GB', type: 'gpu', accelerator: 'nvidia-tesla-p100' },
    { id: 'TPU-v3-8', name: 'TPU v3-8 (Free)', vram: '8GB+', type: 'tpu', accelerator: 'tpuv3-8' },
  ]
}

function resolveAccelerator(gpu, tpu) {
  const options = getKaggleAcceleratorOptions()
  if (tpu) {
    const match = options.find(o => o.id === tpu || o.accelerator === tpu)
    return match || options.find(o => o.type === 'tpu')
  }
  if (gpu) {
    const match = options.find(o => o.id === gpu || o.accelerator === gpu)
    return match || options[0] // Default T4
  }
  return options[0] // Default T4
}

// ── Core: Push & Run Kernel ──

export async function pushKernel(code, options = {}) {
  const { gpu, tpu, installPackages, timeout } = options
  const accel = resolveAccelerator(gpu, tpu)
  const isGpu = accel.type === 'gpu'
  const isTpu = accel.type === 'tpu'

  // Prepend pip installs if needed
  let fullCode = code
  if (installPackages && installPackages.length > 0) {
    const installLine = `import subprocess; subprocess.check_call(['pip', 'install', '-q'] + ${JSON.stringify(installPackages)})\n`
    fullCode = installLine + fullCode
  }

  // Kaggle kernel push API expects a multipart upload with metadata JSON + code file
  const metadata = buildKernelMetadata(fullCode, {
    gpu: isGpu || isTpu,
    tpu: isTpu,
    internet: true,
  })

  // Build multipart form data
  const formData = new FormData()
  formData.append('metadata', JSON.stringify(metadata))

  // Create a Blob from the code (simulating file upload)
  const codeBlob = new Blob([fullCode], { type: 'text/x-python' })
  formData.append('code_file', codeBlob, 'script.py')

  // Push the kernel
  const url = 'https://www.kaggle.com/api/v1/kernels/push'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(),
    },
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Kaggle push failed (${res.status}): ${text}`)
  }

  const result = await res.json()
  return {
    ref: result.ref,
    url: result.url,
    slug: metadata.slug,
    accelerator: accel,
    status: 'queued',
  }
}

// ── Check Kernel Status ──

export async function getKernelStatus(kernelSlug) {
  const data = await kaggleFetch(`/kernels/list?search=${encodeURIComponent(kernelSlug)}&page=1&pageSize=1`)
  if (!data || !data.length) {
    // Try by status endpoint
    try {
      const status = await kaggleFetch(`/kernels/status/${kernelSlug}`)
      return status
    } catch {
      return { status: 'unknown' }
    }
  }
  return data[0]
}

// ── Pull Kernel Output ──

export async function pullKernelOutput(kernelSlug) {
  try {
    const output = await kaggleFetch(`/kernels/output/${kernelSlug}`)
    return output
  } catch (err) {
    throw new Error(`Failed to pull kernel output: ${err.message}`)
  }
}

// ── Wait for Kernel Completion ──

export async function waitForKernel(kernelSlug, timeoutMs = 300000) {
  const startTime = Date.now()
  const pollInterval = 5000 // 5 seconds

  while (Date.now() - startTime < timeoutMs) {
    try {
      const status = await getKernelStatus(kernelSlug)

      if (status.status === 'complete' || status.status === 'finished') {
        return { success: true, status: 'complete' }
      }
      if (status.status === 'error' || status.status === 'cancelAcknowledged') {
        return { success: false, status: status.status, error: status.failureMessage || 'Kernel execution failed' }
      }
      // Still running or queued — wait and poll
    } catch {
      // Status check failed — keep trying
    }

    await new Promise(r => setTimeout(r, pollInterval))
  }

  return { success: false, status: 'timeout', error: `Kernel did not complete within ${timeoutMs / 1000}s` }
}

// ── High-Level: Run GPU Job (One-shot) ──

export async function runKaggleGpuJob(code, options = {}) {
  const { gpu, tpu, installPackages, timeout = 120 } = options
  const timeoutMs = Math.min(timeout * 1000, 300000)

  // 1. Push the kernel
  const pushResult = await pushKernel(code, {
    gpu: gpu || 'T4',
    tpu,
    installPackages,
  })

  // 2. Wait for completion
  const waitResult = await waitForKernel(pushResult.slug, timeoutMs)

  // 3. Pull output if successful
  if (waitResult.success) {
    try {
      const outputs = await pullKernelOutput(pushResult.slug)

      // Parse output — Kaggle returns array of output items
      let outputText = ''
      let errorText = ''
      const files = []

      if (Array.isArray(outputs)) {
        for (const item of outputs) {
          if (item.type === 'execute_result' || item.type === 'stream' && item.name === 'stdout') {
            outputText += (item.text || item.data || '') + '\n'
          } else if (item.type === 'stream' && item.name === 'stderr') {
            errorText += (item.text || '') + '\n'
          } else if (item.type === 'display_data') {
            // Could be images, etc.
            if (item.data?.['text/plain']) outputText += item.data['text/plain'] + '\n'
          } else if (item.fileName) {
            files.push({ name: item.fileName, url: item.url })
          }
        }
      }

      return {
        success: true,
        output: outputText.trim() || '(no output)',
        error: errorText.trim() || null,
        executor: 'kaggle',
        accelerator: pushResult.accelerator.id,
        acceleratorName: pushResult.accelerator.name,
        files,
        sessionUsed: pushResult.slug,
        kernelUrl: pushResult.url,
      }
    } catch (pullErr) {
      return {
        success: true,
        output: `Kernel completed but could not retrieve output: ${pullErr.message}`,
        error: null,
        executor: 'kaggle',
        accelerator: pushResult.accelerator.id,
        acceleratorName: pushResult.accelerator.name,
        sessionUsed: pushResult.slug,
      }
    }
  }

  // Failed or timed out
  return {
    success: false,
    output: null,
    error: waitResult.error || `Kernel ${waitResult.status}`,
    executor: 'kaggle',
    accelerator: pushResult.accelerator.id,
    acceleratorName: pushResult.accelerator.name,
    sessionUsed: pushResult.slug,
  }
}

// ── List Kernels ──

export async function listKernels(page = 1, pageSize = 20) {
  return kaggleFetch(`/kernels/list?page=${page}&pageSize=${pageSize}`)
}

// ── Dataset Utilities ──

export async function listDatasets(page = 1, pageSize = 20) {
  return kaggleFetch(`/datasets/list?page=${page}&pageSize=${pageSize}`)
}

export async function downloadDataset(datasetSlug) {
  // Returns the dataset files list
  return kaggleFetch(`/datasets/list/${datasetSlug}`)
}

// ── Competition Utilities ──

export async function listCompetitions(page = 1) {
  return kaggleFetch(`/competitions/list?page=${page}`)
}

export async function getCompetition(competitionId) {
  return kaggleFetch(`/competitions/data/${competitionId}`)
}

// ── Cleanup ──

export function cleanup() {
  kaggleCredentials = null
}
