'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { IconBuild, IconCode, IconBulb, IconPlay, IconCheck, IconArrowLeft, IconEye, IconFolder, IconStar, IconSend, IconCopy } from '@/components/Icons'

// ── Mode tabs ──
const MODES = [
  { id: 'code', label: 'Code', icon: IconCode, description: 'Write Three.js code directly' },
  { id: 'ai', label: 'AI Assist', icon: IconBulb, description: 'Describe what you want, AI builds it' },
  { id: 'template', label: 'Template', icon: IconFolder, description: 'Start from a pre-built template' },
]

// ── Project data (shared structure) ──
const PROJECTS = {
  'lunar-base': { name: 'Lunar Base Alpha', scene: 'moon', accent: '#94a3b8' },
  'earth-observatory': { name: 'Earth Observatory', scene: 'earth', accent: '#3b82f6' },
  'solar-cruiser': { name: 'Solar Cruiser', scene: 'solar', accent: '#f59e0b' },
  'nebula-lab': { name: 'Nebula Lab', scene: 'deepspace', accent: '#a855f7' },
  'global-network': { name: 'Global Network Hub', scene: 'globe', accent: '#10b981' },
  'ocean-rig': { name: 'Deep Ocean Rig', scene: 'ocean', accent: '#0ea5e9' },
  'mountain-outpost': { name: 'Mountain Outpost', scene: 'terrain', accent: '#22c55e' },
  'smart-home': { name: 'Smart Home', scene: 'house', accent: '#ef4444' },
  'art-museum': { name: 'Art Museum', scene: 'museum', accent: '#a8a29e' },
  'cube-solver': { name: 'Cube Solver Bot', scene: 'cube', accent: '#f43f5e' },
}

// ── Part data ──
const PARTS = {
  'habitat': { name: 'Habitat Module', description: 'Pressurized living quarters with life support systems' },
  'solar-arrays': { name: 'Solar Arrays', description: 'Photovoltaic panels for power generation' },
  'rover-bay': { name: 'Rover Docking Bay', description: 'Garage and charging station for lunar rovers' },
  'comm-tower': { name: 'Communications Tower', description: 'High-gain antenna array for Earth communication' },
  'airlock': { name: 'Airlock Chamber', description: 'Dual-chamber airlock for EVA operations' },
  'telescope': { name: 'Main Telescope', description: 'High-resolution optical telescope' },
  'comms-array': { name: 'Communications Array', description: 'Satellite relay system' },
  'research-lab': { name: 'Research Laboratory', description: 'Zero-gravity research facility' },
  'solar-panels': { name: 'Solar Panel Wings', description: 'Deployable solar arrays for power' },
  'docking-port': { name: 'Docking Port', description: 'Universal docking mechanism' },
  'crew-quarters': { name: 'Crew Quarters', description: 'Living space for crew members' },
  'ion-drive': { name: 'Ion Drive Engine', description: 'High-efficiency ion propulsion system' },
  'crew-module': { name: 'Crew Module', description: 'Rotating habitat ring' },
  'nav-computer': { name: 'Navigation Computer', description: 'AI-powered navigation system' },
  'shield-gen': { name: 'Shield Generator', description: 'Electromagnetic radiation shielding' },
  'cargo-bay': { name: 'Cargo Bay', description: 'Modular cargo storage system' },
  'science-deck': { name: 'Science Deck', description: 'Onboard laboratory and analysis suite' },
  'bridge': { name: 'Command Bridge', description: 'Central command and control center' },
  'life-support': { name: 'Life Support System', description: 'Atmospheric processing and recycling' },
  'sensor-array': { name: 'Sensor Array', description: 'Multi-spectrum sensor suite' },
  'dark-matter': { name: 'Dark Matter Detector', description: 'Experimental detection chamber' },
  'plasma-shield': { name: 'Plasma Shield', description: 'Protective barrier against radiation' },
  'quantum-lab': { name: 'Quantum Lab', description: 'Quantum computing research facility' },
  'warp-beacon': { name: 'Warp Beacon', description: 'Faster-than-light communication relay' },
  'hab-dome': { name: 'Habitat Dome', description: 'Self-sustaining biosphere' },
  'mining-drone': { name: 'Mining Drone Bay', description: 'Automated resource extraction drones' },
  'fiber-core': { name: 'Fiber Core', description: 'Transcontinental fiber optic backbone' },
  'sat-link': { name: 'Satellite Link', description: 'Low-orbit satellite uplink system' },
  'server-farm': { name: 'Server Cluster', description: 'Distributed computing cluster' },
  'noc': { name: 'Network Operations Center', description: '24/7 monitoring hub' },
  'cdn-node': { name: 'CDN Edge Node', description: 'Content delivery edge server' },
  'security-hub': { name: 'Security Hub', description: 'AI-powered threat detection' },
  'pressure-hull': { name: 'Pressure Hull', description: 'Reinforced titanium hull' },
  'sonar-array': { name: 'Sonar Array', description: 'Multi-beam sonar mapping system' },
  'sub-bay': { name: 'Submersible Bay', description: 'Deployable submarine facility' },
  'bio-lab': { name: 'Marine Biology Lab', description: 'Pressurized specimen lab' },
  'quarters': { name: 'Living Quarters', description: 'Underwater habitat for researchers' },
  'weather-station': { name: 'Weather Station', description: 'Meteorological sensors and forecasting' },
  'wind-turbines': { name: 'Wind Turbines', description: 'High-altitude wind energy generators' },
  'observatory': { name: 'Observatory Dome', description: 'Telescope housing with adaptive optics' },
  'comms-relay': { name: 'Communications Relay', description: 'Mountain-top radio relay station' },
  'living-room': { name: 'Living Room', description: 'Smart lighting, climate, and entertainment' },
  'kitchen': { name: 'Smart Kitchen', description: 'Automated appliances and inventory tracking' },
  'bedroom': { name: 'Master Bedroom', description: 'Sleep optimization and ambient controls' },
  'security': { name: 'Security System', description: 'AI-powered surveillance and access control' },
  'garage': { name: 'Smart Garage', description: 'EV charging and vehicle management' },
  'main-hall': { name: 'Grand Hall', description: 'Columned entrance hall with marble floors' },
  'gallery-wing-a': { name: 'Gallery Wing A', description: 'Natural lit gallery for paintings' },
  'sculpture-hall': { name: 'Sculpture Hall', description: 'Climate-controlled hall for 3D artworks' },
  'interactive-wing': { name: 'Interactive Wing', description: 'Digital and immersive art experiences' },
  'conservation-lab': { name: 'Conservation Lab', description: 'Restoration and preservation facility' },
  'cafe': { name: 'Museum Cafe', description: 'Visitor amenities and gift shop' },
  'vision-system': { name: 'Vision System', description: 'Camera-based cube state detection' },
  'solver-algo': { name: 'Solver Algorithm', description: 'Kociemba two-phase solving algorithm' },
  'robot-arm': { name: 'Robotic Arm', description: '6-axis manipulator for physical cube rotation' },
  'ui-dashboard': { name: 'UI Dashboard', description: 'Real-time visualization and control panel' },
}

// ── Templates per mode ──
const TEMPLATES = {
  code: {
    default: `// Three.js Module — write your 3D code here
// Available: THREE, scene, camera, renderer

// Example: Create a simple mesh
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({
  color: 0x4488ff,
  roughness: 0.4,
  metalness: 0.6,
});
const mesh = new THREE.Mesh(geometry, material);
mesh.position.y = 0.5;
scene.add(mesh);

// Add a light
const light = new THREE.PointLight(0xffffff, 1, 20);
light.position.set(2, 3, 2);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040, 0.5));`,
  },
  ai: {
    prompts: [
      'Create a habitat module with rounded walls and airlock doors',
      'Build a solar panel array that tracks the sun',
      'Design a communications tower with blinking antenna lights',
      'Construct a rover docking bay with vehicle charge stations',
      'Make a pressurized airlock with rotating inner door',
    ],
  },
  template: {
    options: [
      { id: 'basic-mesh', name: 'Basic Mesh', desc: 'Simple geometry with standard material' },
      { id: 'glowing-object', name: 'Glowing Object', desc: 'Mesh with point light and emissive material' },
      { id: 'animated-rotation', name: 'Animated Rotation', desc: 'Auto-rotating object with orbit controls' },
      { id: 'particle-system', name: 'Particle System', desc: 'Floating particles with custom colors' },
      { id: 'wireframe-structure', name: 'Wireframe Structure', desc: 'Wireframe architectural element' },
    ],
  },
}

export default function BuildPartClient() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId
  const partId = params.partId

  const project = PROJECTS[projectId]
  const part = PARTS[partId]

  const [mode, setMode] = useState('code')
  const [code, setCode] = useState(TEMPLATES.code.default)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)

  const previewRef = useRef(null)
  const cleanupRef = useRef(null)

  // 404 if project or part not found
  if (!project || !part) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <IconBuild size={40} className="mx-auto mb-4 text-[#333]" />
          <h1 className="text-xl font-semibold mb-2">Part Not Found</h1>
          <p className="text-sm text-[#737373] mb-4">This build part doesn&apos;t exist.</p>
          <Link
            href={`/build/${projectId || ''}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#111] border border-[#1a1a1a] text-[#a3a3a3] hover:bg-[#1a1a1a] hover:text-white transition-colors"
          >
            <IconArrowLeft size={14} />
            Back to Project
          </Link>
        </div>
      </main>
    )
  }

  // Handle AI assist
  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiResponse('')

    // Simulate AI response (no real API call yet)
    await new Promise(resolve => setTimeout(resolve, 1500))

    const generatedCode = `// AI Generated: ${aiPrompt}
const group = new THREE.Group();

// Main structure
const mainGeo = new THREE.CylinderGeometry(0.8, 1.0, 1.5, 32);
const mainMat = new THREE.MeshStandardMaterial({
  color: 0x${project.accent.replace('#', '')},
  roughness: 0.5,
  metalness: 0.3,
});
const mainMesh = new THREE.Mesh(mainGeo, mainMat);
group.add(mainMesh);

// Detail elements
const detailGeo = new THREE.SphereGeometry(0.3, 16, 16);
const detailMat = new THREE.MeshStandardMaterial({
  color: 0xcccccc,
  emissive: 0x222244,
  roughness: 0.2,
  metalness: 0.8,
});
const detail = new THREE.Mesh(detailGeo, detailMat);
detail.position.y = 1.0;
group.add(detail);

// Lights
const light = new THREE.PointLight(0xffffff, 0.8, 15);
light.position.set(2, 3, 2);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040, 0.4));

scene.add(group);`

    setAiResponse(generatedCode)
    setCode(generatedCode)
    setAiLoading(false)
  }

  // Handle template selection
  function handleTemplateSelect(templateId) {
    setSelectedTemplate(templateId)
    const templateCodes = {
      'basic-mesh': `// Basic Mesh Template
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({
  color: 0x${project.accent.replace('#', '')},
  roughness: 0.5,
  metalness: 0.3,
});
const mesh = new THREE.Mesh(geometry, material);
mesh.position.y = 0.5;
scene.add(mesh);
scene.add(new THREE.AmbientLight(0x404040, 0.5));
const light = new THREE.PointLight(0xffffff, 1, 20);
light.position.set(2, 3, 2);
scene.add(light);`,
      'glowing-object': `// Glowing Object Template
const geo = new THREE.SphereGeometry(0.6, 32, 32);
const mat = new THREE.MeshStandardMaterial({
  color: 0x${project.accent.replace('#', '')},
  emissive: 0x${project.accent.replace('#', '')},
  emissiveIntensity: 0.3,
  roughness: 0.2,
  metalness: 0.8,
});
const mesh = new THREE.Mesh(geo, mat);
mesh.position.y = 1;
scene.add(mesh);
const glow = new THREE.PointLight(0x${project.accent.replace('#', '')}, 1.5, 10);
glow.position.copy(mesh.position);
scene.add(glow);
scene.add(new THREE.AmbientLight(0x202020, 0.3));`,
      'animated-rotation': `// Animated Rotation Template
const geo = new THREE.TorusKnotGeometry(0.5, 0.15, 100, 16);
const mat = new THREE.MeshStandardMaterial({
  color: 0x${project.accent.replace('#', '')},
  roughness: 0.3,
  metalness: 0.7,
});
const mesh = new THREE.Mesh(geo, mat);
mesh.position.y = 1;
scene.add(mesh);
scene.add(new THREE.AmbientLight(0x404040, 0.4));
const light = new THREE.PointLight(0xffffff, 1, 20);
light.position.set(3, 4, 3);
scene.add(light);
// Animate (handled by render loop)
mesh.userData.animate = (t) => {
  mesh.rotation.x = t * 0.5;
  mesh.rotation.y = t * 0.7;
};`,
      'particle-system': `// Particle System Template
const count = 500;
const positions = new Float32Array(count * 3);
const colors = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
  positions[i*3] = (Math.random()-0.5)*6;
  positions[i*3+1] = Math.random()*4;
  positions[i*3+2] = (Math.random()-0.5)*6;
  colors[i*3] = ${parseFloat(parseInt(project.accent.replace('#','').substr(0,2),16)/255).toFixed(2)};
  colors[i*3+1] = ${parseFloat(parseInt(project.accent.replace('#','').substr(2,2),16)/255).toFixed(2)};
  colors[i*3+2] = ${parseFloat(parseInt(project.accent.replace('#','').substr(4,2),16)/255).toFixed(2)};
}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const mat = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.8 });
const particles = new THREE.Points(geo, mat);
scene.add(particles);
scene.add(new THREE.AmbientLight(0x404040, 0.3));`,
      'wireframe-structure': `// Wireframe Structure Template
const geo = new THREE.IcosahedronGeometry(1, 1);
const mat = new THREE.MeshBasicMaterial({
  color: 0x${project.accent.replace('#', '')},
  wireframe: true,
  transparent: true,
  opacity: 0.6,
});
const mesh = new THREE.Mesh(geo, mat);
mesh.position.y = 1;
scene.add(mesh);
// Solid inner
const innerMat = new THREE.MeshStandardMaterial({
  color: 0x${project.accent.replace('#', '')},
  transparent: true,
  opacity: 0.15,
  roughness: 0.8,
});
const inner = new THREE.Mesh(geo.clone(), innerMat);
inner.position.copy(mesh.position);
inner.scale.setScalar(0.98);
scene.add(inner);
scene.add(new THREE.AmbientLight(0x404040, 0.5));
const light = new THREE.PointLight(0xffffff, 1, 20);
light.position.set(2, 3, 2);
scene.add(light);`,
    }

    if (templateCodes[templateId]) {
      setCode(templateCodes[templateId])
    }
  }

  // Copy code
  function handleCopy() {
    navigator.clipboard?.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Submit part
  function handleSubmit() {
    setSubmitted(true)
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ── Header ── */}
      <div className="border-b border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href={`/build/${projectId}`}
                className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#737373] hover:text-white transition-colors shrink-0"
              >
                <IconArrowLeft size={14} />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight truncate">{part.name}</h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold shrink-0" style={{ backgroundColor: `${project.accent}15`, color: project.accent }}>
                    {project.name}
                  </span>
                </div>
                <p className="text-xs text-[#737373] truncate">{part.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`/3d?scene=${project.scene}`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <IconEye size={10} />
                Scene
              </a>
              {!submitted ? (
                <button
                  onClick={handleSubmit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors"
                >
                  <IconCheck size={10} />
                  Submit Part
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/25">
                  <IconCheck size={10} />
                  Submitted
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mode Tabs ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2">
        <div className="flex gap-1 bg-[#111111] rounded-lg p-0.5 border border-[#1a1a1a]">
            {MODES.map(m => {
              const Icon = m.icon
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors duration-200 ${
                    mode === m.id
                      ? 'bg-[#dc2626] text-white rounded-md'
                      : 'text-[#737373] hover:text-white hover:bg-[#1a1a1a] rounded-md'
                  }`}
                >
                  <Icon size={12} />
                  {m.label}
                </button>
              )
            })}
          </div>
      </div>

      {/* ── Main Content: Editor + Preview ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {/* Mode description */}
        <p className="text-[11px] text-[#525252] mb-4">
          {mode === 'code' && 'Write Three.js code directly. The scene, camera, and renderer are pre-configured.'}
          {mode === 'ai' && 'Describe what you want to build and AI will generate the Three.js code for you.'}
          {mode === 'template' && 'Pick a pre-built template to get started quickly, then customize the code.'}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Editor / AI / Template picker */}
          <div className="rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] overflow-hidden">
            {/* Editor header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
              <span className="text-[11px] text-[#525252] font-medium">
                {mode === 'code' && 'three-module.js'}
                {mode === 'ai' && 'AI Prompt'}
                {mode === 'template' && 'Choose Template'}
              </span>
              {mode !== 'template' && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[#525252] hover:text-[#737373] transition-colors"
                >
                  <IconCopy size={10} />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>

            {/* Editor content */}
            <div className="h-[400px] overflow-auto">
              {mode === 'code' && (
                <textarea
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full h-full bg-transparent text-[13px] text-[#d4d4d4] font-mono p-4 resize-none focus:outline-none leading-relaxed"
                  spellCheck={false}
                  placeholder="// Write your Three.js code here..."
                />
              )}

              {mode === 'ai' && (
                <div className="p-4 h-full flex flex-col">
                  <textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    className="w-full bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-[#2a2a2a] transition-colors mb-3"
                    rows={3}
                    placeholder="Describe what you want to build..."
                    spellCheck={false}
                  />
                  <button
                    onClick={handleAiGenerate}
                    disabled={!aiPrompt.trim() || aiLoading}
                    className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors mb-3 ${
                      aiPrompt.trim() && !aiLoading
                        ? 'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25'
                        : 'bg-[#111] text-[#525252] border border-[#1a1a1a] cursor-not-allowed'
                    }`}
                  >
                    {aiLoading ? (
                      <>
                        <div className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <IconBulb size={12} />
                        Generate Code
                      </>
                    )}
                  </button>

                  {/* Quick prompts */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {TEMPLATES.ai.prompts.slice(0, 3).map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => setAiPrompt(prompt)}
                        className="px-2.5 py-1 rounded-full text-[10px] bg-[#111] text-[#737373] hover:text-white hover:bg-[#1a1a1a] transition-colors"
                      >
                        {prompt.slice(0, 40)}...
                      </button>
                    ))}
                  </div>

                  {/* Generated code preview */}
                  {aiResponse && (
                    <div className="flex-1 overflow-auto rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] p-3">
                      <pre className="text-[11px] text-[#a3a3a3] font-mono leading-relaxed whitespace-pre-wrap">{aiResponse}</pre>
                    </div>
                  )}
                </div>
              )}

              {mode === 'template' && (
                <div className="p-4 space-y-2">
                  {TEMPLATES.template.options.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => handleTemplateSelect(tpl.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors duration-200 ${
                        selectedTemplate === tpl.id
                          ? 'bg-white/5 border-white/10'
                          : 'bg-transparent border-[#1a1a1a] hover:border-[#2a2a2a]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${
                          selectedTemplate === tpl.id ? 'bg-red-500/15 text-red-400' : 'bg-[#1a1a1a] text-[#525252]'
                        }`}>
                          <IconFolder size={12} />
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-white">{tpl.name}</h4>
                          <p className="text-[10px] text-[#525252]">{tpl.desc}</p>
                        </div>
                        {selectedTemplate === tpl.id && (
                          <IconCheck size={12} className="ml-auto text-red-400 shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: 3D Preview */}
          <div className="rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
              <span className="text-[11px] text-[#525252] font-medium">3D Preview</span>
              <div className="flex items-center gap-2">
                <a
                  href={`/3d?scene=${project.scene}`}
                  className="text-[10px] text-[#525252] hover:text-[#737373] transition-colors flex items-center gap-1"
                >
                  <IconEye size={10} />
                  Full Viewer
                </a>
              </div>
            </div>
            <div
              ref={previewRef}
              className="h-[400px] bg-[#050505] flex items-center justify-center"
            >
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-xl mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: `${project.accent}10`, color: `${project.accent}60` }}
                >
                  <IconBuild size={28} />
                </div>
                <p className="text-xs text-[#525252]">3D preview will render here</p>
                <p className="text-[10px] text-[#404040] mt-1">Write code and click Run to preview</p>
                <button
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold mx-auto"
                  style={{ backgroundColor: `${project.accent}15`, color: project.accent, border: `1px solid ${project.accent}30` }}
                >
                  <IconPlay size={10} />
                  Run Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
        /* Custom scrollbar for code editor */
        textarea::-webkit-scrollbar {
          width: 6px;
        }
        textarea::-webkit-scrollbar-track {
          background: transparent;
        }
        textarea::-webkit-scrollbar-thumb {
          background: #1a1a1a;
          border-radius: 3px;
        }
        textarea::-webkit-scrollbar-thumb:hover {
          background: #2a2a2a;
        }
      `}</style>
    </main>
  )
}
