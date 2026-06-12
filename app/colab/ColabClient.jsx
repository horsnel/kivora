'use client'
import { useState, useEffect, useRef } from 'react'
import {
  IconCode, IconPlay, IconClose, IconDownload, IconPlus, IconSpinner,
  IconCheck, IconFile, IconFolder, IconWarning, IconChevronDown,
  IconMenu, IconCopy, IconClock, IconBulb,
} from '@/components/Icons'

// ── Accelerator options ──────────────────────────────────────────────────
const ACCELERATORS = [
  { id: 'cpu', label: 'CPU', desc: 'Standard CPU (free)', color: '#737373', tier: 'free' },
  { id: 'T4', label: 'T4 GPU', desc: '16GB VRAM — Standard free-tier GPU', color: '#22c55e', tier: 'free' },
  { id: 'L4', label: 'L4 GPU', desc: '24GB VRAM — Cost-effective training', color: '#22c55e', tier: 'pro' },
  { id: 'G4', label: 'G4 GPU', desc: 'NVIDIA GPU — Balanced performance', color: '#22c55e', tier: 'pro' },
  { id: 'A100', label: 'A100 GPU', desc: '40/80GB VRAM — High-performance', color: '#f59e0b', tier: 'premium' },
  { id: 'H100', label: 'H100 GPU', desc: '80GB VRAM — Latest-gen fastest', color: '#f59e0b', tier: 'premium' },
  { id: 'v5e1', label: 'v5e-1 TPU', desc: '1 core — Efficient training', color: '#3b82f6', tier: 'pro' },
  { id: 'v6e1', label: 'v6e-1 TPU', desc: '1 core — High performance TPU', color: '#3b82f6', tier: 'pro' },
]

// ── Pre-built code templates ─────────────────────────────────────────────
const TEMPLATES = [
  {
    name: 'GPU Check',
    description: 'Check GPU availability and specs',
    code: `import torch\nprint(f"PyTorch version: {torch.__version__}")\nprint(f"CUDA available: {torch.cuda.is_available()}")\nif torch.cuda.is_available():\n    print(f"GPU: {torch.cuda.get_device_name(0)}")\n    print(f"VRAM: {torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB")`,
    gpu: 'T4',
    packages: 'torch',
  },
  {
    name: 'Fine-tune with QLoRA',
    description: 'Fine-tune a small model using QLoRA',
    code: `from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments\nfrom peft import LoraConfig, get_peft_model\nfrom datasets import load_dataset\nimport torch\n\nprint("Loading model...")\nmodel_name = "google/gemma-3-1b-it"\ntokenizer = AutoTokenizer.from_pretrained(model_name)\nmodel = AutoModelForCausalLM.from_pretrained(\n    model_name,\n    torch_dtype=torch.float16,\n    device_map="auto",\n)\n\n# Apply QLoRA\nlora_config = LoraConfig(\n    r=8, lora_alpha=16,\n    target_modules=["q_proj", "v_proj"],\n    lora_dropout=0.05, bias="none",\n    task_type="CAUSAL_LM",\n)\nmodel = get_peft_model(model, lora_config)\nmodel.print_trainable_parameters()\nprint("Model ready for training!")`,
    gpu: 'T4',
    packages: 'transformers,datasets,peft,accelerate,bitsandbytes',
  },
  {
    name: 'Neural Network Training',
    description: 'Train a simple CNN on MNIST',
    code: `import torch\nimport torch.nn as nn\nimport torch.optim as optim\nfrom torchvision import datasets, transforms\n\n# Data\ntf = transforms.Compose([transforms.ToTensor()])\ntrain_ds = datasets.MNIST("/tmp/data", train=True, download=True, transform=tf)\ntrain_loader = torch.utils.data.DataLoader(train_ds, batch_size=64, shuffle=True)\n\n# Model\nclass Net(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.net = nn.Sequential(\n            nn.Conv2d(1, 32, 3, 1), nn.ReLU(),\n            nn.Conv2d(32, 64, 3, 1), nn.ReLU(),\n            nn.MaxPool2d(2), nn.Flatten(),\n            nn.Linear(9216, 128), nn.ReLU(),\n            nn.Linear(128, 10),\n        )\n    def forward(self, x): return self.net(x)\n\ndevice = "cuda" if torch.cuda.is_available() else "cpu"\nmodel = Net().to(device)\noptimizer = optim.Adam(model.parameters())\n\n# Train\nfor epoch in range(3):\n    total_loss = 0\n    for batch, (X, y) in enumerate(train_loader):\n        X, y = X.to(device), y.to(device)\n        pred = model(X)\n        loss = nn.functional.cross_entropy(pred, y)\n        optimizer.zero_grad()\n        loss.backward()\n        optimizer.step()\n        total_loss += loss.item()\n    avg = total_loss / len(train_loader)\n    print(f"Epoch {epoch+1}/3 — Loss: {avg:.4f}")\nprint(f"Training complete on {device}!")`,
    gpu: 'T4',
    packages: 'torchvision',
  },
  {
    name: 'Data Processing',
    description: 'Load and analyze a dataset with pandas',
    code: `import pandas as pd\nimport numpy as np\n\n# Create sample dataset\nnp.random.seed(42)\ndf = pd.DataFrame({\n    'city': np.random.choice(['Lagos', 'Nairobi', 'Accra', 'Cairo'], 1000),\n    'revenue': np.random.exponential(5000, 1000),\n    'users': np.random.poisson(50, 1000),\n    'category': np.random.choice(['Fintech', 'Health', 'EdTech', 'E-commerce'], 1000),\n})\n\nprint("=== Dataset Summary ===")\nprint(df.describe())\nprint("\\n=== Revenue by City ===")\nprint(df.groupby('city')['revenue'].agg(['mean', 'sum', 'count']))\nprint("\\n=== Top Category by Revenue ===")\nprint(df.groupby('category')['revenue'].sum().sort_values(ascending=False))`,
    gpu: null,
    packages: 'pandas,numpy',
  },
]

// ── Inline SVG icons specific to Colab ───────────────────────────────────
function IconGpu({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="5" width="12" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5 5V3M8 5V3M11 5V3M5 12v2M8 12v2M11 12v2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <rect x="4" y="7" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.6" />
      <rect x="7" y="7" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.6" />
      <rect x="10" y="7" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.6" />
    </svg>
  )
}

function IconTpu({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5 5h2v2H5zM9 5h2v2H9zM5 9h2v2H5zM9 9h2v2H9z" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

function IconUpload({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 11V2M4.5 5L8 1.5 11.5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12v1.5a1 1 0 001 1h10a1 1 0 001-1V12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}

function IconDrive({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 11l3-6h6l3 6H2z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M5 5l1.5-3h3L11 5" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M6.5 11L8 8l1.5 3" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
    </svg>
  )
}

function IconQuickRun({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 4h12M4 4v8a1 1 0 001 1h6a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M7 7v3M9 7v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M6 2h4v2H6z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}

function IconStop({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconPackage({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1.5l5.5 3v7L8 14.5l-5.5-3v-7L8 1.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M8 14.5V8M8 8L2.5 4.5M8 8l5.5-3.5" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  )
}

function IconConnect({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="5" cy="8" r="3" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="11" cy="8" r="3" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 6.5v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────
function formatUptime(isoString) {
  if (!isoString) return '—'
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return hrs < 24 ? `${hrs}h ${rem}m` : `${Math.floor(hrs / 24)}d ${hrs % 24}h`
}

function getAcceleratorColor(id) {
  const acc = ACCELERATORS.find(a => a.id === id)
  return acc ? acc.color : '#737373'
}

function isTpu(id) {
  return id?.startsWith('v') || id?.startsWith('V')
}

// ══════════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════════

export default function ColabClient() {
  // ── Auth state ──────────────────────────────────────────────────────
  const [accessToken, setAccessToken] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authConfigured, setAuthConfigured] = useState(true)

  // ── Session state ───────────────────────────────────────────────────
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [accelerator, setAccelerator] = useState('T4')
  const [accelDropdownOpen, setAccelDropdownOpen] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(false)

  // ── Code state ──────────────────────────────────────────────────────
  const [code, setCode] = useState('')
  const [packages, setPackages] = useState('')
  const [execLoading, setExecLoading] = useState(false)
  const [output, setOutput] = useState(null) // { stdout, stderr, exitCode, error, files, accelerator }

  // ── UI state ────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [outputTab, setOutputTab] = useState('output') // 'output' | 'files'
  const [files, setFiles] = useState([])
  const [toasts, setToasts] = useState([])
  const [fileDialog, setFileDialog] = useState(null) // { type: 'upload'|'download', sessionName: string }
  const [filePath, setFilePath] = useState('')

  const textareaRef = useRef(null)
  const accelDropdownRef = useRef(null)
  const templatePickerRef = useRef(null)

  // ── Load saved access token from localStorage ──────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kivora-colab-token')
      if (saved) setAccessToken(saved)
    } catch {}
  }, [])

  // ── Listen for OAuth postMessage ───────────────────────────────────
  useEffect(() => {
    function handleMessage(e) {
      if (e.data?.type === 'colab-auth-success') {
        const token = e.data.accessToken
        setAccessToken(token)
        try { localStorage.setItem('kivora-colab-token', token) } catch {}
        addToast('Google account connected!', 'success')
        // Auto-load sessions after auth
        loadSessions(token)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // ── Close dropdowns on click outside ───────────────────────────────
  useEffect(() => {
    function handleClick(e) {
      if (accelDropdownRef.current && !accelDropdownRef.current.contains(e.target)) {
        setAccelDropdownOpen(false)
      }
      if (templatePickerRef.current && !templatePickerRef.current.contains(e.target)) {
        setTemplatePickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Auto-resize textarea ───────────────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.max(200, textareaRef.current.scrollHeight) + 'px'
    }
  }, [code])

  // ── Toast system ───────────────────────────────────────────────────
  const toastId = useRef(0)
  function addToast(message, type = 'info') {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }

  // ── API helper ─────────────────────────────────────────────────────
  async function colabApi(body) {
    const res = await fetch('/api/colab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, accessToken }),
    })
    return res.json()
  }

  // ── Auth flow ──────────────────────────────────────────────────────
  async function startAuth() {
    setAuthLoading(true)
    try {
      const res = await fetch('/api/colab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auth-url' }),
      })
      const data = await res.json()

      if (!data.configured) {
        setAuthConfigured(false)
        addToast('Google Colab OAuth not configured on this server.', 'error')
        setAuthLoading(false)
        return
      }

      // Open OAuth popup
      const width = 520, height = 620
      const left = (screen.width - width) / 2
      const top = (screen.height - height) / 2
      window.open(
        data.authUrl,
        'colab-auth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      )
    } catch {
      addToast('Failed to start authentication.', 'error')
    }
    setAuthLoading(false)
  }

  function disconnect() {
    setAccessToken(null)
    try { localStorage.removeItem('kivora-colab-token') } catch {}
    setSessions([])
    setActiveSession(null)
    addToast('Disconnected from Google Colab.', 'info')
  }

  // ── Session management ─────────────────────────────────────────────
  async function loadSessions(token) {
    try {
      const res = await fetch('/api/colab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sessions', accessToken: token || accessToken }),
      })
      const data = await res.json()
      if (data.sessions) {
        setSessions(data.sessions)
      }
    } catch {}
  }

  async function createSession() {
    if (!accessToken) {
      addToast('Connect your Google account first.', 'warning')
      return
    }
    setSessionLoading(true)
    try {
      const data = await colabApi({
        action: 'new',
        gpu: accelerator !== 'cpu' && !isTpu(accelerator) ? accelerator : undefined,
        tpu: isTpu(accelerator) ? accelerator : undefined,
      })

      if (data.error) {
        addToast(data.error, 'error')
      } else {
        const newSession = {
          id: data.sessionId,
          name: data.name,
          accelerator: data.accelerator || accelerator,
          status: 'active',
          assignedAt: data.assignedAt || new Date().toISOString(),
        }
        setSessions(prev => [newSession, ...prev])
        setActiveSession(newSession)
        addToast(`Session "${data.name}" created with ${data.accelerator || accelerator}`, 'success')
      }
    } catch {
      addToast('Failed to create session.', 'error')
    }
    setSessionLoading(false)
  }

  async function stopSessionAction(sessionName) {
    try {
      const data = await colabApi({ action: 'stop', sessionName })
      if (data.success) {
        setSessions(prev => prev.filter(s => s.name !== sessionName))
        if (activeSession?.name === sessionName) setActiveSession(null)
        addToast(`Session "${sessionName}" stopped.`, 'success')
      } else {
        addToast(data.error || 'Failed to stop session.', 'error')
      }
    } catch {
      addToast('Failed to stop session.', 'error')
    }
  }

  // ── Code execution ─────────────────────────────────────────────────
  async function executeCode() {
    if (!code.trim()) {
      addToast('Enter some code to run.', 'warning')
      return
    }
    if (!accessToken) {
      addToast('Connect your Google account first.', 'warning')
      return
    }
    if (!activeSession) {
      addToast('Create or select a session first.', 'warning')
      return
    }

    setExecLoading(true)
    setOutput(null)
    setOutputTab('output')

    // Install packages first if specified
    if (packages.trim()) {
      try {
        const installData = await colabApi({
          action: 'install',
          sessionName: activeSession.name,
          packages: packages.split(',').map(p => p.trim()).filter(Boolean),
        })
        if (installData.error) {
          addToast(`Package install warning: ${installData.error}`, 'warning')
        }
      } catch {}
    }

    try {
      const data = await colabApi({
        action: 'exec',
        sessionName: activeSession.name,
        code,
        timeout: 120000,
      })
      setOutput({
        stdout: data.output || '',
        stderr: data.error || '',
        exitCode: data.exitCode ?? 0,
        success: data.success,
        accelerator: data.accelerator || activeSession.accelerator,
      })
    } catch {
      setOutput({
        stdout: '',
        stderr: 'Network error. Could not reach the server.',
        exitCode: 1,
        success: false,
      })
    }
    setExecLoading(false)
  }

  async function quickRun() {
    if (!code.trim()) {
      addToast('Enter some code to quick run.', 'warning')
      return
    }
    if (!accessToken) {
      addToast('Connect your Google account first.', 'warning')
      return
    }

    setExecLoading(true)
    setOutput(null)
    setOutputTab('output')

    // Install packages first if specified (via one-shot mechanism)
    if (packages.trim()) {
      const installCode = `import subprocess\nsubprocess.check_call(['pip', 'install', '-q'] + ${JSON.stringify(packages.split(',').map(p => p.trim()).filter(Boolean))})`
      try {
        await colabApi({
          action: 'run',
          code: installCode,
          gpu: accelerator !== 'cpu' && !isTpu(accelerator) ? accelerator : 'T4',
          tpu: isTpu(accelerator) ? accelerator : undefined,
        })
      } catch {}
    }

    try {
      const data = await colabApi({
        action: 'run',
        code,
        gpu: accelerator !== 'cpu' && !isTpu(accelerator) ? accelerator : 'T4',
        tpu: isTpu(accelerator) ? accelerator : undefined,
        timeout: 180000,
      })
      setOutput({
        stdout: data.output || '',
        stderr: data.error || '',
        exitCode: data.exitCode ?? 0,
        success: data.success,
        accelerator: data.accelerator,
        files: data.files || [],
      })
      addToast('Quick run complete — session auto-stopped.', 'success')
    } catch {
      setOutput({
        stdout: '',
        stderr: 'Network error. Could not reach the server.',
        exitCode: 1,
        success: false,
      })
    }
    setExecLoading(false)
  }

  // ── File management ────────────────────────────────────────────────
  async function listFilesAction() {
    if (!activeSession) {
      addToast('Select an active session first.', 'warning')
      return
    }
    try {
      const data = await colabApi({ action: 'ls', sessionName: activeSession.name })
      if (data.success && data.files) {
        setFiles(data.files)
        setOutputTab('files')
        addToast(`Found ${data.files.length} files.`, 'success')
      } else {
        addToast(data.error || 'Failed to list files.', 'error')
      }
    } catch {
      addToast('Failed to list files.', 'error')
    }
  }

  async function downloadFileAction(path) {
    if (!activeSession) return
    try {
      const data = await colabApi({ action: 'download', sessionName: activeSession.name, path })
      if (data.success && data.base64) {
        // Create a download link
        const byteChars = atob(data.base64)
        const byteNumbers = new Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray])
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = path.split('/').pop()
        a.click()
        URL.revokeObjectURL(url)
        addToast(`Downloaded ${path.split('/').pop()}`, 'success')
      } else {
        addToast(data.error || 'Download failed.', 'error')
      }
    } catch {
      addToast('Download failed.', 'error')
    }
  }

  async function uploadFileAction() {
    if (!activeSession || !filePath.trim()) return
    try {
      const data = await colabApi({
        action: 'upload',
        sessionName: activeSession.name,
        path: filePath.trim(),
        content: '', // Would need file content in base64
      })
      if (data.success) {
        addToast(`File uploaded to ${filePath}`, 'success')
        setFileDialog(null)
        setFilePath('')
      } else {
        addToast(data.error || 'Upload failed.', 'error')
      }
    } catch {
      addToast('Upload failed.', 'error')
    }
  }

  async function mountDriveAction() {
    if (!activeSession) {
      addToast('Select an active session first.', 'warning')
      return
    }
    try {
      const data = await colabApi({ action: 'drivemount', sessionName: activeSession.name })
      if (data.success) {
        addToast('Google Drive mounted at /content/drive', 'success')
      } else {
        addToast(data.error || 'Drive mount requires interactive auth in Colab.', 'warning')
      }
    } catch {
      addToast('Drive mount failed.', 'error')
    }
  }

  // ── Template loading ───────────────────────────────────────────────
  function loadTemplate(t) {
    setCode(t.code)
    setPackages(t.packages || '')
    if (t.gpu) setAccelerator(t.gpu)
    setTemplatePickerOpen(false)
    addToast(`Loaded "${t.name}" template`, 'info')
  }

  // ── Derived state ──────────────────────────────────────────────────
  const isConnected = !!accessToken
  const currentAccel = ACCELERATORS.find(a => a.id === accelerator) || ACCELERATORS[1]
  const activeSessionName = activeSession?.name

  // ── Style constants ────────────────────────────────────────────────
  const btn = "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:pointer-events-none"
  const btnPrimary = `${btn} bg-green-600 hover:bg-green-700 text-white`
  const btnSecondary = `${btn} bg-[#1a1a1a] hover:bg-[#222] text-white border border-[#262626]`
  const btnBlue = `${btn} bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/30`
  const inp = "w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#404040] focus:outline-none focus:border-[#3a3a3a] transition-colors font-mono"

  // ══════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════
  return (
    <main className="h-dvh flex bg-[#0a0a0a] overflow-hidden">
      {/* ── Left Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 border-r border-[#141414] bg-[#0d0d0d] flex flex-col overflow-hidden shrink-0`}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-[#141414]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white tracking-tight">Sessions</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-md hover:bg-[#1a1a1a] text-[#666] hover:text-white transition-colors"
            >
              <IconClose size={14} />
            </button>
          </div>
          <button
            onClick={createSession}
            disabled={!isConnected || sessionLoading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-all disabled:opacity-40"
          >
            {sessionLoading ? <IconSpinner size={14} /> : <IconPlus size={14} />}
            New Session
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {sessions.length === 0 ? (
            <div className="p-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#141414] flex items-center justify-center mx-auto mb-3">
                <IconGpu size={18} className="text-[#404040]" />
              </div>
              <p className="text-xs text-[#555]">No active sessions</p>
              <p className="text-xs text-[#404040] mt-1">Create one to start coding</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {sessions.map(s => {
                const accColor = getAcceleratorColor(s.accelerator)
                const isActive = activeSessionName === s.name
                return (
                  <div
                    key={s.name || s.id}
                    onClick={() => setActiveSession(s)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      isActive
                        ? 'bg-[#1a1a1a] border border-[#262626]'
                        : 'hover:bg-[#141414] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white truncate">
                        {s.name || s.id?.slice(0, 12)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: s.status === 'active' ? '#22c55e' : '#666' }}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); stopSessionAction(s.name) }}
                          className="p-1 rounded hover:bg-red-600/20 text-[#555] hover:text-red-400 transition-colors"
                          title="Stop session"
                        >
                          <IconStop size={10} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                        style={{
                          background: `${accColor}15`,
                          color: accColor,
                        }}
                      >
                        {isTpu(s.accelerator) ? <IconTpu size={8} /> : <IconGpu size={8} />}
                        {s.accelerator?.toUpperCase() || 'CPU'}
                      </span>
                      <span className="text-[10px] text-[#555]">
                        <IconClock size={8} className="inline mr-0.5" />
                        {formatUptime(s.assignedAt)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar footer — auth status */}
        <div className="p-4 border-t border-[#141414]">
          {isConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-[#888]">Connected</span>
              </div>
              <button
                onClick={disconnect}
                className="text-xs text-[#555] hover:text-red-400 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={startAuth}
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-all disabled:opacity-40"
            >
              {authLoading ? <IconSpinner size={14} /> : <IconConnect size={14} />}
              Connect Google Account
            </button>
          )}
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Top Bar ────────────────────────────────────────────────── */}
        <header className="border-b border-[#141414] px-4 py-2.5 shrink-0 flex items-center gap-3">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-[#666] hover:text-white transition-colors"
          >
            <IconMenu size={16} />
          </button>

          {/* Page title */}
          <div className="flex items-center gap-2.5 mr-4">
            <div className="w-7 h-7 rounded-lg bg-[#141414] flex items-center justify-center">
              <IconGpu size={14} className="text-green-500" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white tracking-tight leading-none">Colab GPU/TPU</h1>
              <p className="text-[10px] text-[#555] leading-none mt-0.5">Run Python on cloud accelerators</p>
            </div>
          </div>

          {/* Accelerator selector */}
          <div className="relative" ref={accelDropdownRef}>
            <button
              onClick={() => setAccelDropdownOpen(!accelDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141414] border border-[#262626] text-sm hover:border-[#3a3a3a] transition-colors"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: currentAccel.color }}
              />
              <span className="text-white font-medium">{currentAccel.label}</span>
              <IconChevronDown size={12} className="text-[#555]" />
            </button>
            {accelDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-[#141414] border border-[#262626] rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-2 max-h-80 overflow-y-auto">
                  {ACCELERATORS.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => { setAccelerator(acc.id); setAccelDropdownOpen(false) }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                        accelerator === acc.id ? 'bg-[#1a1a1a]' : 'hover:bg-[#1a1a1a]'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ background: acc.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{acc.label}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md uppercase ${
                            acc.tier === 'free' ? 'bg-green-600/20 text-green-400' :
                            acc.tier === 'pro' ? 'bg-amber-600/20 text-amber-400' :
                            'bg-purple-600/20 text-purple-400'
                          }`}>
                            {acc.tier}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#555] mt-0.5">{acc.desc}</p>
                      </div>
                      {accelerator === acc.id && <IconCheck size={14} className="text-green-500" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active session indicator */}
          {activeSession && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141414] border border-[#262626]">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-[#888]">{activeSession.name?.slice(0, 16)}</span>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                style={{
                  background: `${getAcceleratorColor(activeSession.accelerator)}15`,
                  color: getAcceleratorColor(activeSession.accelerator),
                }}
              >
                {activeSession.accelerator?.toUpperCase() || 'CPU'}
              </span>
            </div>
          )}

          {/* Auth status (right side) */}
          <div className="ml-auto flex items-center gap-2">
            {!isConnected && (
              <button
                onClick={startAuth}
                disabled={authLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium border border-blue-600/30 transition-all disabled:opacity-40"
              >
                {authLoading ? <IconSpinner size={12} /> : <IconConnect size={12} />}
                Connect
              </button>
            )}
            {!authConfigured && (
              <span className="text-xs text-amber-500 flex items-center gap-1">
                <IconWarning size={12} />
                OAuth not configured
              </span>
            )}
          </div>
        </header>

        {/* ── Main workspace ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* ── Not connected state ───────────────────────────────────── */}
          {!isConnected && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md px-4">
                <div className="w-20 h-20 rounded-2xl bg-[#111] flex items-center justify-center mx-auto mb-6">
                  <IconGpu size={32} className="text-green-500" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Colab GPU/TPU Workspace</h2>
                <p className="text-sm text-[#666] mb-6 leading-relaxed">
                  Run Python code on Google Colab&apos;s cloud GPUs and TPUs directly from Kivora.
                  Fine-tune models, train neural networks, or process data at scale.
                </p>
                <button
                  onClick={startAuth}
                  disabled={authLoading}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all disabled:opacity-40"
                >
                  {authLoading ? <IconSpinner size={18} /> : <IconConnect size={18} />}
                  Connect Google Account
                </button>
                <p className="text-xs text-[#404040] mt-4">
                  Requires a Google account with Colab access. Free-tier T4 GPUs available.
                </p>
              </div>
            </div>
          )}

          {/* ── Connected workspace ───────────────────────────────────── */}
          {isConnected && (
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {/* ── Code editor panel ──────────────────────────────────── */}
              <div className="flex-1 flex flex-col min-w-0 border-r border-[#141414]">
                {/* Editor toolbar */}
                <div className="px-4 py-2 border-b border-[#141414] flex items-center gap-2 flex-wrap shrink-0">
                  {/* Template picker */}
                  <div className="relative" ref={templatePickerRef}>
                    <button
                      onClick={() => setTemplatePickerOpen(!templatePickerOpen)}
                      className={btnSecondary}
                    >
                      <IconBulb size={13} />
                      <span className="hidden sm:inline">Templates</span>
                      <IconChevronDown size={10} />
                    </button>
                    {templatePickerOpen && (
                      <div className="absolute top-full left-0 mt-2 w-80 bg-[#141414] border border-[#262626] rounded-xl shadow-2xl z-50 overflow-hidden">
                        <div className="p-3 border-b border-[#1a1a1a]">
                          <p className="text-xs font-semibold text-[#888]">Code Templates</p>
                        </div>
                        <div className="p-2 max-h-80 overflow-y-auto">
                          {TEMPLATES.map((t, i) => (
                            <button
                              key={i}
                              onClick={() => loadTemplate(t)}
                              className="w-full text-left p-3 rounded-lg hover:bg-[#1a1a1a] transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-white">{t.name}</span>
                                {t.gpu && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-green-600/20 text-green-400">
                                    {t.gpu}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#555] mt-0.5">{t.description}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Run buttons */}
                  <button
                    onClick={executeCode}
                    disabled={execLoading || !activeSession}
                    className={btnPrimary}
                    title={activeSession ? 'Run on active session' : 'Create a session first'}
                  >
                    {execLoading ? <IconSpinner size={13} /> : <IconPlay size={13} />}
                    <span className="hidden sm:inline">Run</span>
                  </button>

                  <button
                    onClick={quickRun}
                    disabled={execLoading}
                    className={btnBlue}
                    title="One-shot: create session, run code, stop session"
                  >
                    {execLoading ? <IconSpinner size={13} /> : <IconQuickRun size={13} />}
                    <span className="hidden sm:inline">Quick Run</span>
                  </button>

                  {/* File management buttons */}
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      onClick={listFilesAction}
                      disabled={!activeSession}
                      className={`${btnSecondary} !px-2.5`}
                      title="List files"
                    >
                      <IconFolder size={13} />
                    </button>
                    <button
                      onClick={() => setFileDialog({ type: 'download', sessionName: activeSession?.name })}
                      disabled={!activeSession}
                      className={`${btnSecondary} !px-2.5`}
                      title="Download file"
                    >
                      <IconDownload size={13} />
                    </button>
                    <button
                      onClick={() => setFileDialog({ type: 'upload', sessionName: activeSession?.name })}
                      disabled={!activeSession}
                      className={`${btnSecondary} !px-2.5`}
                      title="Upload file"
                    >
                      <IconUpload size={13} />
                    </button>
                    <button
                      onClick={mountDriveAction}
                      disabled={!activeSession}
                      className={`${btnSecondary} !px-2.5`}
                      title="Mount Google Drive"
                    >
                      <IconDrive size={13} />
                    </button>
                  </div>
                </div>

                {/* Packages input */}
                <div className="px-4 py-2 border-b border-[#141414] flex items-center gap-2 shrink-0">
                  <IconPackage size={13} className="text-[#555] shrink-0" />
                  <input
                    type="text"
                    value={packages}
                    onChange={e => setPackages(e.target.value)}
                    placeholder="pip packages (comma-separated, e.g. torch,transformers)"
                    className="flex-1 bg-transparent text-xs text-white placeholder-[#333] focus:outline-none font-mono"
                  />
                </div>

                {/* Code editor */}
                <div className="flex-1 relative min-h-0 overflow-auto">
                  {/* Line numbers + textarea */}
                  <div className="flex min-h-full">
                    <div className="py-4 pr-2 pl-3 text-right select-none shrink-0 bg-[#0a0a0a]">
                      {code.split('\n').map((_, i) => (
                        <div key={i} className="text-[11px] leading-[1.6] text-[#2a2a2a] font-mono">
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      placeholder="# Write your Python code here...\n# Or load a template from the toolbar above\n\nprint('Hello from Kivora Colab!')"
                      className="flex-1 py-4 pr-4 bg-transparent text-[13px] leading-[1.6] text-white placeholder-[#2a2a2a] focus:outline-none resize-none font-mono min-h-[200px]"
                      spellCheck={false}
                      onKeyDown={e => {
                        // Ctrl/Cmd + Enter to run
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                          e.preventDefault()
                          if (activeSession) executeCode()
                          else quickRun()
                        }
                        // Tab for indentation
                        if (e.key === 'Tab') {
                          e.preventDefault()
                          const start = e.target.selectionStart
                          const end = e.target.selectionEnd
                          setCode(code.substring(0, start) + '    ' + code.substring(end))
                          // Set cursor after tab
                          setTimeout(() => {
                            e.target.selectionStart = e.target.selectionEnd = start + 4
                          }, 0)
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Keyboard shortcuts hint */}
                <div className="px-4 py-1.5 border-t border-[#141414] flex items-center gap-4 shrink-0">
                  <span className="text-[10px] text-[#333]">
                    <kbd className="px-1 py-0.5 rounded bg-[#1a1a1a] border border-[#262626] text-[9px] font-mono">Ctrl+Enter</kbd>
                    {' '}to run
                  </span>
                  <span className="text-[10px] text-[#333]">
                    <kbd className="px-1 py-0.5 rounded bg-[#1a1a1a] border border-[#262626] text-[9px] font-mono">Tab</kbd>
                    {' '}to indent
                  </span>
                </div>
              </div>

              {/* ── Output panel ───────────────────────────────────────── */}
              <div className="w-[45%] min-w-[300px] flex flex-col bg-[#0d0d0d]">
                {/* Output tabs */}
                <div className="px-4 py-2 border-b border-[#141414] flex items-center gap-4 shrink-0">
                  <button
                    onClick={() => setOutputTab('output')}
                    className={`text-xs font-medium pb-0.5 transition-colors ${
                      outputTab === 'output'
                        ? 'text-white border-b-2 border-green-500'
                        : 'text-[#555] hover:text-[#888]'
                    }`}
                  >
                    Output
                  </button>
                  <button
                    onClick={() => setOutputTab('files')}
                    className={`text-xs font-medium pb-0.5 transition-colors ${
                      outputTab === 'files'
                        ? 'text-white border-b-2 border-blue-500'
                        : 'text-[#555] hover:text-[#888]'
                    }`}
                  >
                    Files {files.length > 0 && <span className="text-blue-400">({files.length})</span>}
                  </button>
                </div>

                {/* Output content */}
                <div className="flex-1 overflow-auto min-h-0">
                  {outputTab === 'output' && (
                    <div className="p-4">
                      {/* Loading state */}
                      {execLoading && (
                        <div className="flex items-center gap-3 mb-4 px-3 py-2 rounded-lg bg-green-600/10 border border-green-600/20">
                          <IconSpinner size={14} className="text-green-500" />
                          <span className="text-xs text-green-400">Executing code...</span>
                        </div>
                      )}

                      {/* No output yet */}
                      {!output && !execLoading && (
                        <div className="text-center py-16">
                          <div className="w-12 h-12 rounded-xl bg-[#141414] flex items-center justify-center mx-auto mb-3">
                            <IconCode size={20} className="text-[#333]" />
                          </div>
                          <p className="text-sm text-[#444]">Output will appear here</p>
                          <p className="text-xs text-[#333] mt-1">Run code to see results</p>
                        </div>
                      )}

                      {/* Output display */}
                      {output && (
                        <div className="space-y-3">
                          {/* Status bar */}
                          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#111] border border-[#1a1a1a]">
                            {output.success ? (
                              <span className="flex items-center gap-1.5 text-xs text-green-400">
                                <IconCheck size={12} /> Success
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs text-red-400">
                                <IconClose size={12} /> Error
                              </span>
                            )}
                            {output.accelerator && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md ml-auto"
                                style={{
                                  background: `${getAcceleratorColor(output.accelerator)}15`,
                                  color: getAcceleratorColor(output.accelerator),
                                }}
                              >
                                {output.accelerator.toUpperCase()}
                              </span>
                            )}
                          </div>

                          {/* Stdout */}
                          {output.stdout && (
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">Output</span>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(output.stdout); addToast('Output copied!', 'success') }}
                                  className="p-1 rounded hover:bg-[#1a1a1a] text-[#444] hover:text-white transition-colors"
                                >
                                  <IconCopy size={10} />
                                </button>
                              </div>
                              <pre className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3 text-xs text-green-300 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                                {output.stdout}
                              </pre>
                            </div>
                          )}

                          {/* Stderr */}
                          {output.stderr && (
                            <div>
                              <span className="text-[10px] font-semibold text-red-500/70 uppercase tracking-wider mb-1.5 block">Errors</span>
                              <pre className="bg-red-600/5 border border-red-600/15 rounded-lg p-3 text-xs text-red-300 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                                {output.stderr}
                              </pre>
                            </div>
                          )}

                          {/* Files produced */}
                          {output.files && output.files.length > 0 && (
                            <div>
                              <span className="text-[10px] font-semibold text-blue-400/70 uppercase tracking-wider mb-1.5 block">Files Produced</span>
                              <div className="space-y-1">
                                {output.files.map((f, i) => (
                                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/5 border border-blue-600/15">
                                    <IconFile size={12} className="text-blue-400" />
                                    <span className="text-xs text-blue-300 font-mono">{f}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {outputTab === 'files' && (
                    <div className="p-4">
                      {files.length === 0 ? (
                        <div className="text-center py-12">
                          <IconFolder size={24} className="text-[#333] mx-auto mb-3" />
                          <p className="text-sm text-[#444]">No files listed yet</p>
                          <p className="text-xs text-[#333] mt-1">Click the folder icon to list /content</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {files.map((f, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#141414] transition-colors group"
                            >
                              {f.is_dir ? (
                                <IconFolder size={14} className="text-amber-400 shrink-0" />
                              ) : (
                                <IconFile size={14} className="text-[#666] shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white font-mono truncate">{f.name}</p>
                                {f.size > 0 && (
                                  <p className="text-[10px] text-[#555]">
                                    {(f.size / 1024).toFixed(1)} KB
                                  </p>
                                )}
                              </div>
                              {!f.is_dir && (
                                <button
                                  onClick={() => downloadFileAction(f.path)}
                                  className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-[#444] hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Download"
                                >
                                  <IconDownload size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── File dialog overlay ──────────────────────────────────────── */}
      {fileDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setFileDialog(null)}>
          <div
            className="w-full max-w-md bg-[#141414] border border-[#262626] rounded-2xl p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">
                {fileDialog.type === 'upload' ? 'Upload File' : 'Download File'}
              </h3>
              <button onClick={() => setFileDialog(null)} className="p-1 rounded-lg hover:bg-[#1a1a1a] text-[#555] hover:text-white transition-colors">
                <IconClose size={14} />
              </button>
            </div>

            <label className="text-xs text-[#888] block mb-1.5">
              {fileDialog.type === 'upload' ? 'Remote path (e.g. /content/data.csv)' : 'File path to download (e.g. /content/model.pt)'}
            </label>
            <input
              type="text"
              value={filePath}
              onChange={e => setFilePath(e.target.value)}
              placeholder="/content/"
              className={inp}
            />

            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setFileDialog(null)} className={btnSecondary}>Cancel</button>
              <button
                onClick={fileDialog.type === 'upload' ? uploadFileAction : () => { downloadFileAction(filePath); setFileDialog(null) }}
                disabled={!filePath.trim()}
                className={fileDialog.type === 'upload' ? btnPrimary : btnBlue}
              >
                {fileDialog.type === 'upload' ? 'Upload' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast notifications ──────────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl animate-fade-up ${
              toast.type === 'success' ? 'bg-green-600/90 text-white' :
              toast.type === 'error' ? 'bg-red-600/90 text-white' :
              toast.type === 'warning' ? 'bg-amber-600/90 text-white' :
              'bg-[#1a1a1a] text-white border border-[#262626]'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  )
}
