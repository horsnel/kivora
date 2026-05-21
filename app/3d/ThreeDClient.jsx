'use client'

import { useState, useRef, useCallback, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Float, Text, PresentationControls } from '@react-three/drei'
import { useTranslation } from '@/components/LanguageProvider'
import { IconDownload, IconEye, IconArrowRight, IconClose } from '@/components/Icons'

/* ── Sample images to showcase ── */
const SAMPLE_IMAGES = [
  { src: '/images/workspace.png', label: 'Workspace' },
  { src: '/images/lagos-sunset.png', label: 'Lagos Sunset' },
  { src: '/images/cyberpunk.png', label: 'Cyberpunk' },
  { src: '/images/afro-city.png', label: 'Afro City' },
  { src: '/images/cherry-blossom.png', label: 'Cherry Blossom' },
  { src: '/images/coral-reef.png', label: 'Coral Reef' },
  { src: '/images/aurora-mountain.png', label: 'Aurora Mountain' },
  { src: '/images/space-station.png', label: 'Space Station' },
]

/* ── 3D Image Plane Component ── */
function ImagePlane({ src, isActive }) {
  const meshRef = useRef()
  const [hovered, setHovered] = useState(false)
  const [texture, setTexture] = useState(null)

  // Load texture
  useState(() => {
    if (typeof window !== 'undefined') {
      const loader = new (require('three').TextureLoader)()
      loader.load(src, (tex) => {
        tex.minFilter = require('three').LinearFilter
        tex.magFilter = require('three').LinearFilter
        setTexture(tex)
      })
    }
  }, [src])

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05
      // Scale up when active
      const targetScale = isActive ? 1.0 : 0.85
      meshRef.current.scale.lerp({ x: targetScale, y: targetScale, z: targetScale }, 0.05)
      // Hover glow
      if (meshRef.current.material) {
        const targetEmissive = hovered ? 0.08 : 0
        meshRef.current.material.emissiveIntensity += (targetEmissive - meshRef.current.material.emissiveIntensity) * 0.1
      }
    }
  })

  if (!texture) return null

  const aspect = texture.image ? texture.image.width / texture.image.height : 1.5
  const height = 2.2
  const width = height * aspect

  return (
    <mesh
      ref={meshRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={texture}
        side={2}
        emissive="#dc2626"
        emissiveIntensity={0}
        toneMapped={false}
      />
    </mesh>
  )
}

/* ── Floating Particles ── */
function Particles({ count = 40 }) {
  const ref = useRef()
  const positions = useRef(
    Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 8,
      y: (Math.random() - 0.5) * 6,
      z: (Math.random() - 0.5) * 4,
      speed: 0.2 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2,
    }))
  )

  useFrame((state) => {
    if (!ref.current) return
    const geo = ref.current.geometry
    const pos = geo.attributes.position
    if (!pos) return

    positions.current.forEach((p, i) => {
      const y = pos.getY(i)
      pos.setY(i, y + Math.sin(state.clock.elapsedTime * p.speed + p.offset) * 0.002)
      pos.setX(i, pos.getX(i) + Math.sin(state.clock.elapsedTime * 0.3 + p.offset) * 0.001)
    })
    pos.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={new Float32Array(positions.current.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#dc2626" transparent opacity={0.6} sizeAttenuation />
    </points>
  )
}

/* ── Camera Controller ── */
function CameraRig() {
  const { camera } = useThree()
  useFrame((state) => {
    camera.position.x += (state.mouse.x * 0.5 - camera.position.x) * 0.02
    camera.position.y += (state.mouse.y * 0.3 - camera.position.y) * 0.02
    camera.lookAt(0, 0, 0)
  })
  return null
}

/* ── 3D Scene ── */
function Scene({ activeImage }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-3, 2, 4]} intensity={0.5} color="#dc2626" />
      <pointLight position={[3, -2, 4]} intensity={0.3} color="#a855f7" />

      <CameraRig />
      <Particles />

      <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.3}>
        <PresentationControls
          global
          zoom={0.8}
          rotation={[0, 0, 0]}
          polar={[-0.3, 0.3]}
          azimuth={[-0.5, 0.5]}
          config={{ mass: 2, tension: 200 }}
        >
          {activeImage && <ImagePlane src={activeImage} isActive={true} />}
        </PresentationControls>
      </Float>

      <Environment preset="city" />
    </>
  )
}

/* ── Main 3D Viewer Component ── */
export default function ThreeDClient() {
  const { t } = useTranslation()
  const [activeImage, setActiveImage] = useState(SAMPLE_IMAGES[0].src)
  const [fullscreen, setFullscreen] = useState(false)
  const canvasRef = useRef()

  const handleExport = useCallback(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'kivora-3d-view.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [])

  return (
    <div className={`bg-[#0a0a0a] text-white ${fullscreen ? 'fixed inset-0 z-50' : 'min-h-screen'}`}>
      {/* Header */}
      <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center">
              <IconEye size={14} className="text-white" />
            </div>
            <h1 className="font-bold text-sm tracking-tight">
              3D <span className="text-red-500">Viewer</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 bg-[#111111] border border-[#1a1a1a] hover:border-[#2a2a2a] text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <IconDownload size={12} /> Export
            </button>
            <button
              onClick={() => setFullscreen(!fullscreen)}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
            >
              {fullscreen ? 'Exit' : 'Fullscreen'}
            </button>
            {fullscreen && (
              <button onClick={() => setFullscreen(false)} className="w-7 h-7 flex items-center justify-center text-[#737373] hover:text-white">
                <IconClose size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row h-[calc(100vh-48px)]">
        {/* Sidebar — image list */}
        <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-[#1a1a1a] bg-[#0d0d0d] overflow-y-auto p-3">
          <p className="text-[10px] uppercase tracking-widest text-[#525252] font-semibold mb-3 px-1">
            Select Image
          </p>
          <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
            {SAMPLE_IMAGES.map((img) => (
              <button
                key={img.src}
                onClick={() => setActiveImage(img.src)}
                className={`relative rounded-lg overflow-hidden border-2 transition-all duration-200 aspect-[4/3] ${
                  activeImage === img.src
                    ? 'border-red-500 shadow-lg shadow-red-500/10'
                    : 'border-[#1a1a1a] hover:border-[#2a2a2a]'
                }`}
              >
                <img
                  src={img.src}
                  alt={img.label}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                  <p className="text-[9px] text-white font-medium truncate">{img.label}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 px-1">
            <p className="text-[10px] text-[#525252] leading-relaxed">
              Click and drag to rotate. Scroll to zoom. The image renders in a 3D space with dynamic lighting and floating particles.
            </p>
          </div>
        </div>

        {/* 3D Canvas */}
        <div ref={canvasRef} className="flex-1 relative">
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
            </div>
          }>
            <Canvas
              camera={{ position: [0, 0, 5], fov: 50 }}
              gl={{ preserveDrawingBuffer: true, antialias: true }}
              className="w-full h-full"
            >
              <Scene activeImage={activeImage} />
            </Canvas>
          </Suspense>

          {/* Controls hint overlay */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#0a0a0a]/80 backdrop-blur-md border border-[#1a1a1a] rounded-full px-4 py-2">
            <span className="text-[10px] text-[#525252]">🖱 Drag to rotate</span>
            <span className="text-[10px] text-[#1a1a1a]">|</span>
            <span className="text-[10px] text-[#525252]">⚡ Scroll to zoom</span>
          </div>
        </div>
      </div>
    </div>
  )
}
