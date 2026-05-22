'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getProject, getProjectParts, DOOR_TEMPLATES } from '@/components/build/demoData'
import { IconArrowLeft, IconCode, IconRobot, IconStack, IconSpinner, IconCheck, IconPlay } from '@/components/Icons'

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') { reject('No window'); return }
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

let threeLoaded = false
async function ensureThreeJS() {
  if (threeLoaded && window.THREE) return
  await loadScript('/3d-lib/three.min.js')
  await loadScript('/3d-lib/OrbitControls.js')
  threeLoaded = true
}

const DEFAULT_CODE = `// Three.js Part Code Template
// Available: scene, THREE (global)

const geometry = new THREE.BoxGeometry(0.8, 1.9, 0.1);
const material = new THREE.MeshStandardMaterial({
  color: 0x8B4513,
  roughness: 0.7,
  metalness: 0.1,
});
const mesh = new THREE.Mesh(geometry, material);
mesh.position.set(0, 0.95, 0);
scene.add(mesh);

// Add a door knob
const knobGeo = new THREE.SphereGeometry(0.03, 16, 16);
const knobMat = new THREE.MeshStandardMaterial({
  color: 0xFFD700,
  metalness: 0.8,
  roughness: 0.2,
});
const knob = new THREE.Mesh(knobGeo, knobMat);
knob.position.set(0.3, 0.95, 0.06);
mesh.add(knob);`

const AI_STEPS = ['Analyzing...', 'Modeling...', 'Texturing...', 'Integration...']

export default function BuildPartClient({ projectId, partId }) {
  const router = useRouter()
  const previewRef = useRef(null)
  const previewCleanupRef = useRef(null)
  const updatePreview = useRef(null)

  const [project, setProject] = useState(null)
  const [part, setPart] = useState(null)
  const [mode, setMode] = useState('code')
  const [code, setCode] = useState(DEFAULT_CODE)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStep, setAiStep] = useState(0)
  const [aiGeneratedCode, setAiGeneratedCode] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('classic')
  const [templateParams, setTemplateParams] = useState({ width: 0.8, height: 1.9, thickness: 0.1, color: '#8B4513', material: 'wood' })
  const [submitted, setSubmitted] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    const p = getProject(projectId)
    setProject(p)
    const parts = getProjectParts(projectId)
    const found = parts.find(pt => pt.id === partId)
    setPart(found)
  }, [projectId, partId])

  useEffect(() => {
    if (!previewRef.current) return
    let disposed = false

    async function initPreview() {
      try { await ensureThreeJS() } catch { return }
      if (disposed || !previewRef.current) return

      const THREE = window.THREE
      const container = previewRef.current
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x0a0a0a)
      const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100)
      camera.position.set(2, 1.5, 2)
      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(container.clientWidth, container.clientHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      container.appendChild(renderer.domElement)
      scene.add(new THREE.GridHelper(4, 4, 0x222222, 0x181818))
      scene.add(new THREE.AmbientLight(0x404040, 0.8))
      const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.5)
      dirLight.position.set(3, 5, 3)
      scene.add(dirLight)

      let controls = null
      if (THREE.OrbitControls) {
        controls = new THREE.OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05
        controls.minDistance = 1
        controls.maxDistance = 10
      }

      const previewGroup = new THREE.Group()
      scene.add(previewGroup)

      updatePreview.current = (codeStr) => {
        while (previewGroup.children.length > 0) {
          const child = previewGroup.children[0]
          previewGroup.remove(child)
          if (child.geometry) child.geometry.dispose()
          if (child.material) { if (Array.isArray(child.material)) child.material.forEach(m => m.dispose()); else child.material.dispose() }
        }
        try { new Function('scene', 'THREE', codeStr)(previewGroup, THREE) } catch (e) { console.warn('Preview code error:', e.message) }
      }

      updatePreview.current(code)

      const clock = new THREE.Clock()
      let animId
      function animate() {
        animId = requestAnimationFrame(animate)
        if (controls) controls.update()
        renderer.render(scene, camera)
      }
      animate()

      const onResize = () => { camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight) }
      window.addEventListener('resize', onResize)

      previewCleanupRef.current = () => {
        disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize)
        if (controls) controls.dispose()
        scene.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose() } })
        renderer.dispose(); renderer.forceContextLoss()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }

    initPreview()
    return () => { if (previewCleanupRef.current) { previewCleanupRef.current(); previewCleanupRef.current = null } }
  }, [])

  useEffect(() => { if (updatePreview.current && mode === 'code') updatePreview.current(code) }, [code, mode])

  const generateTemplateCode = (templateId, params) => {
    const { width, height, thickness, color, material: mat } = params
    const colorNum = parseInt(color.replace('#', ''), 16)
    let roughness = 0.7, metalness = 0.1
    if (mat === 'metal') { roughness = 0.3; metalness = 0.8 }
    if (mat === 'glass') { roughness = 0.1; metalness = 0.1 }
    if (mat === 'concrete') { roughness = 0.95; metalness = 0.0 }
    const transparentStr = mat === 'glass' ? 'transparent: true,\n  opacity: 0.5,' : ''

    let extraCode = ''
    if (templateId === 'classic') {
      extraCode = `
  const panelGeo = new THREE.BoxGeometry(${(width * 0.6).toFixed(2)}, ${(height * 0.35).toFixed(2)}, ${(thickness * 0.5).toFixed(3)});
  const panelMat = new THREE.MeshStandardMaterial({ color: ${colorNum}, roughness: ${roughness + 0.1} });
  const topPanel = new THREE.Mesh(panelGeo, panelMat);
  topPanel.position.set(0, ${(height * 0.22).toFixed(2)}, ${(thickness * 0.5).toFixed(3)});
  mesh.add(topPanel);
  const botPanel = new THREE.Mesh(panelGeo.clone(), panelMat);
  botPanel.position.set(0, ${(-height * 0.18).toFixed(2)}, ${(thickness * 0.5).toFixed(3)});
  mesh.add(botPanel);
  const knobGeo = new THREE.SphereGeometry(0.03, 12, 12);
  const knobMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8, roughness: 0.2 });
  const knob = new THREE.Mesh(knobGeo, knobMat);
  knob.position.set(${(width * 0.38).toFixed(2)}, 0, ${(thickness * 0.6).toFixed(3)});
  mesh.add(knob);`
    } else if (templateId === 'modern') {
      extraCode = `
  const handleGeo = new THREE.BoxGeometry(0.02, ${(height * 0.5).toFixed(2)}, 0.02);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, metalness: 0.9, roughness: 0.1 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(${(width * 0.4).toFixed(2)}, 0, ${(thickness * 0.6).toFixed(3)});
  mesh.add(handle);`
    } else if (templateId === 'glass') {
      extraCode = `
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 });
  const topF = new THREE.Mesh(new THREE.BoxGeometry(${(width + 0.04).toFixed(2)}, 0.04, ${(thickness + 0.02).toFixed(3)}), frameMat);
  topF.position.y = ${(height / 2).toFixed(2)}; mesh.add(topF);
  const botF = topF.clone(); botF.position.y = ${(-height / 2).toFixed(2)}; mesh.add(botF);`
    } else if (templateId === 'sliding') {
      extraCode = `
  const railGeo = new THREE.BoxGeometry(${(width * 1.3).toFixed(2)}, 0.03, 0.05);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.7, roughness: 0.3 });
  const rail = new THREE.Mesh(railGeo, railMat);
  rail.position.set(0, ${(height / 2 + 0.05).toFixed(2)}, 0);
  mesh.add(rail);`
    }

    return `const geometry = new THREE.BoxGeometry(${width.toFixed(2)}, ${height.toFixed(2)}, ${thickness.toFixed(3)});
const material = new THREE.MeshStandardMaterial({
  color: ${colorNum},
  roughness: ${roughness},
  metalness: ${metalness},
  ${transparentStr}
});
const mesh = new THREE.Mesh(geometry, material);
mesh.position.set(0, ${(height / 2).toFixed(2)}, 0);
scene.add(mesh);
${extraCode}`
  }

  useEffect(() => {
    if (mode === 'template' && updatePreview.current) updatePreview.current(generateTemplateCode(selectedTemplate, templateParams))
  }, [mode, selectedTemplate, templateParams])

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiStep(0)
    const stepInterval = setInterval(() => { setAiStep(prev => { if (prev >= AI_STEPS.length - 1) { clearInterval(stepInterval); return prev }; return prev + 1 }) }, 1200)

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You generate Three.js code snippets. Output ONLY valid JavaScript code that creates 3D objects using THREE global. The code receives "scene" (a THREE.Group) and "THREE" as globals. Do not use import statements. Do not use async. Keep it under 30 lines.' },
          { role: 'user', content: `Generate Three.js code for: ${aiPrompt}. The part is for a ${part?.name || '3D object'} in the ${project?.title || 'project'} project.` }
        ],
      })
      clearInterval(stepInterval)
      const generatedCode = completion.choices?.[0]?.message?.content || ''
      // Strip markdown code fences if present
      const cleanCode = generatedCode.replace(/^```(?:javascript|js)?\n?/m, '').replace(/\n?```$/m, '').trim()
      setAiGeneratedCode(cleanCode)
      if (updatePreview.current) updatePreview.current(cleanCode)
    } catch {
      clearInterval(stepInterval)
      // Fallback demo code
      const fallbackCode = `const geometry = new THREE.BoxGeometry(0.8, 1.9, 0.1);
const material = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7, metalness: 0.1 });
const mesh = new THREE.Mesh(geometry, material);
mesh.position.set(0, 0.95, 0);
scene.add(mesh);
const frameMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.6 });
const topFrame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.12), frameMat);
topFrame.position.set(0, 1.92, 0); scene.add(topFrame);
const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.9, 0.12), frameMat);
leftFrame.position.set(-0.42, 0.95, 0); scene.add(leftFrame);
const rightFrame = leftFrame.clone(); rightFrame.position.x = 0.42; scene.add(rightFrame);
const knobGeo = new THREE.SphereGeometry(0.035, 16, 16);
const knobMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.9, roughness: 0.1 });
const knob = new THREE.Mesh(knobGeo, knobMat);
knob.position.set(0.3, 0.95, 0.06); mesh.add(knob);`
      setAiGeneratedCode(fallbackCode)
      if (updatePreview.current) updatePreview.current(fallbackCode)
    }
    setAiLoading(false)
  }

  const handleRunCode = () => { if (updatePreview.current) updatePreview.current(code) }

  const handleSubmitPart = () => {
    setCelebrating(true)
    setTimeout(() => {
      setSubmitted(true)
      setCelebrating(false)
    }, 1500)
  }

  if (!project || !part) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="text-sm text-[#737373]">Part not found</div></div>
  }

  return (
    <div className="h-dvh flex flex-col bg-[#0a0a0a] -m-4 md:-m-6 relative">
      {/* Celebration overlay */}
      {celebrating && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="text-center animate-bounce">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <IconCheck size={32} className="text-green-400" />
            </div>
            <p className="text-xl font-bold text-white">Part Complete!</p>
            <p className="text-sm text-[#737373] mt-1">{part.name} has been added</p>
          </div>
        </div>
      )}

      {/* Submitted success state */}
      {submitted && !celebrating && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]">
          <div className="text-center max-w-sm px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/15 flex items-center justify-center">
              <IconCheck size={28} className="text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Part Submitted</h2>
            <p className="text-sm text-[#737373] mb-6">{part.name} has been completed and added to {project.title}</p>
            <div className="flex gap-3 justify-center">
              <Link href={`/build/${projectId}`} className="px-5 py-2.5 bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] rounded-lg text-sm font-medium text-white hover:bg-[#222] transition-colors">Back to Build Room</Link>
              <Link href="/build" className="px-5 py-2.5 bg-[#dc2626] rounded-lg text-sm font-semibold text-white hover:bg-red-700 transition-colors">All Projects</Link>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[#111111] border-b border-[rgba(255,255,255,0.06)]">
        <Link href={`/build/${projectId}`} className="flex items-center gap-1 text-[#737373] hover:text-white transition-colors text-sm">
          <IconArrowLeft size={14} />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="h-4 w-px bg-[#1a1a1a]" />
        <h1 className="text-sm font-semibold text-white truncate">{part.name}</h1>
        <span className="text-xs text-[#737373]">·</span>
        <span className="text-xs text-[#737373] truncate">{project.title}</span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mode selector */}
          <div className="shrink-0 grid grid-cols-3 gap-2 p-3 bg-[#0d0d0d] border-b border-[rgba(255,255,255,0.06)]">
            {[
              { key: 'code', label: 'Code', icon: IconCode, color: 'text-green-400' },
              { key: 'ai', label: 'AI', icon: IconRobot, color: 'text-purple-400' },
              { key: 'template', label: 'Template', icon: IconStack, color: 'text-teal-400' },
            ].map(m => (
              <button key={m.key} onClick={() => setMode(m.key)} className={`flex flex-col items-center gap-1 py-3 rounded-lg transition-colors ${mode === m.key ? 'bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)]' : 'bg-[#111111] border border-[rgba(255,255,255,0.04)] hover:bg-[#141414]'}`}>
                <m.icon size={16} className={mode === m.key ? m.color : 'text-[#737373]'} />
                <span className={`text-xs font-medium ${mode === m.key ? 'text-white' : 'text-[#737373]'}`}>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Mode interface */}
          <div className="flex-1 overflow-y-auto p-3">
            {mode === 'code' && (
              <div className="h-full flex flex-col gap-3">
                <div className="flex-1 min-h-0">
                  <textarea value={code} onChange={e => setCode(e.target.value)} className="w-full h-full min-h-[300px] bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] rounded-lg p-4 font-mono text-sm text-[#d4d4d4] resize-none focus:outline-none focus:border-[rgba(255,255,255,0.1)]" spellCheck={false} placeholder={DEFAULT_CODE} />
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={handleRunCode} className="flex items-center gap-1.5 px-4 py-2 bg-[#16a34a]/15 text-green-400 border border-green-500/20 rounded-lg text-sm font-medium hover:bg-[#16a34a]/25 transition-colors">
                    <IconPlay size={12} /> Run
                  </button>
                  <button onClick={handleSubmitPart} className="flex items-center gap-1.5 px-4 py-2 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors">Submit Part</button>
                </div>
              </div>
            )}

            {mode === 'ai' && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs text-[#737373] mb-2 font-medium">Describe the part you want to build</label>
                  <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="w-full h-32 bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] rounded-lg p-3 text-sm text-[#d4d4d4] resize-none focus:outline-none focus:border-[rgba(255,255,255,0.1)]" placeholder="A wooden door with two panels, a brass handle, and a decorative frame..." />
                </div>
                <button onClick={handleAIGenerate} disabled={aiLoading || !aiPrompt.trim()} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${aiLoading ? 'bg-purple-500/15 text-purple-300 cursor-wait' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}>
                  {aiLoading ? <><IconSpinner size={14} />{AI_STEPS[aiStep]}</> : <><IconRobot size={14} />Generate with AI</>}
                </button>
                {aiLoading && (
                  <div className="space-y-1.5">
                    {AI_STEPS.map((step, i) => (
                      <div key={step} className="flex items-center gap-2 text-xs">
                        {i < aiStep ? <IconCheck size={12} className="text-green-400" /> : i === aiStep ? <IconSpinner size={12} className="text-purple-400" /> : <span className="w-3 h-3 rounded-full border border-[#404040]" />}
                        <span className={i <= aiStep ? 'text-[#d4d4d4]' : 'text-[#404040]'}>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
                {aiGeneratedCode && !aiLoading && (
                  <div>
                    <label className="block text-xs text-[#737373] mb-2 font-medium">Generated Code</label>
                    <pre className="bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] rounded-lg p-3 text-xs font-mono text-[#d4d4d4] overflow-x-auto max-h-60 overflow-y-auto">{aiGeneratedCode}</pre>
                    <button onClick={handleSubmitPart} className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors">Submit Part</button>
                  </div>
                )}
              </div>
            )}

            {mode === 'template' && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs text-[#737373] mb-2 font-medium">Choose a Template</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DOOR_TEMPLATES.map(tmpl => (
                      <button key={tmpl.id} onClick={() => setSelectedTemplate(tmpl.id)} className={`p-3 rounded-lg text-left transition-colors ${selectedTemplate === tmpl.id ? 'bg-[#1a1a1a] border-2 border-teal-500/40' : 'bg-[#111111] border border-[rgba(255,255,255,0.06)] hover:bg-[#141414]'}`}>
                        <div className="w-8 h-8 rounded mb-2" style={{ backgroundColor: tmpl.color, opacity: 0.7 }} />
                        <p className="text-xs font-medium text-white">{tmpl.name}</p>
                        <p className="text-[10px] text-[#737373] mt-0.5">{tmpl.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-xs text-[#737373] font-medium">Parameters</label>
                  {[['Width', 'width', 0.3, 1.5, 0.05], ['Height', 'height', 0.5, 3.0, 0.1], ['Thickness', 'thickness', 0.02, 0.3, 0.01]].map(([label, key, min, max, step]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[#d4d4d4]">{label}</span>
                        <span className="text-xs text-[#737373] font-mono">{templateParams[key].toFixed(key === 'thickness' ? 3 : 2)}</span>
                      </div>
                      <input type="range" min={min} max={max} step={step} value={templateParams[key]} onChange={e => setTemplateParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))} className="w-full h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer accent-[#dc2626]" />
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#d4d4d4]">Color</span>
                    <input type="color" value={templateParams.color} onChange={e => setTemplateParams(p => ({ ...p, color: e.target.value }))} className="w-8 h-6 rounded border border-[rgba(255,255,255,0.1)] bg-transparent cursor-pointer" />
                    <span className="text-xs text-[#737373] font-mono">{templateParams.color}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#d4d4d4]">Material</span>
                    <select value={templateParams.material} onChange={e => setTemplateParams(p => ({ ...p, material: e.target.value }))} className="bg-[#111111] border border-[rgba(255,255,255,0.06)] rounded-md px-2 py-1 text-xs text-[#d4d4d4] focus:outline-none focus:border-[rgba(255,255,255,0.1)]">
                      <option value="wood">Wood</option><option value="metal">Metal</option><option value="glass">Glass</option><option value="concrete">Concrete</option>
                    </select>
                  </div>
                </div>
                <button onClick={handleSubmitPart} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#dc2626] hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors">Submit Part</button>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Live 3D preview */}
        <div className="w-80 lg:w-96 border-l border-[rgba(255,255,255,0.06)] bg-[#0d0d0d] flex flex-col shrink-0 hidden md:flex">
          <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.06)]">
            <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Live Preview</span>
          </div>
          <div className="flex-1 min-h-0" ref={previewRef} />
        </div>
      </div>
    </div>
  )
}
