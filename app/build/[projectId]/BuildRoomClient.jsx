'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getProject, getProjectParts, PART_POSITIONS, RED_HOUSE_PARTS } from '@/components/build/demoData'
import { IconArrowLeft, IconLock, IconCheck, IconUser, IconChevronDown, IconChevronUp, IconEye } from '@/components/Icons'

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

function StatusDot({ status }) {
  const colors = { completed: 'bg-green-500', incomplete: 'bg-cyan-400', locked: 'bg-gray-500' }
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status] || 'bg-gray-500'}`} />
}

function ColorSwatch({ color }) {
  const hex = typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color
  return <span className="w-3 h-3 rounded-sm shrink-0 border border-white/10" style={{ backgroundColor: hex }} />
}

export default function BuildRoomClient({ projectId }) {
  const router = useRouter()
  const canvasRef = useRef(null)
  const [project, setProject] = useState(null)
  const [parts, setParts] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [focusedPart, setFocusedPart] = useState(null)
  const [celebratingPart, setCelebratingPart] = useState(null)
  const threeCleanupRef = useRef(null)
  const controlsRef = useRef(null)
  const cameraRef = useRef(null)
  const meshMapRef = useRef({})

  useEffect(() => {
    const p = getProject(projectId)
    setProject(p)
    setParts(getProjectParts(projectId))
  }, [projectId])

  useEffect(() => {
    if (!canvasRef.current || !project) return
    let disposed = false

    async function initScene() {
      try { await ensureThreeJS() } catch { return }
      if (disposed) return

      const THREE = window.THREE
      const container = canvasRef.current
      if (!container) return

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x080808)
      scene.fog = new THREE.Fog(0x080808, 15, 30)

      const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100)
      camera.position.set(6, 5, 8)
      cameraRef.current = camera

      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
      renderer.setSize(container.clientWidth, container.clientHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.2
      renderer.outputEncoding = THREE.sRGBEncoding
      container.appendChild(renderer.domElement)

      const gridHelper = new THREE.GridHelper(20, 20, 0x222222, 0x181818)
      scene.add(gridHelper)

      scene.add(new THREE.AmbientLight(0x404040, 0.8))
      const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.8)
      dirLight.position.set(5, 8, 5)
      scene.add(dirLight)
      const fillLight = new THREE.DirectionalLight(0x4488cc, 0.3)
      fillLight.position.set(-5, 3, -5)
      scene.add(fillLight)

      const currentParts = getProjectParts(projectId)
      const meshMap = {}
      meshMapRef.current = meshMap

      currentParts.forEach(part => {
        const pos = projectId === 'red-house'
          ? PART_POSITIONS[part.id]
          : { x: (Math.random() - 0.5) * 6, y: 1, z: (Math.random() - 0.5) * 6, w: 1, h: 1, d: 1 }

        if (!pos) return

        let geometry
        if (pos.isRoof) {
          const shape = new THREE.Shape()
          shape.moveTo(-pos.w / 2, 0)
          shape.lineTo(0, pos.h * 8)
          shape.lineTo(pos.w / 2, 0)
          shape.lineTo(-pos.w / 2, 0)
          geometry = new THREE.ExtrudeGeometry(shape, { depth: pos.d, bevelEnabled: false })
          geometry.center()
        } else {
          geometry = new THREE.BoxGeometry(pos.w, pos.h, pos.d)
        }

        let mesh
        if (part.status === 'completed') {
          const material = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.7, metalness: 0.1 })
          mesh = new THREE.Mesh(geometry, material)

          // Avatar sprite label above completed parts
          if (part.builder) {
            const canvas = document.createElement('canvas')
            canvas.width = 128
            canvas.height = 48
            const ctx = canvas.getContext('2d')
            ctx.fillStyle = '#1a1a1a'
            ctx.roundRect(0, 0, 128, 48, 8)
            ctx.fill()
            ctx.strokeStyle = '#333'
            ctx.lineWidth = 1
            ctx.roundRect(0, 0, 128, 48, 8)
            ctx.stroke()
            ctx.fillStyle = '#d4d4d4'
            ctx.font = 'bold 16px Inter, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(part.builder, 64, 24)
            const texture = new THREE.CanvasTexture(canvas)
            const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.9 })
            const sprite = new THREE.Sprite(spriteMat)
            sprite.scale.set(1.2, 0.45, 1)
            sprite.position.y = (pos.isRoof ? pos.h * 4 : pos.h / 2) + 0.6
            mesh.add(sprite)
          }
        } else if (part.status === 'incomplete') {
          const wireframeMat = new THREE.MeshBasicMaterial({ color: 0x00CED1, wireframe: true, transparent: true, opacity: 0.6 })
          mesh = new THREE.Mesh(geometry, wireframeMat)
          const fillMat = new THREE.MeshStandardMaterial({ color: part.color, transparent: true, opacity: 0.15, roughness: 0.8 })
          const fillMesh = new THREE.Mesh(geometry.clone(), fillMat)
          mesh.add(fillMesh)
          const edgesGeo = new THREE.EdgesGeometry(geometry)
          const edgesMat = new THREE.LineBasicMaterial({ color: 0x00CED1, transparent: true, opacity: 0.8 })
          mesh.add(new THREE.LineSegments(edgesGeo, edgesMat))
        } else {
          const material = new THREE.MeshStandardMaterial({ color: 0x888888, transparent: true, opacity: 0.3, roughness: 0.9 })
          mesh = new THREE.Mesh(geometry, material)
        }

        mesh.position.set(pos.x, pos.y, pos.z)
        mesh.userData = { partId: part.id, partStatus: part.status, partName: part.name }
        scene.add(mesh)
        meshMap[part.id] = mesh
      })

      let controls = null
      if (THREE.OrbitControls) {
        controls = new THREE.OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05
        controls.enablePan = true
        controls.minDistance = 3
        controls.maxDistance = 25
        controls.rotateSpeed = 0.5
        controls.autoRotate = true
        controls.autoRotateSpeed = 0.3
        controlsRef.current = controls
        let autoTimer
        controls.addEventListener('start', () => { controls.autoRotate = false })
        controls.addEventListener('end', () => { clearTimeout(autoTimer); autoTimer = setTimeout(() => { controls.autoRotate = true }, 5000) })
      }

      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      function onCanvasClick(event) {
        const rect = renderer.domElement.getBoundingClientRect()
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        raycaster.setFromCamera(mouse, camera)
        const clickableMeshes = Object.values(meshMap).filter(m => m.userData.partStatus === 'incomplete')
        const intersects = raycaster.intersectObjects(clickableMeshes, false)
        if (intersects.length > 0) {
          const partId = intersects[0].object.userData.partId
          router.push(`/build/${projectId}/${partId}`)
        }
      }
      renderer.domElement.addEventListener('click', onCanvasClick)

      const clock = new THREE.Clock()
      let animId
      function animate() {
        animId = requestAnimationFrame(animate)
        const t = clock.getElapsedTime()
        Object.values(meshMap).forEach(mesh => {
          if (mesh.userData.partStatus === 'incomplete') {
            const scale = 1.0 + Math.sin(t * 2) * 0.015
            mesh.scale.set(scale, scale, scale)
          }
        })
        if (controls) controls.update()
        renderer.render(scene, camera)
      }
      animate()

      const onResize = () => {
        camera.aspect = container.clientWidth / container.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(container.clientWidth, container.clientHeight)
      }
      window.addEventListener('resize', onResize)

      threeCleanupRef.current = () => {
        disposed = true
        cancelAnimationFrame(animId)
        window.removeEventListener('resize', onResize)
        renderer.domElement.removeEventListener('click', onCanvasClick)
        if (controls) controls.dispose()
        scene.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose()
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
            else obj.material.dispose()
          }
        })
        scene.clear()
        renderer.dispose()
        renderer.forceContextLoss()
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }

    initScene()
    return () => { if (threeCleanupRef.current) { threeCleanupRef.current(); threeCleanupRef.current = null } }
  }, [project, projectId, router])

  // Camera animation when focusing on a part
  const focusOnPart = useCallback((partId) => {
    setFocusedPart(partId)
    const mesh = meshMapRef.current[partId]
    const controls = controlsRef.current
    const camera = cameraRef.current
    if (!mesh || !controls || !camera) return

    const targetPos = mesh.position.clone()
    const cameraOffset = new window.THREE.Vector3(3, 2.5, 3)
    const newCameraPos = targetPos.clone().add(cameraOffset)

    // Animate camera over 700ms
    const startPos = camera.position.clone()
    const startTarget = controls.target.clone()
    const startTime = performance.now()
    const duration = 700

    controls.autoRotate = false
    function animateCamera(now) {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t // ease-in-out

      camera.position.lerpVectors(startPos, newCameraPos, ease)
      controls.target.lerpVectors(startTarget, targetPos, ease)
      controls.update()

      if (t < 1) requestAnimationFrame(animateCamera)
    }
    requestAnimationFrame(animateCamera)
  }, [])

  if (!project) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="text-sm text-[#737373]">Project not found</div></div>
  }

  const completedCount = parts.filter(p => p.status === 'completed').length

  return (
    <div className="h-dvh flex flex-col bg-[#0a0a0a] -m-4 md:-m-6">
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[#111111] border-b border-[rgba(255,255,255,0.06)]">
        <Link href="/build" className="flex items-center gap-1 text-[#737373] hover:text-white transition-colors text-sm">
          <IconArrowLeft size={14} />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="h-4 w-px bg-[#1a1a1a]" />
        <h1 className="text-sm font-semibold text-white truncate">{project.title}</h1>
        <div className="flex items-center gap-2 ml-auto text-xs text-[#737373]">
          <span>{completedCount}/{parts.length} parts</span>
          <div className="h-3 w-px bg-[#1a1a1a]" />
          <div className="flex items-center gap-1"><IconUser size={11} /><span>{project.builders}</span></div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden flex items-center justify-center w-7 h-7 rounded-md bg-[#1a1a1a] text-[#737373] hover:text-white transition-colors">
            {sidebarOpen ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative min-w-0" ref={canvasRef} style={{ cursor: 'default' }} />

        <div className={`shrink-0 border-l border-[rgba(255,255,255,0.06)] bg-[#111111] flex flex-col transition-all duration-200 ${sidebarOpen ? 'w-64 md:w-72' : 'w-0 overflow-hidden'}`}>
          <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.06)]">
            <h2 className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Parts</h2>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-behavior-contain" style={{ scrollbarWidth: 'thin' }}>
            <div className="p-2 space-y-0.5">
              {parts.map(part => (
                <div key={part.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${focusedPart === part.id ? 'bg-[#1a1a1a] text-white' : 'hover:bg-[#141414] text-[#d4d4d4]'}`} onClick={() => focusOnPart(part.id)}>
                  <ColorSwatch color={part.color} />
                  <StatusDot status={part.status} />
                  <span className="text-xs font-medium flex-1 truncate">{part.name}</span>
                  {part.status === 'completed' && part.builder && <span className="text-[10px] text-[#737373]">{part.builder}</span>}
                  {part.status === 'incomplete' && (
                    <Link href={`/build/${projectId}/${part.id}`} className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 transition-colors" onClick={e => e.stopPropagation()}>Build</Link>
                  )}
                  {part.status === 'locked' && <IconLock size={10} className="text-[#404040]" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 h-1 bg-[#1a1a1a]">
        <div className="h-full progress-3d transition-all duration-500" style={{ width: `${(completedCount / parts.length) * 100}%` }} />
      </div>
    </div>
  )
}
