'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import { IconEye, IconMaximize, IconMinimize, IconBuild, IconGrid, IconPlanet, IconNebula, IconNature, IconBuildings, IconMoon, IconEarth, IconSun, IconGlobe, IconTelescope, IconWaves, IconMountain, IconHome, IconMuseum, IconCube, IconMars, IconSaturn, IconBlackHole, IconGalaxy, IconAsteroid, IconVolcano, IconForest, IconCastle, IconCrystal, IconJupiter, IconVenus, IconMercury, IconNeptune, IconUranus, IconComet, IconSupernova, IconPulsar, IconDesert, IconCave, IconWaterfall, IconArctic, IconPyramid, IconLighthouse, IconBridge, IconSkyscraper } from '@/components/Icons'
import Link from 'next/link'

const CATEGORIES = [
  { id: 'all',         label: 'All',                  icon: IconGrid,      color: '#ef4444' },
  { id: 'planetary',   label: 'Planetary',            icon: IconPlanet,    color: '#a855f7' },
  { id: 'deepspace',   label: 'Deep Space',            icon: IconNebula,    color: '#6366f1' },
  { id: 'environment',  label: 'Environment',            icon: IconNature,    color: '#16a34a' },
  { id: 'structures',  label: 'Structures & Objects',  icon: IconBuildings, color: '#f59e0b' },
]

const SCENES = [
  {
    id: 'moon',
    label: 'Moon',
    category: 'planetary',
    description: 'Interactive 3D Moon with procedural textures and NASA data',
    icon: IconMoon,
  },
  {
    id: 'earth',
    label: 'Earth',
    category: 'planetary',
    description: 'Our blue planet with atmosphere, clouds, and city lights',
    icon: IconEarth,
  },
  {
    id: 'solar',
    label: 'Solar System',
    category: 'planetary',
    description: 'Planets orbiting a glowing sun with particle trails',
    icon: IconSun,
  },
  {
    id: 'globe',
    label: 'Globe',
    category: 'planetary',
    description: 'Interactive 3D Globe with procedural surface details',
    icon: IconGlobe,
  },
  {
    id: 'mars',
    label: 'Mars',
    category: 'planetary',
    description: 'The Red Planet with Olympus Mons and Valles Marineris',
    icon: IconMars,
  },
  {
    id: 'saturn',
    label: 'Saturn',
    category: 'planetary',
    description: 'Ringed gas giant with icy particle rings and moons',
    icon: IconSaturn,
  },
  {
    id: 'deepspace',
    label: 'Deep Space',
    category: 'deepspace',
    description: 'Nebula exploration with Hubble telescope imagery',
    icon: IconTelescope,
  },
  {
    id: 'blackhole',
    label: 'Black Hole',
    category: 'deepspace',
    description: 'Supermassive black hole with accretion disk and jets',
    icon: IconBlackHole,
  },
  {
    id: 'galaxy',
    label: 'Galaxy',
    category: 'deepspace',
    description: 'Spiral galaxy with rotating arms and stellar nurseries',
    icon: IconGalaxy,
  },
  {
    id: 'asteroid',
    label: 'Asteroid Belt',
    category: 'deepspace',
    description: 'Floating asteroid field with tumbling rocky debris',
    icon: IconAsteroid,
  },
  {
    id: 'ocean',
    label: 'Ocean',
    category: 'environment',
    description: 'Animated ocean waves under a golden sunset sky',
    icon: IconWaves,
  },
  {
    id: 'terrain',
    label: 'Terrain',
    category: 'environment',
    description: 'Procedural mountain landscape with atmospheric fog',
    icon: IconMountain,
  },
  {
    id: 'volcano',
    label: 'Volcano',
    category: 'environment',
    description: 'Erupting volcano with lava flows and ash clouds',
    icon: IconVolcano,
  },
  {
    id: 'forest',
    label: 'Forest',
    category: 'environment',
    description: 'Dense forest with sunlight filtering through canopy',
    icon: IconForest,
  },
  {
    id: 'house',
    label: 'House',
    category: 'structures',
    description: 'Modern house with interior rooms, furniture, and warm lighting',
    icon: IconHome,
  },
  {
    id: 'museum',
    label: 'Museum',
    category: 'structures',
    description: 'Grand museum hall with columns, sculptures, and dramatic lighting',
    icon: IconMuseum,
  },
  {
    id: 'cube',
    label: "Rubik's Cube",
    category: 'structures',
    description: "Interactive 3x3 Rubik's Cube with face rotation",
    icon: IconCube,
  },
  {
    id: 'castle',
    label: 'Castle',
    category: 'structures',
    description: 'Medieval stone castle with towers, battlements, and a moat',
    icon: IconCastle,
  },
  {
    id: 'crystal',
    label: 'Crystal Cave',
    category: 'structures',
    description: 'Underground crystal cave with glowing mineral formations',
    icon: IconCrystal,
  },
  // ── New Planetary scenes ──
  {
    id: 'jupiter',
    label: 'Jupiter',
    category: 'planetary',
    description: 'Gas giant with Great Red Spot and swirling cloud bands',
    icon: IconJupiter,
  },
  {
    id: 'venus',
    label: 'Venus',
    category: 'planetary',
    description: 'Shrouded in thick sulfuric acid clouds, scorching surface',
    icon: IconVenus,
  },
  {
    id: 'mercury',
    label: 'Mercury',
    category: 'planetary',
    description: 'Crater-scorched world closest to the Sun',
    icon: IconMercury,
  },
  {
    id: 'neptune',
    label: 'Neptune',
    category: 'planetary',
    description: 'Ice giant with supersonic winds and deep blue atmosphere',
    icon: IconNeptune,
  },
  {
    id: 'uranus',
    label: 'Uranus',
    category: 'planetary',
    description: 'Tilted ice giant rolling on its side with faint rings',
    icon: IconUranus,
  },
  {
    id: 'comet',
    label: 'Comet',
    category: 'planetary',
    description: 'Icy wanderer with glowing tail streaking through space',
    icon: IconComet,
  },
  // ── New Deep Space scenes ──
  {
    id: 'supernova',
    label: 'Supernova',
    category: 'deepspace',
    description: 'Exploding star releasing brilliant shockwaves of light',
    icon: IconSupernova,
  },
  {
    id: 'pulsar',
    label: 'Pulsar',
    category: 'deepspace',
    description: 'Rapidly spinning neutron star emitting radio beams',
    icon: IconPulsar,
  },
  // ── New Environment scenes ──
  {
    id: 'desert',
    label: 'Desert',
    category: 'environment',
    description: 'Vast sand dunes under a blazing sun with shimmering heat',
    icon: IconDesert,
  },
  {
    id: 'cave',
    label: 'Cave',
    category: 'environment',
    description: 'Underground cavern with stalactites and bioluminescent glow',
    icon: IconCave,
  },
  {
    id: 'waterfall',
    label: 'Waterfall',
    category: 'environment',
    description: 'Cascading waterfall in a lush tropical gorge',
    icon: IconWaterfall,
  },
  {
    id: 'arctic',
    label: 'Arctic',
    category: 'environment',
    description: 'Frozen tundra with aurora borealis dancing overhead',
    icon: IconArctic,
  },
  // ── New Structures scenes ──
  {
    id: 'pyramid',
    label: 'Pyramid',
    category: 'structures',
    description: 'Ancient Egyptian pyramid under a starlit desert sky',
    icon: IconPyramid,
  },
  {
    id: 'lighthouse',
    label: 'Lighthouse',
    category: 'structures',
    description: 'Coastal lighthouse with sweeping beam through fog',
    icon: IconLighthouse,
  },
  {
    id: 'bridge',
    label: 'Bridge',
    category: 'structures',
    description: 'Suspension bridge spanning a misty river at dusk',
    icon: IconBridge,
  },
  {
    id: 'skyscraper',
    label: 'Skyscraper',
    category: 'structures',
    description: 'Glass and steel tower piercing through city clouds',
    icon: IconSkyscraper,
  },
]

/* ── Load Three.js + OrbitControls from local files ── */
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

/* ── Check WebGL availability ── */
function checkWebGL() {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    return !!gl
  } catch { return false }
}

let threeLoaded = false
async function ensureThreeJS() {
  // Re-verify scripts are still loaded (they may have been removed by cleanup or HMR)
  if (threeLoaded && window.THREE && window.THREE.OrbitControls) return
  threeLoaded = false

  // Check WebGL first — if not available, no point loading scripts
  if (!checkWebGL()) {
    throw new Error('NO_WEBGL')
  }

  // Core scripts (required)
  await loadScript('/3d-lib/three.min.js')
  await loadScript('/3d-lib/OrbitControls.js')

  // Optional scripts — failure here should not block the viewer
  // CRITICAL: load order matters! EffectComposer.js defines THREE.Pass
  // which ShaderPass.js and RenderPass.js extend, so it MUST load first.
  const optionalScripts = [
    '/3d-lib/RGBELoader.js',
    '/3d-lib/CopyShader.js',
    '/3d-lib/LuminosityHighPassShader.js',
    '/3d-lib/EffectComposer.js',       // defines THREE.Pass, THREE.FullScreenQuad
    '/3d-lib/ShaderPass.js',           // extends THREE.Pass
    '/3d-lib/RenderPass.js',           // extends THREE.Pass
    '/3d-lib/UnrealBloomPass.js',      // extends THREE.Pass
  ]
  for (const src of optionalScripts) {
    try { await loadScript(src) } catch { /* optional, ignore */ }
  }
  threeLoaded = true
}

/* ── Helper: create premium renderer with HDR support ── */
function createRenderer(container) {
  const THREE = window.THREE
  const width = container.clientWidth || 300
  const height = container.clientHeight || 300
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true, failIfMajorPerformanceCaveat: false })
  if (!renderer) throw new Error('WebGL context creation failed')
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.outputEncoding = THREE.sRGBEncoding
  renderer.physicallyCorrectLights = true
  container.appendChild(renderer.domElement)
  return renderer
}

/* ── Helper: load HDRI environment map ── */
const hdriCache = {}
function clearHDRICache() {
  Object.values(hdriCache).forEach(envMap => { if (envMap && envMap.dispose) envMap.dispose() })
  for (const key in hdriCache) delete hdriCache[key]
}
function loadHDRI(url, renderer) {
  const THREE = window.THREE
  if (hdriCache[url]) return Promise.resolve(hdriCache[url])
  if (!THREE.RGBELoader) return Promise.resolve(null)
  return new Promise((resolve) => {
    new THREE.RGBELoader()
      .setDataType(THREE.UnsignedByteType)
      .load(url, (texture) => {
        const pmremGenerator = new THREE.PMREMGenerator(renderer)
        pmremGenerator.compileEquirectangularShader()
        const envMap = pmremGenerator.fromEquirectangular(texture).texture
        texture.dispose()
        pmremGenerator.dispose()
        hdriCache[url] = envMap
        resolve(envMap)
      }, undefined, () => { resolve(null) })
  })
}

/* ── Helper: setup bloom post-processing ── */
function setupBloom(scene, camera, renderer, opts = {}) {
  const THREE = window.THREE
  if (!THREE.EffectComposer || !THREE.RenderPass || !THREE.UnrealBloomPass || !THREE.ShaderPass) return null
  try {
    const width = renderer.domElement.width
    const height = renderer.domElement.height
    const composer = new THREE.EffectComposer(renderer)
    const renderPass = new THREE.RenderPass(scene, camera)
    composer.addPass(renderPass)
    const bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(width, height),
      opts.strength || 0.4,
      opts.radius || 0.6,
      opts.threshold || 0.85
    )
    composer.addPass(bloomPass)
    return { composer, bloomPass }
  } catch (err) {
    console.warn('Bloom setup failed, falling back to direct render:', err.message)
    return null
  }
}

/* ── Helper: load PBR material with textures ── */
function loadPBRMaterial(basePath, renderer, overrides = {}) {
  const THREE = window.THREE
  const textureLoader = new THREE.TextureLoader()
  const aniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 8

  // Only pass valid MeshStandardMaterial properties (not internal helpers like repeat, normalScale, displacementScale)
  const { repeat: _repeat, normalScale: _normalScale, displacementScale: _displacementScale, ...matProps } = overrides
  const mat = new THREE.MeshStandardMaterial({
    color: overrides.color || 0xffffff,
    roughness: overrides.roughness || 0.8,
    metalness: overrides.metalness || 0.0,
    envMapIntensity: overrides.envMapIntensity || 1.0,
    ...matProps,
  })

  // Load color texture
  if (basePath) {
    textureLoader.load(`${basePath}_Color.jpg`, (tex) => {
      tex.encoding = THREE.sRGBEncoding
      tex.anisotropy = aniso
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      if (overrides.repeat) { tex.repeat.set(overrides.repeat, overrides.repeat) }
      mat.map = tex
      mat.needsUpdate = true
    }, undefined, () => {})

    // Load normal map
    textureLoader.load(`${basePath}_NormalGL.jpg`, (tex) => {
      tex.anisotropy = aniso
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      if (overrides.repeat) { tex.repeat.set(overrides.repeat, overrides.repeat) }
      mat.normalMap = tex
      mat.normalScale.set(overrides.normalScale || 1.0, overrides.normalScale || 1.0)
      mat.needsUpdate = true
    }, undefined, () => {})

    // Load roughness map
    textureLoader.load(`${basePath}_Roughness.jpg`, (tex) => {
      tex.anisotropy = aniso
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      if (overrides.repeat) { tex.repeat.set(overrides.repeat, overrides.repeat) }
      mat.roughnessMap = tex
      mat.needsUpdate = true
    }, undefined, () => {})

    // Load displacement map (optional)
    if (overrides.displacementScale) {
      textureLoader.load(`${basePath}_Displacement.jpg`, (tex) => {
        tex.anisotropy = aniso
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        if (overrides.repeat) { tex.repeat.set(overrides.repeat, overrides.repeat) }
        mat.displacementMap = tex
        mat.displacementScale = overrides.displacementScale
        mat.needsUpdate = true
      }, undefined, () => {})
    }
  }

  return mat
}

function addResizeHandler(camera, renderer, container) {
  const onResize = () => {
    const w = container.clientWidth || 300
    const h = container.clientHeight || 300
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  window.addEventListener('resize', onResize)
  return onResize
}

function addOrbitControls(camera, renderer, opts = {}) {
  const THREE = window.THREE
  if (!THREE.OrbitControls) return null
  const controls = new THREE.OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = opts.dampingFactor || 0.05
  controls.enablePan = opts.enablePan !== undefined ? opts.enablePan : false
  controls.minDistance = opts.minDistance || 2
  controls.maxDistance = opts.maxDistance || 20
  controls.rotateSpeed = opts.rotateSpeed || 0.5
  controls.autoRotate = opts.autoRotate !== undefined ? opts.autoRotate : true
  controls.autoRotateSpeed = opts.autoRotateSpeed || 0.3
  let autoTimer
  controls.addEventListener('start', () => { controls.autoRotate = false })
  controls.addEventListener('end', () => { clearTimeout(autoTimer); autoTimer = setTimeout(() => { controls.autoRotate = true }, 5000) })
  return controls
}

/* ── Full cleanup helper: dispose all GPU resources ── */
function fullCleanup(scene, renderer, controls) {
  try {
    // Dispose OrbitControls (removes event listeners from domElement)
    if (controls && controls.dispose) controls.dispose()
    scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => {
            if (m.map) m.map.dispose()
            if (m.bumpMap) m.bumpMap.dispose()
            if (m.specularMap) m.specularMap.dispose()
            if (m.emissiveMap) m.emissiveMap.dispose()
            if (m.roughnessMap) m.roughnessMap.dispose()
            if (m.normalMap) m.normalMap.dispose()
            if (m.displacementMap) m.displacementMap.dispose()
            m.dispose()
          })
        } else {
          if (obj.material.map) obj.material.map.dispose()
          if (obj.material.bumpMap) obj.material.bumpMap.dispose()
          if (obj.material.specularMap) obj.material.specularMap.dispose()
          if (obj.material.emissiveMap) obj.material.emissiveMap.dispose()
          if (obj.material.roughnessMap) obj.material.roughnessMap.dispose()
          if (obj.material.normalMap) obj.material.normalMap.dispose()
          if (obj.material.displacementMap) obj.material.displacementMap.dispose()
          obj.material.dispose()
        }
      }
    })
    scene.clear()
    renderer.dispose()
    // Remove canvas from DOM first, then force context loss
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
    renderer.forceContextLoss()
  } catch (err) {
    // Silently handle cleanup errors to prevent navigation issues
    console.warn('3D cleanup warning:', err?.message || err)
  }
}

/* ── Moon Scene ── */
function createMoonScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000005)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000)
  camera.position.set(0, 0, 4.5)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing for cinematic star glow
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.25, radius: 0.5, threshold: 0.9 })

  // HDRI for subtle environment reflections
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Procedural color texture (quick placeholder, NASA textures load from local)
  const colorCanvas = document.createElement('canvas'); colorCanvas.width = 512; colorCanvas.height = 256
  const ctx = colorCanvas.getContext('2d')
  ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, 512, 256)
  for (let i = 0; i < 2000; i++) {
    const x = Math.random()*512, y = Math.random()*256, r = Math.random()*3+0.5, v = Math.floor(Math.random()*40+110)
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=`rgb(${v},${v},${v})`; ctx.fill()
  }
  for (let i = 0; i < 20; i++) {
    const x = Math.random()*512, y = Math.random()*256, r = Math.random()*30+5, v = Math.floor(Math.random()*30+120)
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=`rgba(${v},${v},${v},0.6)`; ctx.fill()
    ctx.strokeStyle=`rgba(${v+20},${v+20},${v+20},0.3)`; ctx.lineWidth=2; ctx.stroke()
    for (let j = 0; j < 8; j++) {
      const angle=(j/8)*Math.PI*2+Math.random()*0.5, len=r*(2+Math.random()*3)
      ctx.beginPath(); ctx.moveTo(x+Math.cos(angle)*r,y+Math.sin(angle)*r)
      ctx.lineTo(x+Math.cos(angle)*len,y+Math.sin(angle)*len)
      ctx.strokeStyle=`rgba(${v+15},${v+15},${v+15},0.15)`; ctx.lineWidth=1+Math.random()*2; ctx.stroke()
    }
  }
  const maria=[{x:150,y:125,rx:70,ry:50},{x:275,y:112,rx:45,ry:35},{x:350,y:137,rx:37,ry:25}]
  maria.forEach(m=>{ctx.beginPath();ctx.ellipse(m.x,m.y,m.rx,m.ry,Math.random()*Math.PI,0,Math.PI*2);ctx.fillStyle=`rgba(45,45,50,${0.5+Math.random()*0.3})`;ctx.fill();ctx.strokeStyle='rgba(70,70,75,0.2)';ctx.lineWidth=3;ctx.stroke()})
  for(let i=0;i<400;i++){const x=Math.random()*512,y=Math.random()*256,r=Math.random()*4+1;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=`rgba(${Math.floor(80+Math.random()*40)},${Math.floor(80+Math.random()*40)},${Math.floor(85+Math.random()*40)},0.4)`;ctx.fill();ctx.strokeStyle='rgba(140,140,145,0.25)';ctx.lineWidth=1;ctx.stroke()}
  const colorTex=new THREE.CanvasTexture(colorCanvas);colorTex.encoding=THREE.sRGBEncoding

  // Procedural bump (quick placeholder, NASA textures load from local)
  const bumpCanvas = document.createElement('canvas'); bumpCanvas.width = 512; bumpCanvas.height = 256
  const bctx = bumpCanvas.getContext('2d')
  bctx.fillStyle='#808080'; bctx.fillRect(0,0,512,256)
  for(let i=0;i<500;i++){const x=Math.random()*512,y=Math.random()*256,r=Math.random()*10+1,v=Math.floor(Math.random()*40+100);bctx.beginPath();bctx.arc(x,y,r,0,Math.PI*2);bctx.fillStyle=`rgba(${v},${v},${v},0.15)`;bctx.fill()}
  for(let i=0;i<30;i++){const x=Math.random()*512,y=Math.random()*256,r=Math.random()*25+3;bctx.beginPath();bctx.arc(x,y,r,0,Math.PI*2);bctx.strokeStyle=`rgba(220,220,220,${0.3+Math.random()*0.3})`;bctx.lineWidth=2+Math.random()*2;bctx.stroke();bctx.beginPath();bctx.arc(x,y,r*0.7,0,Math.PI*2);bctx.fillStyle=`rgba(30,30,30,${0.3+Math.random()*0.3})`;bctx.fill()}
  const bumpTex = new THREE.CanvasTexture(bumpCanvas)

  const moonGeometry = new THREE.SphereGeometry(1.2, 96, 96)
  const moonMaterial = new THREE.MeshStandardMaterial({ map: colorTex, bumpMap: bumpTex, bumpScale: 0.04, roughness: 0.95, metalness: 0.0, color: 0xdddddd })
  const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial)
  moonMesh.rotation.y = -Math.PI / 2
  scene.add(moonMesh)

  // Starfield (reduced from 6000 to 3000)
  const starCount = 3000; const starPos = new Float32Array(starCount*3); const starCols = new Float32Array(starCount*3)
  for(let i=0;i<starCount;i++){const i3=i*3,r=80+Math.random()*400,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);starPos[i3]=r*Math.sin(phi)*Math.cos(theta);starPos[i3+1]=r*Math.sin(phi)*Math.sin(theta);starPos[i3+2]=r*Math.cos(phi);const t=Math.random();if(t>0.92){starCols[i3]=0.75;starCols[i3+1]=0.80;starCols[i3+2]=1.0}else if(t>0.85){starCols[i3]=1.0;starCols[i3+1]=0.92;starCols[i3+2]=0.75}else{starCols[i3]=1.0;starCols[i3+1]=1.0;starCols[i3+2]=1.0}}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));starGeo.setAttribute('color',new THREE.BufferAttribute(starCols,3))
  const starMat=new THREE.PointsMaterial({size:0.7,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.8,depthWrite:false})
  const starField=new THREE.Points(starGeo,starMat);scene.add(starField)

  // Lights
  const sunLight=new THREE.DirectionalLight(0xfff5e6,2.5);sunLight.position.set(5,3,5);scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x1a1a2e,0.15))
  const earthShine=new THREE.DirectionalLight(0x4466aa,0.08);earthShine.position.set(-5,-2,-3);scene.add(earthShine)

  // Load NASA textures from local files (fast, same-origin, cancellable via disposed flag)
  const textureLoader=new THREE.TextureLoader()
  textureLoader.load('/3d-textures/moon_color.jpg',(tex)=>{if(disposed)return;tex.encoding=THREE.sRGBEncoding;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();moonMaterial.map=tex;moonMaterial.needsUpdate=true},undefined,()=>{})
  textureLoader.load('/3d-textures/moon_bump.jpg',(tex)=>{if(disposed)return;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();moonMaterial.bumpMap=tex;moonMaterial.needsUpdate=true},undefined,()=>{})

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 2, maxDistance: 15 })

  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    moonMesh.rotation.x = Math.sin(t * 0.1) * 0.02
    starField.rotation.y = t * 0.002; starField.rotation.x = t * 0.001
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  // Also resize bloom composer
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Earth Scene (NASA textures loaded from local files for speed) ── */
function createEarthScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x010108)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000)
  camera.position.set(0, 0.5, 3.5)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 1.0
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom for atmospheric glow
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.3, radius: 0.5, threshold: 0.85 })

  // HDRI environment for realistic reflections
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // ── Quick placeholder texture (simple blue/green, no heavy computation) ──
  const placeholderCanvas = document.createElement('canvas')
  placeholderCanvas.width = 256; placeholderCanvas.height = 128
  const pctx = placeholderCanvas.getContext('2d')
  // Ocean gradient
  const oceanGrad = pctx.createLinearGradient(0, 0, 0, 128)
  oceanGrad.addColorStop(0, '#b8d8f0'); oceanGrad.addColorStop(0.15, '#4488cc')
  oceanGrad.addColorStop(0.5, '#1a5588'); oceanGrad.addColorStop(0.85, '#4488cc')
  oceanGrad.addColorStop(1, '#b8d8f0')
  pctx.fillStyle = oceanGrad; pctx.fillRect(0, 0, 256, 128)
  // Rough land blobs
  pctx.fillStyle = '#3a7a3a'
  pctx.beginPath(); pctx.ellipse(60, 40, 25, 18, 0, 0, Math.PI*2); pctx.fill()
  pctx.beginPath(); pctx.ellipse(55, 70, 15, 25, 0.2, 0, Math.PI*2); pctx.fill()
  pctx.beginPath(); pctx.ellipse(130, 35, 20, 15, 0, 0, Math.PI*2); pctx.fill()
  pctx.beginPath(); pctx.ellipse(155, 50, 35, 20, 0, 0, Math.PI*2); pctx.fill()
  pctx.beginPath(); pctx.ellipse(200, 75, 15, 10, 0, 0, Math.PI*2); pctx.fill()
  const placeholderTex = new THREE.CanvasTexture(placeholderCanvas)
  placeholderTex.encoding = THREE.sRGBEncoding

  // ── Earth sphere ──
  const earthGeo = new THREE.SphereGeometry(1.2, 96, 96)
  const earthMat = new THREE.MeshPhongMaterial({
    map: placeholderTex,
    bumpScale: 0.04,
    specular: new THREE.Color(0x333333),
    shininess: 25,
  })
  const earthMesh = new THREE.Mesh(earthGeo, earthMat)
  scene.add(earthMesh)

  // ── Fresnel Atmosphere Glow (shader-based) ──
  const atmosVert = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `
  const atmosFrag = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vec3 viewDir = normalize(-vPosition);
      float fresnel = 1.0 - dot(viewDir, vNormal);
      fresnel = pow(fresnel, 3.5);
      vec3 atmosColor = mix(vec3(0.3, 0.6, 1.0), vec3(0.1, 0.3, 0.8), fresnel);
      gl_FragColor = vec4(atmosColor, fresnel * 0.75);
    }
  `
  const atmosGeo = new THREE.SphereGeometry(1.38, 64, 64)
  const atmosMat = new THREE.ShaderMaterial({
    vertexShader: atmosVert,
    fragmentShader: atmosFrag,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  scene.add(new THREE.Mesh(atmosGeo, atmosMat))

  // Outer soft glow
  const outerFrag = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vec3 viewDir = normalize(-vPosition);
      float fresnel = 1.0 - dot(viewDir, vNormal);
      fresnel = pow(fresnel, 5.0);
      gl_FragColor = vec4(0.4, 0.65, 1.0, fresnel * 0.35);
    }
  `
  const outerGeo = new THREE.SphereGeometry(1.55, 64, 64)
  const outerMat = new THREE.ShaderMaterial({
    vertexShader: atmosVert,
    fragmentShader: outerFrag,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  scene.add(new THREE.Mesh(outerGeo, outerMat))

  // ── Cloud layer (simple placeholder, will be replaced by NASA texture) ──
  const cloudPlaceholderCanvas = document.createElement('canvas')
  cloudPlaceholderCanvas.width = 128; cloudPlaceholderCanvas.height = 64
  const ccctx = cloudPlaceholderCanvas.getContext('2d')
  ccctx.clearRect(0, 0, 128, 64)
  // A few white blobs for quick placeholder clouds
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 128, y = Math.random() * 64, r = Math.random() * 12 + 4
    ccctx.beginPath(); ccctx.arc(x, y, r, 0, Math.PI*2)
    ccctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.15})`; ccctx.fill()
  }
  const cloudPlaceholderTex = new THREE.CanvasTexture(cloudPlaceholderCanvas)
  cloudPlaceholderTex.encoding = THREE.sRGBEncoding
  const cloudGeo = new THREE.SphereGeometry(1.235, 64, 64)
  const cloudMat = new THREE.MeshPhongMaterial({
    map: cloudPlaceholderTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat)
  scene.add(cloudMesh)

  // ── Night Lights (simple placeholder) ──
  const lightsPlaceholderCanvas = document.createElement('canvas')
  lightsPlaceholderCanvas.width = 256; lightsPlaceholderCanvas.height = 128
  const lctx = lightsPlaceholderCanvas.getContext('2d')
  lctx.clearRect(0, 0, 256, 128)
  // Quick city dots
  const cityCoords = [
    {x:68,y:44,s:4},{x:90,y:48,s:3},{x:128,y:38,s:5},{x:135,y:42,s:4},
    {x:140,y:45,s:3},{x:148,y:40,s:3},{x:155,y:42,s:4},{x:160,y:44,s:5},
    {x:165,y:46,s:3},{x:170,y:48,s:4},{x:50,y:36,s:3},{x:55,y:40,s:3},
  ]
  cityCoords.forEach(c => {
    for (let i = 0; i < c.s * 15; i++) {
      const x = c.x + (Math.random()-0.5) * c.s * 4
      const y = c.y + (Math.random()-0.5) * c.s * 2
      lctx.beginPath(); lctx.arc(x, y, Math.random() * 0.8 + 0.2, 0, Math.PI*2)
      lctx.fillStyle = `rgba(255,${200+Math.floor(Math.random()*55)},${100+Math.floor(Math.random()*80)},${0.4+Math.random()*0.5})`
      lctx.fill()
    }
  })
  const lightsPlaceholderTex = new THREE.CanvasTexture(lightsPlaceholderCanvas)
  lightsPlaceholderTex.encoding = THREE.sRGBEncoding
  const lightsGeo = new THREE.SphereGeometry(1.205, 64, 64)
  const lightsMat = new THREE.MeshBasicMaterial({
    map: lightsPlaceholderTex, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const lightsMesh = new THREE.Mesh(lightsGeo, lightsMat)
  scene.add(lightsMesh)

  // ── Starfield (reduced for performance) ──
  const starCount = 2500
  const starPos = new Float32Array(starCount*3)
  const starCols = new Float32Array(starCount*3)
  for(let i=0;i<starCount;i++){
    const i3=i*3, r=60+Math.random()*400, theta=Math.random()*Math.PI*2, phi=Math.acos(2*Math.random()-1)
    starPos[i3]=r*Math.sin(phi)*Math.cos(theta); starPos[i3+1]=r*Math.sin(phi)*Math.sin(theta); starPos[i3+2]=r*Math.cos(phi)
    const t=Math.random()
    if(t>0.95){starCols[i3]=0.7;starCols[i3+1]=0.8;starCols[i3+2]=1.0}
    else if(t>0.88){starCols[i3]=1.0;starCols[i3+1]=0.9;starCols[i3+2]=0.7}
    else{starCols[i3]=1.0;starCols[i3+1]=1.0;starCols[i3+2]=1.0}
  }
  const starGeo=new THREE.BufferGeometry()
  starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3))
  starGeo.setAttribute('color',new THREE.BufferAttribute(starCols,3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({size:0.5,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.8,depthWrite:false})))

  // ── Lighting ──
  const sunLight = new THREE.DirectionalLight(0xfff8e8, 2.2)
  sunLight.position.set(5, 2, 5)
  scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x0a0a1e, 0.25))
  const earthshine = new THREE.DirectionalLight(0x3355aa, 0.06)
  earthshine.position.set(-5, -1, -5)
  scene.add(earthshine)

  // ── Load high-quality NASA textures from local files (fast, same-origin) ──
  const textureLoader = new THREE.TextureLoader()
  // NASA Blue Marble - day texture
  textureLoader.load(
    '/3d-textures/earth_day.jpg',
    (tex) => {
      if (disposed) return
      tex.encoding = THREE.sRGBEncoding
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      earthMat.map = tex
      earthMat.needsUpdate = true
    }, undefined, () => {}
  )
  // Bump/elevation map
  textureLoader.load(
    '/3d-textures/earth_bump.png',
    (tex) => {
      if (disposed) return
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      earthMat.bumpMap = tex
      earthMat.bumpScale = 0.04
      earthMat.needsUpdate = true
    }, undefined, () => {}
  )
  // Specular/water mask
  textureLoader.load(
    '/3d-textures/earth_specular.png',
    (tex) => {
      if (disposed) return
      earthMat.specularMap = tex
      earthMat.needsUpdate = true
    }, undefined, () => {}
  )
  // NASA city lights (night)
  textureLoader.load(
    '/3d-textures/earth_night.jpg',
    (tex) => {
      if (disposed) return
      tex.encoding = THREE.sRGBEncoding
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      lightsMat.map = tex
      lightsMat.needsUpdate = true
    }, undefined, () => {}
  )
  // Cloud layer
  textureLoader.load(
    '/3d-textures/earth_clouds.png',
    (tex) => {
      if (disposed) return
      tex.encoding = THREE.sRGBEncoding
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      cloudMat.map = tex
      cloudMat.needsUpdate = true
    }, undefined, () => {}
  )

  // ── Controls ──
  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 2, maxDistance: 12, autoRotateSpeed: 0.25 })

  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    earthMesh.rotation.y = t * 0.04
    cloudMesh.rotation.y = t * 0.048
    lightsMesh.rotation.y = earthMesh.rotation.y
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Solar System Scene ── */
function createSolarScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000003)
  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 2000)
  camera.position.set(0, 18, 30)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.35, radius: 0.5, threshold: 0.9 })

  // HDRI environment
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Sun
  const sunGeo = new THREE.SphereGeometry(2, 64, 64)
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 })
  const sunMesh = new THREE.Mesh(sunGeo, sunMat)
  scene.add(sunMesh)

  // Load real NASA Sun texture
  const sunTexLoader = new THREE.TextureLoader()
  sunTexLoader.load('/3d-textures/sun_color.jpg', (tex) => { tex.encoding = THREE.sRGBEncoding; sunMat.map = tex; sunMat.needsUpdate = true }, undefined, () => {})

  // Sun glow
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = 256; glowCanvas.height = 256
  const gctx = glowCanvas.getContext('2d')
  const sunGrad = gctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  sunGrad.addColorStop(0, 'rgba(255,220,50,1.0)')
  sunGrad.addColorStop(0.2, 'rgba(255,180,30,0.8)')
  sunGrad.addColorStop(0.5, 'rgba(255,120,10,0.3)')
  sunGrad.addColorStop(1, 'rgba(255,60,0,0)')
  gctx.fillStyle = sunGrad; gctx.fillRect(0, 0, 256, 256)
  const sunGlowTex = new THREE.CanvasTexture(glowCanvas)
  const sunGlowMat = new THREE.SpriteMaterial({ map: sunGlowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  const sunGlow = new THREE.Sprite(sunGlowMat)
  sunGlow.scale.set(12, 12, 1)
  scene.add(sunGlow)

  // Sun light
  const sunLight = new THREE.PointLight(0xffcc66, 3, 100)
  scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x111122, 0.15))

  // Planet data
  const planets = [
    { name: 'Mercury', radius: 0.25, distance: 4, speed: 2.0, color: 0xaaaaaa, tilt: 0.03 },
    { name: 'Venus', radius: 0.45, distance: 6, speed: 1.5, color: 0xddaa55, tilt: 0.05 },
    { name: 'Earth', radius: 0.5, distance: 8.5, speed: 1.0, color: 0x4488cc, tilt: 0.41 },
    { name: 'Mars', radius: 0.35, distance: 11, speed: 0.8, color: 0xcc5533, tilt: 0.44 },
    { name: 'Jupiter', radius: 1.2, distance: 16, speed: 0.4, color: 0xcc9966, tilt: 0.05 },
    { name: 'Saturn', radius: 1.0, distance: 21, speed: 0.3, color: 0xddcc88, tilt: 0.47, rings: true },
    { name: 'Uranus', radius: 0.6, distance: 26, speed: 0.2, color: 0x88cccc, tilt: 1.71 },
    { name: 'Neptune', radius: 0.55, distance: 30, speed: 0.15, color: 0x4455cc, tilt: 0.49 },
  ]

  const planetMeshes = []
  planets.forEach(p => {
    // Orbit ring
    const orbitGeo = new THREE.RingGeometry(p.distance - 0.02, p.distance + 0.02, 128)
    const orbitMat = new THREE.MeshBasicMaterial({ color: 0x333355, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })
    const orbit = new THREE.Mesh(orbitGeo, orbitMat)
    orbit.rotation.x = -Math.PI / 2
    scene.add(orbit)

    // Planet
    const pGeo = new THREE.SphereGeometry(p.radius, 32, 32)
    // Procedural planet texture
    const pCanvas = document.createElement('canvas'); pCanvas.width = 256; pCanvas.height = 128
    const pctx = pCanvas.getContext('2d')
    const c = new THREE.Color(p.color)
    const r = Math.floor(c.r*255), g = Math.floor(c.g*255), b = Math.floor(c.b*255)
    pctx.fillStyle = `rgb(${r},${g},${b})`; pctx.fillRect(0, 0, 256, 128)
    // Add surface variation
    for (let i = 0; i < 200; i++) {
      const x = Math.random()*256, y = Math.random()*128, rad = Math.random()*8+2
      pctx.beginPath(); pctx.arc(x, y, rad, 0, Math.PI*2)
      const dr = Math.floor(Math.random()*30-15), dg = Math.floor(Math.random()*30-15), db = Math.floor(Math.random()*30-15)
      pctx.fillStyle = `rgba(${Math.max(0,Math.min(255,r+dr))},${Math.max(0,Math.min(255,g+dg))},${Math.max(0,Math.min(255,b+db))},0.4)`; pctx.fill()
    }
    // Jupiter/Saturn bands
    if (p.name === 'Jupiter' || p.name === 'Saturn') {
      for (let i = 0; i < 8; i++) {
        const y = 16 + i * 12
        pctx.fillStyle = `rgba(${r+Math.floor(Math.random()*40-20)},${g+Math.floor(Math.random()*40-20)},${b+Math.floor(Math.random()*40-20)},0.5)`
        pctx.fillRect(0, y, 256, 6 + Math.random()*4)
      }
    }
    const pTex = new THREE.CanvasTexture(pCanvas); pTex.encoding = THREE.sRGBEncoding
    const pMat = new THREE.MeshStandardMaterial({ map: pTex, roughness: 0.8, metalness: 0.1 })
    const pMesh = new THREE.Mesh(pGeo, pMat)
    pMesh.rotation.z = p.tilt
    scene.add(pMesh)
    planetMeshes.push({ mesh: pMesh, data: p })

    // Saturn's rings
    if (p.rings) {
      const ringGeo = new THREE.RingGeometry(p.radius * 1.4, p.radius * 2.2, 64)
      const ringCanvas = document.createElement('canvas'); ringCanvas.width = 256; ringCanvas.height = 8
      const rctx = ringCanvas.getContext('2d')
      const ringGrad = rctx.createLinearGradient(0, 0, 256, 0)
      ringGrad.addColorStop(0, 'rgba(200,180,120,0.0)')
      ringGrad.addColorStop(0.1, 'rgba(200,180,120,0.6)')
      ringGrad.addColorStop(0.3, 'rgba(180,160,100,0.3)')
      ringGrad.addColorStop(0.5, 'rgba(200,180,120,0.5)')
      ringGrad.addColorStop(0.7, 'rgba(160,140,90,0.2)')
      ringGrad.addColorStop(0.9, 'rgba(200,180,120,0.4)')
      ringGrad.addColorStop(1, 'rgba(200,180,120,0.0)')
      rctx.fillStyle = ringGrad; rctx.fillRect(0, 0, 256, 8)
      const ringTex = new THREE.CanvasTexture(ringCanvas)
      const ringMat = new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
      const ringMesh = new THREE.Mesh(ringGeo, ringMat)
      ringMesh.rotation.x = -Math.PI / 2
      pMesh.add(ringMesh)
    }
  })

  // Starfield (reduced from 8000 to 4000)
  const starCount = 4000; const starPos = new Float32Array(starCount*3); const starCols = new Float32Array(starCount*3)
  for(let i=0;i<starCount;i++){const i3=i*3,r=100+Math.random()*400,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);starPos[i3]=r*Math.sin(phi)*Math.cos(theta);starPos[i3+1]=r*Math.sin(phi)*Math.sin(theta);starPos[i3+2]=r*Math.cos(phi);const t=Math.random();starCols[i3]=0.8+Math.random()*0.2;starCols[i3+1]=0.8+Math.random()*0.2;starCols[i3+2]=0.9+Math.random()*0.1}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));starGeo.setAttribute('color',new THREE.BufferAttribute(starCols,3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({size:0.4,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.7,depthWrite:false})))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 5, maxDistance: 80, autoRotateSpeed: 0.15, enablePan: true })

  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    // Orbit planets
    planetMeshes.forEach(({ mesh, data }) => {
      const angle = t * data.speed * 0.15 + data.distance
      mesh.position.x = Math.cos(angle) * data.distance
      mesh.position.z = Math.sin(angle) * data.distance
      mesh.rotation.y += 0.01
    })
    // Pulse sun glow
    sunGlow.scale.set(12 + Math.sin(t * 2) * 0.5, 12 + Math.sin(t * 2) * 0.5, 1)
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Deep Space Scene ── */
function createDeepSpaceScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000); scene.fog = new THREE.FogExp2(0x000000, 0.003)
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000); camera.position.set(0, 1, 12)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 1.4
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.5, radius: 0.5, threshold: 0.8 })

  // HDRI environment (for env reflections)
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  const textureLoader = new THREE.TextureLoader()
  const NEBULA_URLS = ['/3d-textures/nebula1.jpg','/3d-textures/nebula2.jpg','/3d-textures/nebula3.jpg']
  const nebulaPlanes = []
  function createNebulaPlane(url, z, scale, opacity, rotation) {
    const geo = new THREE.PlaneGeometry(scale, scale, 1, 1)
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    const mesh = new THREE.Mesh(geo, mat); mesh.position.z = z; mesh.rotation.z = rotation || 0; scene.add(mesh); nebulaPlanes.push(mesh)
    textureLoader.load(url, (tex) => { if (disposed) return; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); mat.map = tex; mat.opacity = opacity; mat.needsUpdate = true }, undefined, () => {})
    return mesh
  }
  createNebulaPlane(NEBULA_URLS[0], -25, 35, 0.55, 0.1)
  createNebulaPlane(NEBULA_URLS[1], -15, 28, 0.45, -0.3)
  createNebulaPlane(NEBULA_URLS[2], -8, 22, 0.35, 0.2)

  // Fallback procedural nebula
  const fbCanvas = document.createElement('canvas'); fbCanvas.width = 1024; fbCanvas.height = 1024; const fbCtx = fbCanvas.getContext('2d')
  fbCtx.fillStyle = '#000000'; fbCtx.fillRect(0, 0, 1024, 1024)
  const grad = fbCtx.createRadialGradient(512, 512, 0, 512, 512, 600); grad.addColorStop(0, 'rgba(80,40,120,0.4)'); grad.addColorStop(0.3, 'rgba(60,30,90,0.25)'); grad.addColorStop(0.6, 'rgba(40,20,60,0.12)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); fbCtx.fillStyle = grad; fbCtx.fillRect(0, 0, 1024, 1024)
  const grad2 = fbCtx.createRadialGradient(300, 400, 0, 300, 400, 400); grad2.addColorStop(0, 'rgba(120,60,30,0.2)'); grad2.addColorStop(1, 'rgba(0,0,0,0)'); fbCtx.fillStyle = grad2; fbCtx.fillRect(0, 0, 1024, 1024)
  for (let i = 0; i < 200; i++) { const x = Math.random()*1024, y = Math.random()*1024, r = Math.random()*2+0.5, b = Math.floor(Math.random()*100+155); fbCtx.beginPath(); fbCtx.arc(x,y,r,0,Math.PI*2); fbCtx.fillStyle=`rgba(${b},${b},255,${Math.random()*0.6+0.2})`; fbCtx.fill() }
  const fallbackTex = new THREE.CanvasTexture(fbCanvas); fallbackTex.encoding = THREE.sRGBEncoding
  const fbGeo = new THREE.PlaneGeometry(60, 60, 1, 1); const fbMat = new THREE.MeshBasicMaterial({ map: fallbackTex, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  const fallbackPlane = new THREE.Mesh(fbGeo, fbMat); fallbackPlane.position.z = -35; scene.add(fallbackPlane)

  // Dust
  const dustCount = 2000; const dustPos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) { dustPos[i*3] = (Math.random()-0.5)*50; dustPos[i*3+1] = (Math.random()-0.5)*50; dustPos[i*3+2] = (Math.random()-0.5)*30+5 }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dustMat = new THREE.PointsMaterial({ size: 0.12, color: 0xaaaaff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })
  const dust = new THREE.Points(dustGeo, dustMat); scene.add(dust)

  function createStarField(count, rMin, rMax, size, opacity) {
    const pos = new Float32Array(count*3); const cols = new Float32Array(count*3)
    for(let i=0;i<count;i++){const i3=i*3,r=rMin+Math.random()*(rMax-rMin),theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);pos[i3]=r*Math.sin(phi)*Math.cos(theta);pos[i3+1]=r*Math.sin(phi)*Math.sin(theta);pos[i3+2]=r*Math.cos(phi);const t=Math.random();if(t>0.96){cols[i3]=0.70;cols[i3+1]=0.78;cols[i3+2]=1.0}else if(t>0.90){cols[i3]=1.0;cols[i3+1]=0.90;cols[i3+2]=0.70}else if(t>0.85){cols[i3]=1.0;cols[i3+1]=0.70;cols[i3+2]=0.55}else{cols[i3]=1.0;cols[i3+1]=1.0;cols[i3+2]=1.0}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(cols,3))
    const mat=new THREE.PointsMaterial({size,sizeAttenuation:true,vertexColors:true,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending})
    return new THREE.Points(geo,mat)
  }
  const distantStars=createStarField(6000,20,80,0.5,0.65);scene.add(distantStars)
  const brightStars=createStarField(150,15,60,1.0,0.85);scene.add(brightStars)

  scene.add(new THREE.AmbientLight(0x111122, 0.2))
  const warmLight = new THREE.PointLight(0xff8844, 0.8, 40); warmLight.position.set(5, 3, -10); scene.add(warmLight)
  const coolLight = new THREE.PointLight(0x4488ff, 0.5, 40); coolLight.position.set(-5, -2, -15); scene.add(coolLight)

  let mouseX = 0, mouseY = 0, camYaw = 0, camPitch = 0.1, scrollSpeed = 1.0
  const onMouseMove = (e) => { mouseX = (e.clientX / window.innerWidth) * 2 - 1; mouseY = (e.clientY / window.innerHeight) * 2 - 1 }
  const onTouchMove = (e) => { if (e.touches.length > 0) { mouseX = (e.touches[0].clientX / window.innerWidth) * 2 - 1; mouseY = (e.touches[0].clientY / window.innerHeight) * 2 - 1 } }
  const onWheel = (e) => { scrollSpeed += e.deltaY * -0.001; scrollSpeed = Math.max(0.3, Math.min(2.5, scrollSpeed)) }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('touchmove', onTouchMove, { passive: true })
  document.addEventListener('wheel', onWheel, { passive: true })

  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    const targetYaw = mouseX * 0.8, targetPitch = 0.1 + mouseY * 0.5
    camYaw += (targetYaw - camYaw) * 0.03; camPitch += (targetPitch - camPitch) * 0.03
    const orbitSpeed = 0.04 * scrollSpeed, baseAngle = t * orbitSpeed
    const camRadius = 10 + Math.sin(t * 0.08) * 2, camHeight = Math.sin(camPitch) * 3, horizontalR = Math.cos(camPitch) * camRadius
    camera.position.x = Math.sin(baseAngle + camYaw) * horizontalR
    camera.position.z = Math.cos(baseAngle + camYaw) * horizontalR
    camera.position.y = camHeight + Math.sin(t * 0.15) * 0.3
    camera.lookAt(0, 0, -15)
    nebulaPlanes.forEach((plane, i) => { plane.position.x = Math.sin(t * 0.02 + i * 2) * 1.5; plane.position.y = Math.cos(t * 0.015 + i * 1.5) * 0.8; plane.rotation.z += 0.0002 * (i % 2 === 0 ? 1 : -1) })
    fallbackPlane.rotation.z = t * 0.005; distantStars.rotation.y = t * 0.003; brightStars.rotation.y = t * 0.002
    const dPos = dustGeo.attributes.position.array
    for (let i = 0; i < dustCount; i++) { dPos[i*3] += Math.sin(t*0.1+i)*0.001*scrollSpeed; dPos[i*3+1] += Math.cos(t*0.08+i*0.5)*0.0008*scrollSpeed }
    dustGeo.attributes.position.needsUpdate = true
    warmLight.intensity = 0.6 + Math.sin(t * 1.5) * 0.3; coolLight.intensity = 0.4 + Math.cos(t * 2.0) * 0.2
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('touchmove', onTouchMove); document.removeEventListener('wheel', onWheel); fullCleanup(scene, renderer, null) }
}

/* ── Globe Scene ── */
function createGlobeScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000)
  camera.position.z = 4
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.2, radius: 0.5, threshold: 0.9 })

  // HDRI environment
  loadHDRI('/3d-textures/studio_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Sphere with procedural texture
  const canvas = document.createElement('canvas')
  canvas.width = 512; canvas.height = 256
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#6677aa'; ctx.fillRect(0, 0, 512, 256)
  for (let i = 0; i < 2000; i++) {
    ctx.beginPath()
    ctx.arc(Math.random() * 512, Math.random() * 256, Math.random() * 3, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.3})`
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.encoding = THREE.sRGBEncoding

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 64, 64),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 })
  )
  scene.add(mesh)

  // Lighting
  scene.add(new THREE.AmbientLight(0x404060, 0.5))
  const light = new THREE.DirectionalLight(0xffffff, 1.5)
  light.position.set(5, 3, 5)
  scene.add(light)

  // Starfield background
  const starCount = 2500
  const starPos = new Float32Array(starCount * 3)
  const starCols = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3, r = 60 + Math.random() * 400, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1)
    starPos[i3] = r * Math.sin(phi) * Math.cos(theta); starPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta); starPos[i3 + 2] = r * Math.cos(phi)
    const t = Math.random()
    if (t > 0.95) { starCols[i3] = 0.7; starCols[i3 + 1] = 0.8; starCols[i3 + 2] = 1.0 }
    else if (t > 0.88) { starCols[i3] = 1.0; starCols[i3 + 1] = 0.9; starCols[i3 + 2] = 0.7 }
    else { starCols[i3] = 1.0; starCols[i3 + 1] = 1.0; starCols[i3 + 2] = 1.0 }
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCols, 3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.5, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false })))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 2, maxDistance: 15, autoRotateSpeed: 0.3 })

  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    mesh.rotation.y += 0.002
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Ocean Scene ── */
function createOceanScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 500)
  camera.position.set(0, 5, 15)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 1.3
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.3, radius: 0.5, threshold: 0.85 })

  // HDRI environment
  loadHDRI('/3d-textures/outdoor_daytime_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Sunset sky gradient
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 512; skyCanvas.height = 512
  const skyCtx = skyCanvas.getContext('2d')
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 512)
  skyGrad.addColorStop(0, '#0a0a2e')
  skyGrad.addColorStop(0.3, '#1a1a4a')
  skyGrad.addColorStop(0.5, '#4a2050')
  skyGrad.addColorStop(0.65, '#aa3355')
  skyGrad.addColorStop(0.75, '#dd6633')
  skyGrad.addColorStop(0.85, '#ffaa44')
  skyGrad.addColorStop(0.95, '#ffdd88')
  skyGrad.addColorStop(1, '#ffeecc')
  skyCtx.fillStyle = skyGrad; skyCtx.fillRect(0, 0, 512, 512)
  // Sun
  const sunGrad = skyCtx.createRadialGradient(256, 380, 0, 256, 380, 60)
  sunGrad.addColorStop(0, 'rgba(255,255,200,1.0)')
  sunGrad.addColorStop(0.3, 'rgba(255,200,100,0.8)')
  sunGrad.addColorStop(0.7, 'rgba(255,150,50,0.3)')
  sunGrad.addColorStop(1, 'rgba(255,100,0,0)')
  skyCtx.fillStyle = sunGrad; skyCtx.beginPath(); skyCtx.arc(256, 380, 60, 0, Math.PI*2); skyCtx.fill()
  const skyTex = new THREE.CanvasTexture(skyCanvas); skyTex.encoding = THREE.sRGBEncoding
  const skyGeo = new THREE.SphereGeometry(200, 32, 32)
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false })
  scene.add(new THREE.Mesh(skyGeo, skyMat))

  // Ocean plane with vertex animation
  const oceanSegX = 128, oceanSegZ = 128
  const oceanGeo = new THREE.PlaneGeometry(100, 100, oceanSegX, oceanSegZ)
  oceanGeo.rotateX(-Math.PI / 2)
  const oceanCanvas = document.createElement('canvas'); oceanCanvas.width = 512; oceanCanvas.height = 512
  const octx = oceanCanvas.getContext('2d')
  const oceanGrad = octx.createLinearGradient(0, 0, 0, 512)
  oceanGrad.addColorStop(0, '#0a3a5a')
  oceanGrad.addColorStop(0.5, '#0d4a6a')
  oceanGrad.addColorStop(1, '#1a5a7a')
  octx.fillStyle = oceanGrad; octx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 500; i++) {
    const x = Math.random()*512, y = Math.random()*512, r = Math.random()*4+1
    octx.beginPath(); octx.arc(x, y, r, 0, Math.PI*2)
    octx.fillStyle = `rgba(${80+Math.floor(Math.random()*40)},${140+Math.floor(Math.random()*40)},${180+Math.floor(Math.random()*40)},0.15)`; octx.fill()
  }
  const oceanTex = new THREE.CanvasTexture(oceanCanvas); oceanTex.encoding = THREE.sRGBEncoding
  oceanTex.wrapS = oceanTex.wrapT = THREE.RepeatWrapping; oceanTex.repeat.set(4, 4)
  const oceanMat = new THREE.MeshStandardMaterial({
    map: oceanTex, color: 0x1a6a8a, roughness: 0.2, metalness: 0.6,
    transparent: true, opacity: 0.9, envMapIntensity: 1.5,
  })
  const ocean = new THREE.Mesh(oceanGeo, oceanMat)
  ocean.position.y = 0
  scene.add(ocean)

  // Store original Y positions
  const oceanPosArray = oceanGeo.attributes.position.array
  const originalY = new Float32Array(oceanPosArray.length)
  for (let i = 0; i < oceanPosArray.length; i++) originalY[i] = oceanPosArray[i]

  // Sun reflection light on water
  const sunLight = new THREE.DirectionalLight(0xffaa55, 1.5); sunLight.position.set(0, 10, -20); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x334466, 0.4))
  const waterGlow = new THREE.PointLight(0xff8844, 0.8, 30); waterGlow.position.set(0, 1, -10); scene.add(waterGlow)

  // Foam particles near surface
  const foamCount = 300
  const foamPos = new Float32Array(foamCount * 3)
  for (let i = 0; i < foamCount; i++) {
    foamPos[i*3] = (Math.random()-0.5) * 80
    foamPos[i*3+1] = 0.05 + Math.random() * 0.3
    foamPos[i*3+2] = (Math.random()-0.5) * 80
  }
  const foamGeo = new THREE.BufferGeometry(); foamGeo.setAttribute('position', new THREE.BufferAttribute(foamPos, 3))
  const foam = new THREE.Points(foamGeo, new THREE.PointsMaterial({ size: 0.15, color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }))
  scene.add(foam)

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 5, maxDistance: 40, autoRotateSpeed: 0.2, enablePan: true })

  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    // Animate ocean waves
    for (let i = 0; i < oceanPosArray.length; i += 3) {
      const x = oceanPosArray[i], z = oceanPosArray[i+2]
      const wave1 = Math.sin(x * 0.3 + t * 1.2) * 0.3
      const wave2 = Math.sin(z * 0.2 + t * 0.8) * 0.2
      const wave3 = Math.sin((x + z) * 0.15 + t * 0.6) * 0.15
      const wave4 = Math.sin(x * 0.5 + z * 0.3 + t * 2.0) * 0.08
      oceanPosArray[i+1] = originalY[i+1] + wave1 + wave2 + wave3 + wave4
    }
    oceanGeo.attributes.position.needsUpdate = true
    oceanGeo.computeVertexNormals()

    // Animate foam
    const fPos = foamGeo.attributes.position.array
    for (let i = 0; i < foamCount; i++) {
      fPos[i*3+1] = 0.05 + Math.sin(t * 1.5 + fPos[i*3] * 0.2) * 0.15
    }
    foamGeo.attributes.position.needsUpdate = true

    // Pulse water glow
    waterGlow.intensity = 0.6 + Math.sin(t * 0.5) * 0.3
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Terrain Scene ── */
function createTerrainScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87CEEB)
  scene.fog = new THREE.FogExp2(0x87CEEB, 0.008)
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 500)
  camera.position.set(0, 15, 30)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.25, radius: 0.5, threshold: 0.9 })

  // HDRI environment
  loadHDRI('/3d-textures/forest_nature_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Procedural terrain heightmap
  const size = 128
  const terrainGeo = new THREE.PlaneGeometry(120, 120, size-1, size-1)
  terrainGeo.rotateX(-Math.PI / 2)
  const posArr = terrainGeo.attributes.position.array

  // Simple noise function
  function noise2D(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
    return n - Math.floor(n)
  }
  function smoothNoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y)
    const fx = x - ix, fy = y - iy
    const a = noise2D(ix, iy), b = noise2D(ix+1, iy), c = noise2D(ix, iy+1), d = noise2D(ix+1, iy+1)
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
    return a + (b-a)*ux + (c-a)*uy + (a-b-c+d)*ux*uy
  }
  function fbm(x, y) {
    let val = 0, amp = 1, freq = 1, max = 0
    for (let i = 0; i < 6; i++) {
      val += smoothNoise(x * freq, y * freq) * amp
      max += amp; amp *= 0.5; freq *= 2.0
    }
    return val / max
  }

  // Color based on height
  const colors = new Float32Array((size) * (size) * 3)
  for (let i = 0; i < size * size; i++) {
    const x = posArr[i*3], z = posArr[i*3+2]
    const nx = x / 120 + 0.5, nz = z / 120 + 0.5
    const h = fbm(nx * 4 + 1.5, nz * 4 + 0.7)
    const height = h * 20 - 2
    posArr[i*3+1] = height

    // Vertex colors
    let r, g, b
    if (height < -0.5) { r = 0.2; g = 0.35; b = 0.55 } // water
    else if (height < 1) { r = 0.65; g = 0.6; b = 0.4 } // sand
    else if (height < 5) { r = 0.2; g = 0.5; b = 0.15 } // grass
    else if (height < 9) { r = 0.15; g = 0.35; b = 0.1 } // dark grass
    else if (height < 13) { r = 0.4; g = 0.35; b = 0.3 } // rock
    else { r = 0.9; g = 0.9; b = 0.95 } // snow
    // Add some variation
    const variation = (Math.random() - 0.5) * 0.08
    colors[i*3] = Math.max(0, Math.min(1, r + variation))
    colors[i*3+1] = Math.max(0, Math.min(1, g + variation))
    colors[i*3+2] = Math.max(0, Math.min(1, b + variation))
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  terrainGeo.attributes.position.needsUpdate = true
  terrainGeo.computeVertexNormals()

  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 })
  const terrain = new THREE.Mesh(terrainGeo, terrainMat)
  scene.add(terrain)

  // Water plane
  const waterGeo = new THREE.PlaneGeometry(120, 120, 1, 1)
  waterGeo.rotateX(-Math.PI / 2)
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2255aa, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.5 })
  const water = new THREE.Mesh(waterGeo, waterMat)
  water.position.y = -0.5
  scene.add(water)

  // Trees (simple cones on green areas)
  for (let i = 0; i < 200; i++) {
    const tx = (Math.random()-0.5) * 100
    const tz = (Math.random()-0.5) * 100
    const nx = tx / 120 + 0.5, nz = tz / 120 + 0.5
    const h = fbm(nx * 4 + 1.5, nz * 4 + 0.7) * 20 - 2
    if (h > 1 && h < 9) {
      const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.6, 5)
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x553311, roughness: 0.9 })
      const trunk = new THREE.Mesh(trunkGeo, trunkMat)
      trunk.position.set(tx, h + 0.3, tz)
      scene.add(trunk)
      const leavesGeo = new THREE.ConeGeometry(0.5 + Math.random()*0.3, 1.2 + Math.random()*0.6, 6)
      const shade = 0.15 + Math.random() * 0.2
      const leavesMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(shade*0.5, shade + 0.2, shade*0.3), roughness: 0.8 })
      const leaves = new THREE.Mesh(leavesGeo, leavesMat)
      leaves.position.set(tx, h + 1.0, tz)
      scene.add(leaves)
    }
  }

  // Clouds
  for (let i = 0; i < 20; i++) {
    const cloudGeo = new THREE.SphereGeometry(2 + Math.random()*3, 8, 6)
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false })
    const cloud = new THREE.Mesh(cloudGeo, cloudMat)
    cloud.position.set((Math.random()-0.5)*80, 18 + Math.random()*8, (Math.random()-0.5)*80)
    cloud.scale.set(1, 0.4, 0.6)
    cloud.userData = { speed: 0.2 + Math.random() * 0.3 }
    scene.add(cloud)
  }

  // Sky dome color gradient
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 1; skyCanvas.height = 256
  const skyCtx = skyCanvas.getContext('2d')
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256)
  skyGrad.addColorStop(0, '#1a3a6a')
  skyGrad.addColorStop(0.4, '#4488bb')
  skyGrad.addColorStop(0.7, '#88bbdd')
  skyGrad.addColorStop(1, '#aaddff')
  skyCtx.fillStyle = skyGrad; skyCtx.fillRect(0, 0, 1, 256)
  const skyTex = new THREE.CanvasTexture(skyCanvas); skyTex.encoding = THREE.sRGBEncoding

  // Lights
  const sunLight = new THREE.DirectionalLight(0xffffee, 1.5); sunLight.position.set(20, 30, 10); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x6688aa, 0.4))
  const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x3a5a2a, 0.3); scene.add(hemiLight)

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 5, maxDistance: 80, autoRotateSpeed: 0.2, enablePan: true, maxDistance: 80 })

  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    // Move clouds
    scene.children.forEach(child => {
      if (child.userData && child.userData.speed) {
        child.position.x += child.userData.speed * 0.02
        if (child.position.x > 50) child.position.x = -50
      }
    })
    // Gentle water movement
    water.position.y = -0.5 + Math.sin(t * 0.5) * 0.05
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Cube Scene ── */
function createCubeScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x050505)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100); camera.position.set(8, 6, 10)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 1.1
  renderer.physicallyCorrectLights = true
  let disposed = false
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.2, radius: 0.5, threshold: 0.9 })

  // HDRI environment
  loadHDRI('/3d-textures/studio_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  const matBlack = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.05 })
  const colors = {
    white: new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.25, metalness: 0.0, emissive: 0x222222, emissiveIntensity: 0.05 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xffd500, roughness: 0.25, metalness: 0.0, emissive: 0x332200, emissiveIntensity: 0.05 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x0051ba, roughness: 0.25, metalness: 0.0, emissive: 0x001133, emissiveIntensity: 0.05 }),
    green: new THREE.MeshStandardMaterial({ color: 0x009e60, roughness: 0.25, metalness: 0.0, emissive: 0x002211, emissiveIntensity: 0.05 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc41e3a, roughness: 0.25, metalness: 0.0, emissive: 0x330000, emissiveIntensity: 0.05 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xff5800, roughness: 0.25, metalness: 0.0, emissive: 0x331100, emissiveIntensity: 0.05 })
  }
  const allCubies = []
  function createCubie(x, y, z) {
    const materials = []; const stickerFaces = []
    if(x===1){materials.push(colors.red);stickerFaces.push(0)}else{materials.push(matBlack)}
    if(x===-1){materials.push(colors.orange);stickerFaces.push(1)}else{materials.push(matBlack)}
    if(y===1){materials.push(colors.white);stickerFaces.push(2)}else{materials.push(matBlack)}
    if(y===-1){materials.push(colors.yellow);stickerFaces.push(3)}else{materials.push(matBlack)}
    if(z===1){materials.push(colors.blue);stickerFaces.push(4)}else{materials.push(matBlack)}
    if(z===-1){materials.push(colors.green);stickerFaces.push(5)}else{materials.push(matBlack)}
    const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96)
    const mesh = new THREE.Mesh(geo, materials); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true
    mesh.userData = { stickerFaces, x, y, z }; scene.add(mesh); allCubies.push(mesh)
  }
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) createCubie(x, y, z)

  const ambient = new THREE.AmbientLight(0x222222, 0.6); scene.add(ambient)
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2); keyLight.position.set(5, 8, 6); keyLight.castShadow = true; keyLight.shadow.mapSize.width = 1024; keyLight.shadow.mapSize.height = 1024; keyLight.shadow.bias = -0.001; scene.add(keyLight)
  const fillLight = new THREE.DirectionalLight(0x8888cc, 0.4); fillLight.position.set(-4, 2, -3); scene.add(fillLight)
  const rimLight = new THREE.DirectionalLight(0xffaa77, 0.3); rimLight.position.set(-3, -2, 5); scene.add(rimLight)
  const groundGeo = new THREE.PlaneGeometry(30, 30); const groundMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 })
  const ground = new THREE.Mesh(groundGeo, groundMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -3; ground.receiveShadow = true; scene.add(ground)

  let camAzimuth = 0.6, camPolar = 0.9, camRadius = 13, targetAzimuth = 0.6, targetPolar = 0.9
  function updateCamera() { camAzimuth += (targetAzimuth - camAzimuth) * 0.05; camPolar += (targetPolar - camPolar) * 0.05; camera.position.x = camRadius * Math.sin(camPolar) * Math.sin(camAzimuth); camera.position.y = camRadius * Math.cos(camPolar); camera.position.z = camRadius * Math.sin(camPolar) * Math.cos(camAzimuth); camera.lookAt(0, 0, 0) }

  const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2()
  let isOrbiting = false, orbitStartX = 0, orbitStartY = 0, pendingClick = null, rotationAnim = null, autoRotate = true, autoRotateTimer = null

  function onPointerDown(e) {
    e.preventDefault(); const px = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX); const py = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY)
    if (px === undefined) return
    mouse.x = (px / container.clientWidth) * 2 - 1; mouse.y = -(py / container.clientHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera); const intersects = raycaster.intersectObjects(allCubies)
    if (intersects.length > 0 && !rotationAnim) {
      const faceIndex = Math.floor(intersects[0].faceIndex / 2); const cubie = intersects[0].object
      if (cubie.userData.stickerFaces.indexOf(faceIndex) !== -1) { pendingClick = { intersect: intersects[0], x: px, y: py, faceIndex }; }
      else { isOrbiting = true; orbitStartX = px; orbitStartY = py; pendingClick = null }
    } else { isOrbiting = true; orbitStartX = px; orbitStartY = py; pendingClick = null }
    autoRotate = false; clearTimeout(autoRotateTimer)
  }
  function onPointerMove(e) {
    e.preventDefault(); const px = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX); const py = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY)
    if (px === undefined) return
    if (isOrbiting) { targetAzimuth -= (px - orbitStartX) * 0.004; targetPolar = Math.max(0.2, Math.min(Math.PI - 0.2, targetPolar - (py - orbitStartY) * 0.004)); orbitStartX = px; orbitStartY = py }
    else if (pendingClick) { if (Math.abs(px - pendingClick.x) > 6 || Math.abs(py - pendingClick.y) > 6) { pendingClick = null; isOrbiting = true; orbitStartX = px; orbitStartY = py } }
  }
  function onPointerUp() {
    if (pendingClick && !isOrbiting) executeRotation(pendingClick.intersect, pendingClick.faceIndex)
    pendingClick = null; isOrbiting = false; autoRotateTimer = setTimeout(() => { autoRotate = true }, 4000)
  }

  function executeRotation(intersect, faceIndex) {
    if (rotationAnim) return
    const pos = intersect.object.position; let axis, layerCoord, angle
    switch (faceIndex) { case 0: axis='x';layerCoord=pos.x;angle=-Math.PI/2;break; case 1: axis='x';layerCoord=pos.x;angle=Math.PI/2;break; case 2: axis='y';layerCoord=pos.y;angle=-Math.PI/2;break; case 3: axis='y';layerCoord=pos.y;angle=Math.PI/2;break; case 4: axis='z';layerCoord=pos.z;angle=-Math.PI/2;break; case 5: axis='z';layerCoord=pos.z;angle=Math.PI/2;break; }
    layerCoord = Math.round(layerCoord)
    const layerCubies = allCubies.filter(c => Math.round(c.position[axis]) === layerCoord); if (layerCubies.length === 0) return
    const pivot = new THREE.Group(); scene.add(pivot); layerCubies.forEach(c => pivot.attach(c))
    const startTime = performance.now(), startRot = pivot.rotation[axis], targetRot = startRot + angle
    rotationAnim = { pivot, axis, startTime, duration: 280, startRot, targetRot, onComplete: () => { pivot.rotation[axis] = targetRot; while (pivot.children.length > 0) scene.attach(pivot.children[0]); scene.remove(pivot); rotationAnim = null } }
  }

  window.__cubeScramble = () => {
    if (rotationAnim) return
    const axes = ['x', 'y', 'z'], layers = [-1, 0, 1], angles = [Math.PI / 2, -Math.PI / 2]
    let moves = 0
    function doMove() {
      if (moves >= 15 || rotationAnim) return
      const axis = axes[Math.floor(Math.random() * 3)], layer = layers[Math.floor(Math.random() * 3)], angle = angles[Math.floor(Math.random() * 2)]
      const layerCubies = allCubies.filter(c => Math.round(c.position[axis]) === layer)
      const pivot = new THREE.Group(); scene.add(pivot); layerCubies.forEach(c => pivot.attach(c))
      const startTime = performance.now(), startRot = pivot.rotation[axis], targetRot = startRot + angle
      rotationAnim = { pivot, axis, startTime, duration: 180, startRot, targetRot, onComplete: () => { pivot.rotation[axis] = targetRot; while (pivot.children.length > 0) scene.attach(pivot.children[0]); scene.remove(pivot); rotationAnim = null; moves++; if (moves < 15) setTimeout(doMove, 50) } }
    }
    doMove()
  }
  window.__cubeReset = () => {
    if (rotationAnim) return
    allCubies.forEach(c => { scene.remove(c); c.geometry.dispose() }); allCubies.length = 0
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) createCubie(x, y, z)
    targetAzimuth = 0.6; targetPolar = 0.9; camRadius = 13
  }

  renderer.domElement.addEventListener('mousedown', onPointerDown)
  renderer.domElement.addEventListener('mousemove', onPointerMove)
  renderer.domElement.addEventListener('mouseup', onPointerUp)
  renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: false })
  renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: false })
  renderer.domElement.addEventListener('touchend', onPointerUp)

  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const now = performance.now()
    if (rotationAnim) { const elapsed = now - rotationAnim.startTime; let t = Math.min(elapsed / rotationAnim.duration, 1); t = 1 - Math.pow(1 - t, 3); rotationAnim.pivot.rotation[rotationAnim.axis] = rotationAnim.startRot + (rotationAnim.targetRot - rotationAnim.startRot) * t; if (elapsed >= rotationAnim.duration) rotationAnim.onComplete() }
    if (autoRotate && !rotationAnim) targetAzimuth += 0.002
    updateCamera(); if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls); delete window.__cubeScramble; delete window.__cubeReset }
}

/* ── House Scene ── */
function createHouseScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a2a3a)
  scene.fog = new THREE.FogExp2(0x1a2a3a, 0.015)
  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 200)
  camera.position.set(14, 10, 18)
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true, failIfMajorPerformanceCaveat: false })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.outputEncoding = THREE.sRGBEncoding
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.physicallyCorrectLights = true
  let disposed = false
  container.appendChild(renderer.domElement)

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.3, radius: 0.5, threshold: 0.85 })

  // HDRI environment
  loadHDRI('/3d-textures/studio_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // ── Materials ──
  const wallExt = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.85, metalness: 0.0 })
  const wallInt = new THREE.MeshStandardMaterial({ color: 0xfff8ee, roughness: 0.9, metalness: 0.0 })
  const floorWood = new THREE.MeshStandardMaterial({ color: 0x8B6D3F, roughness: 0.6, metalness: 0.05 })
  const floorTile = new THREE.MeshStandardMaterial({ color: 0xd0ccc4, roughness: 0.4, metalness: 0.1 })
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.7, metalness: 0.3 })
  // Glass: use simple transparent material (MeshPhysicalMaterial with transmission causes flickering)
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.7, metalness: 0.05 })
  const woodLight = new THREE.MeshStandardMaterial({ color: 0xa08050, roughness: 0.6, metalness: 0.05 })
  const fabricRed = new THREE.MeshStandardMaterial({ color: 0xaa3322, roughness: 0.9, metalness: 0.0 })
  const fabricBlue = new THREE.MeshStandardMaterial({ color: 0x2244aa, roughness: 0.9, metalness: 0.0 })
  const fabricWhite = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9, metalness: 0.0 })
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.8 })
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x888880, roughness: 0.9, metalness: 0.0 })
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x3a7a2a, roughness: 0.9, metalness: 0.0 })
  const kitchenMat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.4, metalness: 0.1 })
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.2, metalness: 0.3 })
  const bedSheet = new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.9, metalness: 0.0 })
  const pillowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 })
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.7, metalness: 0.05 })
  const stoveMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.6 })

  // ── Ground ──
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), grassMat)
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground)

  // Path to front door
  const pathGeo = new THREE.PlaneGeometry(2, 8)
  const pathMesh = new THREE.Mesh(pathGeo, concreteMat)
  pathMesh.rotation.x = -Math.PI / 2; pathMesh.position.set(0, 0.01, 10); scene.add(pathMesh)

  // ── House Shell ──
  const houseW = 12, houseD = 10, wallH = 3.2

  // Floor
  const floorGeo = new THREE.BoxGeometry(houseW, 0.15, houseD)
  const houseFloor = new THREE.Mesh(floorGeo, floorWood)
  houseFloor.position.set(0, 0.075, 0); houseFloor.receiveShadow = true; scene.add(houseFloor)

  // Walls - Exterior (with cutouts for windows/doors done via separate wall segments)
  function addWall(x, y, z, w, h, d, mat) {
    const geo = new THREE.BoxGeometry(w, h, d)
    const mesh = new THREE.Mesh(geo, mat || wallExt)
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh)
    return mesh
  }

  // Front wall (z = +5) with door opening and windows
  addWall(-4.5, wallH/2, houseD/2, 3, wallH, 0.25, wallExt)  // left of door
  addWall(4.5, wallH/2, houseD/2, 3, wallH, 0.25, wallExt)   // right of door
  addWall(0, wallH/2+1.0, houseD/2, 3, wallH-2.0, 0.25, wallExt) // above door
  addWall(-4.5, wallH/2+0.8, houseD/2, 3, wallH*0.5, 0.25, wallExt) // above left window
  addWall(4.5, wallH/2+0.8, houseD/2, 3, wallH*0.5, 0.25, wallExt) // above right window

  // Front windows (glass offset slightly to avoid z-fighting with wall)
  addWall(-4.5, 1.2, houseD/2 + 0.14, 2.4, 1.6, 0.05, glassMat) // left window
  addWall(4.5, 1.2, houseD/2 + 0.14, 2.4, 1.6, 0.05, glassMat)  // right window

  // Back wall (z = -5)
  addWall(0, wallH/2, -houseD/2, houseW, wallH, 0.25, wallExt)
  // Back windows
  addWall(-3, 1.5, -houseD/2 - 0.14, 2, 1.4, 0.05, glassMat)
  addWall(3, 1.5, -houseD/2 - 0.14, 2, 1.4, 0.05, glassMat)

  // Left wall (x = -6)
  addWall(-houseW/2, wallH/2, 0, 0.25, wallH, houseD, wallExt)
  addWall(-houseW/2 - 0.14, 1.5, 2, 0.05, 1.4, 1.5, glassMat) // left window

  // Right wall (x = +6)
  addWall(houseW/2, wallH/2, 0, 0.25, wallH, houseD, wallExt)
  addWall(houseW/2 + 0.14, 1.5, -2, 0.05, 1.4, 1.5, glassMat) // right window

  // Interior dividing wall (living room vs bedroom)
  addWall(0, wallH/2, 0, 0.15, wallH, 5.5, wallInt) // partial wall, with opening
  addWall(0, wallH/2+0.8, 0, 0.15, wallH*0.5, 4.5, wallInt) // above opening

  // Kitchen/bathroom dividing wall
  addWall(-3, wallH/2, -3, 0.15, wallH, 4, wallInt)

  // ── Roof ──
  const roofGeo = new THREE.BoxGeometry(houseW + 1, 0.2, houseD + 1)
  const roof = new THREE.Mesh(roofGeo, roofMat)
  roof.position.set(0, wallH + 0.1, 0); roof.castShadow = true; scene.add(roof)

  // Roof slope accents (simple flat roof with slight overhang already done above)
  // Add a second thinner roof layer
  const roof2 = new THREE.Mesh(new THREE.BoxGeometry(houseW + 1.5, 0.1, houseD + 1.5), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.4 }))
  roof2.position.set(0, wallH + 0.25, 0); scene.add(roof2)

  // ── Front Door ──
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.1), doorMat)
  door.position.set(0, 1.1, houseD/2 + 0.08); scene.add(door)
  const doorHandle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), metalMat)
  doorHandle.position.set(0.4, 1.1, houseD/2 + 0.15); scene.add(doorHandle)

  // ── LIVING ROOM (front right, x>0, z>0) ──
  // Sofa
  function addSofa(x, z, rotY, mat) {
    const sofaGroup = new THREE.Group()
    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, 1.0), mat)
    seat.position.y = 0.4; seat.castShadow = true; sofaGroup.add(seat)
    // Back
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.8, 0.2), mat)
    back.position.set(0, 0.8, -0.4); back.castShadow = true; sofaGroup.add(back)
    // Arms
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 1.0), mat)
    armL.position.set(-1.3, 0.65, 0); armL.castShadow = true; sofaGroup.add(armL)
    const armR = armL.clone(); armR.position.x = 1.3; sofaGroup.add(armR)
    // Cushions
    const cushion1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.7), fabricWhite)
    cushion1.position.set(-0.5, 0.65, 0.05); sofaGroup.add(cushion1)
    const cushion2 = cushion1.clone(); cushion2.position.x = 0.5; sofaGroup.add(cushion2)
    sofaGroup.position.set(x, 0, z)
    sofaGroup.rotation.y = rotY
    scene.add(sofaGroup)
  }
  addSofa(3.5, 3.5, 0, fabricRed)

  // Coffee table
  const ctGroup = new THREE.Group()
  const ctTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.7), woodDark)
  ctTop.position.y = 0.4; ctTop.castShadow = true; ctGroup.add(ctTop)
  const ctLeg = (x, z) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.37, 0.05), metalMat); l.position.set(x, 0.185, z); return l }
  ctGroup.add(ctLeg(-0.6, -0.25)); ctGroup.add(ctLeg(0.6, -0.25)); ctGroup.add(ctLeg(-0.6, 0.25)); ctGroup.add(ctLeg(0.6, 0.25))
  ctGroup.position.set(3.5, 0, 1.8); scene.add(ctGroup)

  // TV stand + TV
  const tvStand = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.4), woodDark)
  tvStand.position.set(3.5, 0.25, 0.2); tvStand.castShadow = true; scene.add(tvStand)
  const tv = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.06), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 }))
  tv.position.set(3.5, 1.0, 0.2); scene.add(tv)
  const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.01), new THREE.MeshBasicMaterial({ color: 0x112244 }))
  tvScreen.position.set(3.5, 1.0, 0.24); scene.add(tvScreen)

  // Rug
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.5), new THREE.MeshStandardMaterial({ color: 0x885533, roughness: 0.95 }))
  rug.rotation.x = -Math.PI/2; rug.position.set(3.5, 0.16 + 0.005, 2.5); scene.add(rug)

  // ── DINING AREA (front left, x<0, z>0) ──
  // Dining table
  const dtGroup = new THREE.Group()
  const dtTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.2), woodLight)
  dtTop.position.y = 0.75; dtTop.castShadow = true; dtGroup.add(dtTop)
  const dtLeg = (x, z) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.71, 0.06), woodDark); l.position.set(x, 0.355, z); return l }
  dtGroup.add(dtLeg(-0.9, -0.45)); dtGroup.add(dtLeg(0.9, -0.45)); dtGroup.add(dtLeg(-0.9, 0.45)); dtGroup.add(dtLeg(0.9, 0.45))
  dtGroup.position.set(-3, 0, 3); scene.add(dtGroup)

  // Chairs (4)
  function addChair(x, z, rotY) {
    const ch = new THREE.Group()
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.45), woodLight)
    seat.position.y = 0.45; ch.add(seat)
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.04), woodLight)
    back.position.set(0, 0.7, -0.2); ch.add(back)
    const leg = (lx, lz) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), woodDark); l.position.set(lx, 0.21, lz); return l }
    ch.add(leg(-0.17, -0.17)); ch.add(leg(0.17, -0.17)); ch.add(leg(-0.17, 0.17)); ch.add(leg(0.17, 0.17))
    ch.position.set(x, 0, z); ch.rotation.y = rotY; scene.add(ch)
  }
  addChair(-3.7, 3, Math.PI/2); addChair(-2.3, 3, -Math.PI/2); addChair(-3, 3.8, 0); addChair(-3, 2.2, Math.PI)

  // ── KITCHEN (back left, x<-3, z<0) ──
  // Kitchen floor (tile)
  const kitchenFloor = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 4.7), floorTile)
  kitchenFloor.rotation.x = -Math.PI/2; kitchenFloor.position.set(-3, 0.16 + 0.005, -2.6); scene.add(kitchenFloor)

  // Counter along left wall
  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 4), counterMat)
  counter.position.set(-5.4, 0.6, -2.5); counter.castShadow = true; scene.add(counter)

  // Counter top
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 4.05), new THREE.MeshStandardMaterial({ color: 0xe0dcd4, roughness: 0.3, metalness: 0.1 }))
  counterTop.position.set(-5.4, 1.07, -2.5); scene.add(counterTop)

  // Stove
  const stove = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.6), stoveMat)
  stove.position.set(-5.4, 1.1, -1.5); scene.add(stove)
  // Burners
  for (let dx of [-0.12, 0.12]) for (let dz of [-0.12, 0.12]) {
    const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 12), new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 }))
    burner.position.set(-5.4+dx, 1.13, -1.5+dz); scene.add(burner)
  }

  // Sink
  const sink = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.5), metalMat)
  sink.position.set(-5.4, 1.1, -3); scene.add(sink)

  // Fridge
  const fridge = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.6), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.3, metalness: 0.4 }))
  fridge.position.set(-5.2, 1.0, -4.2); fridge.castShadow = true; scene.add(fridge)

  // ── BEDROOM (back right, x>0, z<0) ──
  // Bed
  const bedGroup = new THREE.Group()
  const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 2.8), woodDark)
  bedFrame.position.y = 0.25; bedFrame.castShadow = true; bedGroup.add(bedFrame)
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 2.6), bedSheet)
  mattress.position.y = 0.5; bedGroup.add(mattress)
  // Pillows
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.35), pillowMat)
  p1.position.set(-0.5, 0.65, -1.0); bedGroup.add(p1)
  const p2 = p1.clone(); p2.position.x = 0.5; bedGroup.add(p2)
  // Blanket
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.6), fabricBlue)
  blanket.position.set(0, 0.62, 0.3); bedGroup.add(blanket)
  // Headboard
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.1), woodDark)
  headboard.position.set(0, 0.7, -1.35); bedGroup.add(headboard)
  bedGroup.position.set(4, 0, -3); scene.add(bedGroup)

  // Nightstand
  const ns = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), woodLight)
  ns.position.set(1.8, 0.4, -3); ns.castShadow = true; scene.add(ns)
  // Lamp on nightstand
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.1, 8), metalMat)
  lampBase.position.set(1.8, 0.7, -3); scene.add(lampBase)
  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.25, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff8e0, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }))
  lampShade.position.set(1.8, 0.95, -3); scene.add(lampShade)

  // Wardrobe
  const wardrobe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.6), woodDark)
  wardrobe.position.set(4.5, 1.1, -0.5); wardrobe.castShadow = true; scene.add(wardrobe)
  const wardDoor1 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 2.1, 0.03), doorMat)
  wardDoor1.position.set(4.14, 1.1, -0.18); scene.add(wardDoor1)
  const wardDoor2 = wardDoor1.clone(); wardDoor2.position.x = 4.86; scene.add(wardDoor2)

  // ── BATHROOM (back left corner, x<-3, z<-3) ──
  const bathFloor = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshStandardMaterial({ color: 0xc8c0b8, roughness: 0.3, metalness: 0.1 }))
  bathFloor.rotation.x = -Math.PI/2; bathFloor.position.set(-4.6, 0.16 + 0.01, -4.6); scene.add(bathFloor)

  // Bathtub
  const tub = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.2, metalness: 0.1 }))
  tub.position.set(-4.6, 0.35, -4.6); tub.castShadow = true; scene.add(tub)

  // Toilet
  const toilet = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.3, metalness: 0.1 }))
  toilet.position.set(-3.4, 0.3, -5.2); scene.add(toilet)
  const toiletTank = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.15), new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.3, metalness: 0.1 }))
  toiletTank.position.set(-3.4, 0.5, -5.4); scene.add(toiletTank)

  // ── Outdoor Details ──
  // Fence
  for (let i = -15; i <= 15; i += 1.5) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), woodLight)
    post.position.set(i, 0.4, 12); post.castShadow = true; scene.add(post)
    const post2 = post.clone(); post2.position.z = -12; scene.add(post2)
  }
  // Horizontal rails
  const rail1 = new THREE.Mesh(new THREE.BoxGeometry(30, 0.05, 0.05), woodLight)
  rail1.position.set(0, 0.6, 12); scene.add(rail1)
  const rail2 = rail1.clone(); rail2.position.y = 0.3; scene.add(rail2)
  const rail3 = rail1.clone(); rail3.position.z = -12; scene.add(rail3)
  const rail4 = rail1.clone(); rail4.position.set(0, 0.3, -12); scene.add(rail4)

  // Trees
  function addTree(x, z, scale) {
    const s = scale || 1
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15*s, 0.2*s, 1.5*s, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 }))
    trunk.position.set(x, 0.75*s, z); trunk.castShadow = true; scene.add(trunk)
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.8*s, 8, 6), new THREE.MeshStandardMaterial({ color: 0x2a6a1a, roughness: 0.9 }))
    leaves.position.set(x, 2.0*s, z); leaves.castShadow = true; scene.add(leaves)
    const leaves2 = new THREE.Mesh(new THREE.SphereGeometry(0.6*s, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3a8a2a, roughness: 0.9 }))
    leaves2.position.set(x+0.3*s, 2.4*s, z+0.2*s); scene.add(leaves2)
  }
  addTree(-9, 8, 1.2); addTree(9, 8, 1.0); addTree(-9, -8, 0.9); addTree(9, -8, 1.1)
  addTree(-12, 3, 0.8); addTree(12, -3, 0.7)

  // ── Lighting ──
  // Sun
  const sunLight = new THREE.DirectionalLight(0xfff5dd, 1.8)
  sunLight.position.set(8, 15, 10); sunLight.castShadow = true
  sunLight.shadow.mapSize.width = 1024; sunLight.shadow.mapSize.height = 1024
  sunLight.shadow.camera.left = -15; sunLight.shadow.camera.right = 15
  sunLight.shadow.camera.top = 15; sunLight.shadow.camera.bottom = -15
  sunLight.shadow.bias = -0.002
  sunLight.shadow.normalBias = 0.02
  scene.add(sunLight)

  scene.add(new THREE.AmbientLight(0x334466, 0.4))
  const hemiLight = new THREE.HemisphereLight(0x88aacc, 0x445522, 0.3); scene.add(hemiLight)

  // Interior lights (warm)
  const livingLight = new THREE.PointLight(0xffeecc, 0.8, 8); livingLight.position.set(3.5, 2.8, 2.5); scene.add(livingLight)
  const diningLight = new THREE.PointLight(0xffeecc, 0.6, 6); diningLight.position.set(-3, 2.8, 3); scene.add(diningLight)
  const kitchenLight = new THREE.PointLight(0xffffff, 0.5, 5); kitchenLight.position.set(-4, 2.8, -2.5); scene.add(kitchenLight)
  const bedLight = new THREE.PointLight(0xffeedd, 0.4, 5); bedLight.position.set(4, 2.8, -3); scene.add(bedLight)
  // Lamp glow
  const lampLight = new THREE.PointLight(0xffdd88, 0.3, 3); lampLight.position.set(1.8, 1.0, -3); scene.add(lampLight)

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 5, maxDistance: 40, autoRotateSpeed: 0.3, enablePan: true, maxDistance: 40 })

  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    // Subtle lamp flicker
    lampLight.intensity = 0.25 + Math.sin(t * 3) * 0.05
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Museum Scene ── */
function createMuseumScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0a0f)
  scene.fog = new THREE.FogExp2(0x0a0a0f, 0.012)
  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 200)
  camera.position.set(0, 4, 16)
  const renderer = createRenderer(container)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMappingExposure = 0.9
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.3, radius: 0.5, threshold: 0.85 })

  // HDRI environment
  loadHDRI('/3d-textures/studio_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // ── Materials ──
  const marbleWhite = new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.3, metalness: 0.05 })
  const marbleFloor = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.2, metalness: 0.1 })
  const marbleDark = new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.4, metalness: 0.1 })
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a840, roughness: 0.3, metalness: 0.9 })
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x8B6D3F, roughness: 0.4, metalness: 0.8 })
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 0.8, metalness: 0.0 })
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x1a1510, roughness: 0.9, metalness: 0.0 })
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.6, metalness: 0.05 })
  const velvetRed = new THREE.MeshStandardMaterial({ color: 0x6a1a1a, roughness: 0.9, metalness: 0.0 })
  const glassCase = new THREE.MeshPhysicalMaterial({ color: 0xaaccee, roughness: 0.05, metalness: 0.0, transmission: 0.85, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a7030, roughness: 0.4, metalness: 0.6 })
  const pedMat = new THREE.MeshStandardMaterial({ color: 0xd0c8b8, roughness: 0.35, metalness: 0.05 })

  const hallW = 30, hallD = 40, hallH = 10

  // ── Floor ──
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(hallW, hallD), marbleFloor)
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)

  // Floor tile pattern (dark inlay lines)
  for (let i = -14; i <= 14; i += 2) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, hallD), marbleDark)
    line.position.set(i, 0.003, 0); scene.add(line)
  }
  for (let j = -19; j <= 19; j += 2) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(hallW, 0.005, 0.03), marbleDark)
    line.position.set(0, 0.003, j); scene.add(line)
  }

  // ── Walls ──
  // Back wall
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(hallW, hallH, 0.3), wallMat)
  backWall.position.set(0, hallH/2, -hallD/2); backWall.receiveShadow = true; scene.add(backWall)

  // Side walls
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, hallH, hallD), wallMat)
  leftWall.position.set(-hallW/2, hallH/2, 0); leftWall.receiveShadow = true; scene.add(leftWall)
  const rightWall = leftWall.clone(); rightWall.position.x = hallW/2; scene.add(rightWall)

  // Front wall (with opening)
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(hallW/2 - 3, hallH, 0.3), wallMat)
  frontL.position.set(-hallW/4 - 1.5, hallH/2, hallD/2); scene.add(frontL)
  const frontR = frontL.clone(); frontR.position.x = hallW/4 + 1.5; scene.add(frontR)
  const frontTop = new THREE.Mesh(new THREE.BoxGeometry(6, hallH - 5, 0.3), wallMat)
  frontTop.position.set(0, hallH - (hallH-5)/2, hallD/2); scene.add(frontTop)

  // ── Ceiling ──
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(hallW, hallD), ceilingMat)
  ceiling.rotation.x = Math.PI / 2; ceiling.position.y = hallH; scene.add(ceiling)

  // Ceiling medallion (decorative circle)
  const medal = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.1, 32), goldMat)
  medal.position.set(0, hallH - 0.05, 0); scene.add(medal)
  const medal2 = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.12, 32), marbleWhite)
  medal2.position.set(0, hallH - 0.06, 0); scene.add(medal2)

  // ── Columns ──
  function addColumn(x, z) {
    const colGroup = new THREE.Group()
    // Base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.4, 16), marbleWhite)
    base.position.y = 0.2; base.castShadow = true; colGroup.add(base)
    // Shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, hallH - 1.2, 16), marbleWhite)
    shaft.position.y = hallH/2 - 0.2; shaft.castShadow = true; colGroup.add(shaft)
    // Capital
    const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.45, 0.5, 16), marbleWhite)
    capital.position.y = hallH - 0.65; capital.castShadow = true; colGroup.add(capital)
    // Fluting detail
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.03, 8, 24), marbleWhite)
    ring.rotation.x = Math.PI/2; ring.position.y = 2; colGroup.add(ring)
    const ring2 = ring.clone(); ring2.position.y = hallH - 2; colGroup.add(ring2)

    colGroup.position.set(x, 0, z); scene.add(colGroup)
  }

  // Two rows of columns along the hall
  for (let z = -15; z <= 15; z += 7.5) {
    addColumn(-10, z)
    addColumn(10, z)
  }

  // ── Paintings on walls ──
  function addPainting(x, y, z, w, h, rotY, color) {
    const pGroup = new THREE.Group()
    // Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, h + 0.15, 0.06), frameMat)
    frame.castShadow = true; pGroup.add(frame)
    // Canvas
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }))
    canvas.position.z = 0.03; pGroup.add(canvas)
    // Add texture detail to painting
    const detailCanvas = document.createElement('canvas'); detailCanvas.width = 256; detailCanvas.height = Math.floor(256 * (h/w))
    const dctx = detailCanvas.getContext('2d')
    const c = new THREE.Color(color)
    const r = Math.floor(c.r*255), g = Math.floor(c.g*255), b = Math.floor(c.b*255)
    dctx.fillStyle = `rgb(${r},${g},${b})`; dctx.fillRect(0, 0, 256, detailCanvas.height)
    // Add abstract brush strokes
    for (let i = 0; i < 30; i++) {
      const sx = Math.random()*256, sy = Math.random()*detailCanvas.height, sw = Math.random()*40+10, sh = Math.random()*20+5
      dctx.fillStyle = `rgba(${Math.floor(Math.random()*255)},${Math.floor(Math.random()*255)},${Math.floor(Math.random()*255)},0.3)`
      dctx.fillRect(sx, sy, sw, sh)
    }
    const detailTex = new THREE.CanvasTexture(detailCanvas); detailTex.encoding = THREE.sRGBEncoding
    canvas.material = new THREE.MeshStandardMaterial({ map: detailTex, roughness: 0.6 })
    // Spotlight on painting
    const spot = new THREE.SpotLight(0xfff5dd, 1.5, 5, Math.PI/6, 0.5, 1)
    spot.position.set(0, 2, 1.5); spot.target = canvas; pGroup.add(spot)

    pGroup.position.set(x, y, z); pGroup.rotation.y = rotY; scene.add(pGroup)
  }

  // Back wall paintings
  addPainting(-8, 5.5, -hallD/2+0.3, 3, 2, 0, 0x884422)
  addPainting(0, 6, -hallD/2+0.3, 4, 3, 0, 0x224488)
  addPainting(8, 5.5, -hallD/2+0.3, 3, 2, 0, 0x448822)

  // Side wall paintings
  addPainting(-hallW/2+0.3, 5.5, -10, 2.5, 2, Math.PI/2, 0x882244)
  addPainting(-hallW/2+0.3, 5.5, 0, 3, 2.5, Math.PI/2, 0x228888)
  addPainting(-hallW/2+0.3, 5.5, 10, 2.5, 2, Math.PI/2, 0x886622)
  addPainting(hallW/2-0.3, 5.5, -10, 2.5, 2, -Math.PI/2, 0x448844)
  addPainting(hallW/2-0.3, 5.5, 0, 3, 2.5, -Math.PI/2, 0x444488)
  addPainting(hallW/2-0.3, 5.5, 10, 2.5, 2, -Math.PI/2, 0x884444)

  // ── Sculptures on Pedestals ──
  function addPedestal(x, z, sculptureType) {
    const pGroup = new THREE.Group()
    // Pedestal
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), pedMat)
    ped.position.y = 0.6; ped.castShadow = true; pGroup.add(ped)
    // Pedestal top
    const pedTop = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 1.0), new THREE.MeshStandardMaterial({ color: 0xc0b8a8, roughness: 0.2, metalness: 0.1 }))
    pedTop.position.y = 1.24; pGroup.add(pedTop)
    // Base molding
    const molding = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.0), pedMat)
    molding.position.y = 0.05; pGroup.add(molding)

    // Sculpture
    let sculpt
    if (sculptureType === 'sphere') {
      sculpt = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 24), bronzeMat)
      sculpt.position.y = 1.7; sculpt.castShadow = true; pGroup.add(sculpt)
    } else if (sculptureType === 'torso') {
      // Abstract human torso
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.8, 12), marbleWhite)
      body.position.y = 1.7; body.castShadow = true; pGroup.add(body)
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), marbleWhite)
      head.position.y = 2.2; head.castShadow = true; pGroup.add(head)
    } else if (sculptureType === 'abstract') {
      sculpt = new THREE.Mesh(new THREE.TorusKnotGeometry(0.25, 0.08, 64, 8), goldMat)
      sculpt.position.y = 1.7; sculpt.castShadow = true; pGroup.add(sculpt)
    } else if (sculptureType === 'obelisk') {
      sculpt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 0.9, 4), bronzeMat)
      sculpt.position.y = 1.75; sculpt.rotation.y = Math.PI/4; sculpt.castShadow = true; pGroup.add(sculpt)
    }

    // Glass case
    const caseGeo = new THREE.BoxGeometry(0.8, 1.5, 0.8)
    const caseMesh = new THREE.Mesh(caseGeo, glassCase)
    caseMesh.position.y = 2.0; pGroup.add(caseMesh)

    // Spot light from above
    const spot = new THREE.SpotLight(0xfff8e0, 2.0, 8, Math.PI/8, 0.4, 1)
    spot.position.set(0, 5, 0); spot.target = sculpt || pedTop; pGroup.add(spot)

    pGroup.position.set(x, 0, z); scene.add(pGroup)
    return pGroup
  }

  // Sculptures along center
  addPedestal(-5, -12, 'sphere')
  addPedestal(5, -12, 'torso')
  addPedestal(-5, -4, 'abstract')
  addPedestal(5, -4, 'obelisk')
  addPedestal(-5, 4, 'torso')
  addPedestal(5, 4, 'sphere')
  addPedestal(0, -8, 'abstract')
  addPedestal(0, 0, 'torso')

  // ── Benches ──
  function addBench(x, z, rotY) {
    const bGroup = new THREE.Group()
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.5), woodDark)
    seat.position.y = 0.45; seat.castShadow = true; bGroup.add(seat)
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.4), woodDark)
    legL.position.set(-1.1, 0.22, 0); bGroup.add(legL)
    const legR = legL.clone(); legR.position.x = 1.1; bGroup.add(legR)
    bGroup.position.set(x, 0, z); bGroup.rotation.y = rotY; scene.add(bGroup)
  }
  addBench(0, -6, 0)
  addBench(0, 8, 0)
  addBench(-5, 8, 0)
  addBench(5, 8, 0)

  // ── Grand Entrance Steps ──
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(7, 0.2, 1), marbleWhite)
    step.position.set(0, (3-i)*0.2, hallD/2 + 1 + i); step.receiveShadow = true; scene.add(step)
  }

  // ── Decorative Elements ──
  // Crown molding along walls
  for (let z = -hallD/2+0.3; z <= hallD/2-0.3; z += 0.5) {
    const moldL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.4), goldMat)
    moldL.position.set(-hallW/2+0.2, hallH - 0.5, z); scene.add(moldL)
    const moldR = moldL.clone(); moldR.position.x = hallW/2-0.2; scene.add(moldR)
  }

  // ── Lighting ──
  // Dramatic overhead spots
  const mainSpot = new THREE.SpotLight(0xfff5dd, 3, 25, Math.PI/5, 0.3, 1)
  mainSpot.position.set(0, hallH - 0.5, 0); mainSpot.castShadow = true
  mainSpot.shadow.mapSize.width = 1024; mainSpot.shadow.mapSize.height = 1024
  scene.add(mainSpot)

  // Side accent lights
  for (let z = -15; z <= 15; z += 10) {
    const lSpot = new THREE.SpotLight(0xffeecc, 1.5, 12, Math.PI/4, 0.5, 1)
    lSpot.position.set(-hallW/2+2, hallH - 0.5, z); scene.add(lSpot)
    const rSpot = new THREE.SpotLight(0xffeecc, 1.5, 12, Math.PI/4, 0.5, 1)
    rSpot.position.set(hallW/2-2, hallH - 0.5, z); scene.add(rSpot)
  }

  // Ambient fill
  scene.add(new THREE.AmbientLight(0x111118, 0.3))
  const hemiLight = new THREE.HemisphereLight(0x221100, 0x080810, 0.2); scene.add(hemiLight)

  // Entrance light
  const entranceLight = new THREE.PointLight(0xffeedd, 1.0, 15)
  entranceLight.position.set(0, 8, hallD/2 - 1); scene.add(entranceLight)

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 3, maxDistance: 35, autoRotateSpeed: 0.2, enablePan: true, maxDistance: 35 })

  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    // Subtle light flicker for ambiance
    entranceLight.intensity = 0.9 + Math.sin(t * 2) * 0.1
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Mars Scene ── */
function createMarsScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a0805)
  const camera = new THREE.PerspectiveCamera(45, (container.clientWidth || 300) / (container.clientHeight || 300), 0.1, 2000)
  camera.position.set(0, 0, 4.5)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.25, radius: 0.5, threshold: 0.9 })

  // HDRI environment
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Procedural Mars texture
  const marsCanvas = document.createElement('canvas'); marsCanvas.width = 512; marsCanvas.height = 256
  const mctx = marsCanvas.getContext('2d')
  // Base red-orange
  const marsGrad = mctx.createLinearGradient(0, 0, 0, 256)
  marsGrad.addColorStop(0, '#c4613a'); marsGrad.addColorStop(0.3, '#a84530')
  marsGrad.addColorStop(0.5, '#b85535'); marsGrad.addColorStop(0.7, '#9a3a25')
  marsGrad.addColorStop(1, '#c4613a')
  mctx.fillStyle = marsGrad; mctx.fillRect(0, 0, 512, 256)
  // Surface features
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512, y = Math.random() * 256, r = Math.random() * 4 + 0.5
    const v = Math.floor(Math.random() * 50 + 130)
    mctx.beginPath(); mctx.arc(x, y, r, 0, Math.PI * 2)
    mctx.fillStyle = `rgba(${v + 40},${v - 20},${v - 50},0.3)`; mctx.fill()
  }
  // Olympus Mons
  mctx.beginPath(); mctx.arc(200, 80, 40, 0, Math.PI * 2)
  mctx.fillStyle = 'rgba(180,90,50,0.5)'; mctx.fill()
  mctx.beginPath(); mctx.arc(200, 80, 25, 0, Math.PI * 2)
  mctx.fillStyle = 'rgba(160,70,35,0.6)'; mctx.fill()
  // Valles Marineris
  mctx.beginPath(); mctx.moveTo(100, 140); mctx.quadraticCurveTo(250, 125, 400, 145)
  mctx.strokeStyle = 'rgba(80,30,15,0.6)'; mctx.lineWidth = 8; mctx.stroke()
  mctx.strokeStyle = 'rgba(60,20,10,0.4)'; mctx.lineWidth = 14; mctx.stroke()
  // Polar caps
  mctx.fillStyle = 'rgba(230,220,210,0.5)'; mctx.fillRect(0, 0, 512, 20)
  mctx.fillRect(0, 236, 512, 20)

  const marsTex = new THREE.CanvasTexture(marsCanvas); marsTex.encoding = THREE.sRGBEncoding
  // Bump
  const bumpCanvas = document.createElement('canvas'); bumpCanvas.width = 512; bumpCanvas.height = 256
  const bctx = bumpCanvas.getContext('2d')
  bctx.fillStyle = '#808080'; bctx.fillRect(0, 0, 512, 256)
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * 512, y = Math.random() * 256, r = Math.random() * 8 + 1, v = Math.floor(Math.random() * 60 + 100)
    bctx.beginPath(); bctx.arc(x, y, r, 0, Math.PI * 2)
    bctx.fillStyle = `rgba(${v},${v},${v},0.15)`; bctx.fill()
  }
  const bumpTex = new THREE.CanvasTexture(bumpCanvas)

  const marsGeo = new THREE.SphereGeometry(1.2, 96, 96)
  const marsMat = new THREE.MeshStandardMaterial({ map: marsTex, bumpMap: bumpTex, bumpScale: 0.05, roughness: 0.9, metalness: 0.0 })
  const marsMesh = new THREE.Mesh(marsGeo, marsMat)
  marsMesh.rotation.y = -Math.PI / 2
  scene.add(marsMesh)

  // Load real NASA Mars texture (replaces procedural placeholder)
  const textureLoader = new THREE.TextureLoader()
  textureLoader.load('/3d-textures/mars_color.jpg', (tex) => { if (disposed) return; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); marsMat.map = tex; marsMat.needsUpdate = true }, undefined, () => {})

  // Thin atmosphere
  const atmosGeo = new THREE.SphereGeometry(1.28, 64, 64)
  const atmosMat = new THREE.MeshBasicMaterial({ color: 0xdd8855, transparent: true, opacity: 0.08, side: THREE.BackSide, depthWrite: false })
  scene.add(new THREE.Mesh(atmosGeo, atmosMat))

  // Starfield
  const starCount = 2500; const starPos = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3, r = 60 + Math.random() * 400, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1)
    starPos[i3] = r * Math.sin(phi) * Math.cos(theta); starPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta); starPos[i3 + 2] = r * Math.cos(phi)
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.5, color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false })))

  // Lighting
  const sunLight = new THREE.DirectionalLight(0xffe8d0, 2.0); sunLight.position.set(5, 3, 5); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x1a0805, 0.2))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 2, maxDistance: 15 })
  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    marsMesh.rotation.y += 0.001
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Saturn Scene ── */
function createSaturnScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050510)
  const camera = new THREE.PerspectiveCamera(45, (container.clientWidth || 300) / (container.clientHeight || 300), 0.1, 2000)
  camera.position.set(0, 3, 8)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.3, radius: 0.5, threshold: 0.85 })

  // HDRI environment
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Saturn body
  const satCanvas = document.createElement('canvas'); satCanvas.width = 512; satCanvas.height = 256
  const sctx = satCanvas.getContext('2d')
  const satGrad = sctx.createLinearGradient(0, 0, 0, 256)
  satGrad.addColorStop(0, '#d4b87a'); satGrad.addColorStop(0.3, '#c8a860')
  satGrad.addColorStop(0.5, '#b89850'); satGrad.addColorStop(0.7, '#c8a860')
  satGrad.addColorStop(1, '#d4b87a')
  sctx.fillStyle = satGrad; sctx.fillRect(0, 0, 512, 256)
  // Bands
  for (let i = 0; i < 12; i++) {
    const y = 20 + i * 18
    sctx.fillStyle = `rgba(${180 + Math.random() * 40},${150 + Math.random() * 30},${80 + Math.random() * 30},0.4)`
    sctx.fillRect(0, y, 512, 6 + Math.random() * 8)
  }
  const satTex = new THREE.CanvasTexture(satCanvas); satTex.encoding = THREE.sRGBEncoding
  const satGeo = new THREE.SphereGeometry(1.8, 96, 96)
  const satMat = new THREE.MeshStandardMaterial({ map: satTex, roughness: 0.7, metalness: 0.1 })
  const satMesh = new THREE.Mesh(satGeo, satMat)
  satMesh.rotation.x = 0.47
  scene.add(satMesh)

  // Load real NASA Saturn texture
  const textureLoader = new THREE.TextureLoader()
  textureLoader.load('/3d-textures/saturn_color.jpg', (tex) => { if (disposed) return; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); satMat.map = tex; satMat.needsUpdate = true }, undefined, () => {})

  // Rings
  const ringGeo = new THREE.RingGeometry(2.5, 4.2, 128)
  const ringCanvas = document.createElement('canvas'); ringCanvas.width = 512; ringCanvas.height = 32
  const rctx = ringCanvas.getContext('2d')
  const ringGrad = rctx.createLinearGradient(0, 0, 512, 0)
  ringGrad.addColorStop(0, 'rgba(200,180,120,0.0)')
  ringGrad.addColorStop(0.08, 'rgba(200,180,120,0.6)')
  ringGrad.addColorStop(0.2, 'rgba(180,160,100,0.2)')
  ringGrad.addColorStop(0.35, 'rgba(200,180,120,0.7)')
  ringGrad.addColorStop(0.5, 'rgba(160,140,90,0.15)')
  ringGrad.addColorStop(0.6, 'rgba(190,170,110,0.5)')
  ringGrad.addColorStop(0.75, 'rgba(180,160,100,0.3)')
  ringGrad.addColorStop(0.9, 'rgba(200,180,120,0.4)')
  ringGrad.addColorStop(1, 'rgba(200,180,120,0.0)')
  rctx.fillStyle = ringGrad; rctx.fillRect(0, 0, 512, 32)
  // Ring particles
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 512, y = Math.random() * 32
    rctx.beginPath(); rctx.arc(x, y, Math.random() * 1.5, 0, Math.PI * 2)
    rctx.fillStyle = `rgba(${200 + Math.random() * 55},${180 + Math.random() * 55},${120 + Math.random() * 55},${Math.random() * 0.4})`; rctx.fill()
  }
  const ringTex = new THREE.CanvasTexture(ringCanvas)
  const ringMat = new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
  const ringMesh = new THREE.Mesh(ringGeo, ringMat)
  ringMesh.rotation.x = -Math.PI / 2
  satMesh.add(ringMesh)

  // Moon (Titan)
  const titanGeo = new THREE.SphereGeometry(0.25, 24, 24)
  const titanMat = new THREE.MeshStandardMaterial({ color: 0xcc9944, roughness: 0.8 })
  const titan = new THREE.Mesh(titanGeo, titanMat)
  titan.position.set(6, 0.5, 0)
  scene.add(titan)

  // Moon (Enceladus)
  const encGeo = new THREE.SphereGeometry(0.12, 16, 16)
  const encMat = new THREE.MeshStandardMaterial({ color: 0xeeeedd, roughness: 0.6 })
  const enc = new THREE.Mesh(encGeo, encMat)
  enc.position.set(-4.5, -0.3, 2)
  scene.add(enc)

  // Starfield
  const starCount = 3000; const starPos = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3, r = 80 + Math.random() * 400, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1)
    starPos[i3] = r * Math.sin(phi) * Math.cos(theta); starPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta); starPos[i3 + 2] = r * Math.cos(phi)
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.5, color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false })))

  // Lighting
  const sunLight = new THREE.DirectionalLight(0xfff5e0, 2.0); sunLight.position.set(5, 2, 5); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x0a0a1e, 0.15))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 4, maxDistance: 25, autoRotateSpeed: 0.3 })
  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    satMesh.rotation.y = t * 0.05
    titan.position.x = Math.cos(t * 0.3) * 6; titan.position.z = Math.sin(t * 0.3) * 6
    enc.position.x = Math.cos(t * 0.5 + 2) * 4.5; enc.position.z = Math.sin(t * 0.5 + 2) * 4.5
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Black Hole Scene ── */
function createBlackHoleScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  const camera = new THREE.PerspectiveCamera(50, (container.clientWidth || 300) / (container.clientHeight || 300), 0.1, 2000)
  camera.position.set(0, 8, 20)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 1.5
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.6, radius: 0.5, threshold: 0.7 })

  // HDRI environment (env only)
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Event horizon (black sphere)
  const bhGeo = new THREE.SphereGeometry(2, 64, 64)
  const bhMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  const bh = new THREE.Mesh(bhGeo, bhMat)
  scene.add(bh)

  // Accretion disk
  const diskGeo = new THREE.RingGeometry(2.5, 8, 128, 8)
  const diskCanvas = document.createElement('canvas'); diskCanvas.width = 512; diskCanvas.height = 64
  const dctx = diskCanvas.getContext('2d')
  const diskGrad = dctx.createLinearGradient(0, 0, 512, 0)
  diskGrad.addColorStop(0, 'rgba(255,200,50,0.9)')
  diskGrad.addColorStop(0.2, 'rgba(255,120,20,0.7)')
  diskGrad.addColorStop(0.4, 'rgba(200,50,10,0.5)')
  diskGrad.addColorStop(0.6, 'rgba(255,80,20,0.3)')
  diskGrad.addColorStop(0.8, 'rgba(255,150,50,0.6)')
  diskGrad.addColorStop(1, 'rgba(255,220,100,0.1)')
  dctx.fillStyle = diskGrad; dctx.fillRect(0, 0, 512, 64)
  for (let i = 0; i < 200; i++) {
    dctx.beginPath(); dctx.arc(Math.random() * 512, Math.random() * 64, Math.random() * 2, 0, Math.PI * 2)
    dctx.fillStyle = `rgba(255,${150 + Math.random() * 105},${50 + Math.random() * 100},${Math.random() * 0.6})`; dctx.fill()
  }
  const diskTex = new THREE.CanvasTexture(diskCanvas); diskTex.encoding = THREE.sRGBEncoding
  const diskMat = new THREE.MeshBasicMaterial({ map: diskTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  const disk = new THREE.Mesh(diskGeo, diskMat)
  disk.rotation.x = -Math.PI / 2 + 0.3
  scene.add(disk)

  // Gravitational lensing ring
  const lensGeo = new THREE.TorusGeometry(2.2, 0.15, 16, 64)
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
  const lens = new THREE.Mesh(lensGeo, lensMat)
  lens.rotation.x = Math.PI / 2 + 0.3
  scene.add(lens)

  // Relativistic jets
  const jetMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
  const jetUp = new THREE.Mesh(new THREE.ConeGeometry(0.4, 15, 16), jetMat)
  jetUp.position.y = 7.5; scene.add(jetUp)
  const jetDown = new THREE.Mesh(new THREE.ConeGeometry(0.4, 15, 16), jetMat.clone())
  jetDown.position.y = -7.5; jetDown.rotation.x = Math.PI; scene.add(jetDown)

  // Background stars with distortion
  const starCount = 4000; const starPos = new Float32Array(starCount * 3); const starCols = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3, r = 50 + Math.random() * 500, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1)
    starPos[i3] = r * Math.sin(phi) * Math.cos(theta); starPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta); starPos[i3 + 2] = r * Math.cos(phi)
    starCols[i3] = 0.8 + Math.random() * 0.2; starCols[i3 + 1] = 0.8 + Math.random() * 0.2; starCols[i3 + 2] = 0.9 + Math.random() * 0.1
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3)); starGeo.setAttribute('color', new THREE.BufferAttribute(starCols, 3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.5, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false })))

  scene.add(new THREE.AmbientLight(0x111122, 0.1))
  const warmLight = new THREE.PointLight(0xff6622, 1.5, 30); warmLight.position.set(3, 0, 3); scene.add(warmLight)

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 8, maxDistance: 50, autoRotateSpeed: 0.2, enablePan: true })
  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    disk.rotation.z = t * 0.1
    lens.rotation.z = -t * 0.05
    jetUp.material.opacity = 0.2 + Math.sin(t * 2) * 0.1
    jetDown.material.opacity = 0.2 + Math.cos(t * 2) * 0.1
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Galaxy Scene ── */
function createGalaxyScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x020208)
  const camera = new THREE.PerspectiveCamera(50, (container.clientWidth || 300) / (container.clientHeight || 300), 0.1, 2000)
  camera.position.set(0, 25, 35)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 1.3
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.5, radius: 0.5, threshold: 0.8 })

  // HDRI environment
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Galaxy particles (spiral arms)
  const armCount = 20000
  const armPos = new Float32Array(armCount * 3)
  const armCols = new Float32Array(armCount * 3)
  const arms = 4
  for (let i = 0; i < armCount; i++) {
    const i3 = i * 3
    const arm = i % arms
    const armAngle = (arm / arms) * Math.PI * 2
    const dist = Math.random() * 25 + 1
    const angle = armAngle + dist * 0.3 + (Math.random() - 0.5) * 0.5
    const spread = (Math.random() - 0.5) * (1 + dist * 0.15)
    armPos[i3] = Math.cos(angle) * dist + spread
    armPos[i3 + 1] = (Math.random() - 0.5) * (1.5 - dist * 0.02)
    armPos[i3 + 2] = Math.sin(angle) * dist + spread
    // Color: white/blue in center, yellow/red in outer
    const c = dist / 25
    if (c < 0.3) { armCols[i3] = 0.8 + Math.random() * 0.2; armCols[i3 + 1] = 0.85 + Math.random() * 0.15; armCols[i3 + 2] = 1.0 }
    else if (c < 0.6) { armCols[i3] = 0.9 + Math.random() * 0.1; armCols[i3 + 1] = 0.8 + Math.random() * 0.15; armCols[i3 + 2] = 0.5 + Math.random() * 0.3 }
    else { armCols[i3] = 1.0; armCols[i3 + 1] = 0.5 + Math.random() * 0.3; armCols[i3 + 2] = 0.2 + Math.random() * 0.2 }
  }
  const armGeo = new THREE.BufferGeometry()
  armGeo.setAttribute('position', new THREE.BufferAttribute(armPos, 3))
  armGeo.setAttribute('color', new THREE.BufferAttribute(armCols, 3))
  const armMat = new THREE.PointsMaterial({ size: 0.15, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })
  const armPoints = new THREE.Points(armGeo, armMat)
  scene.add(armPoints)

  // Core glow
  const coreCanvas = document.createElement('canvas'); coreCanvas.width = 256; coreCanvas.height = 256
  const cctx = coreCanvas.getContext('2d')
  const coreGrad = cctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  coreGrad.addColorStop(0, 'rgba(255,240,200,1.0)')
  coreGrad.addColorStop(0.2, 'rgba(255,200,100,0.6)')
  coreGrad.addColorStop(0.5, 'rgba(200,100,50,0.2)')
  coreGrad.addColorStop(1, 'rgba(0,0,0,0)')
  cctx.fillStyle = coreGrad; cctx.fillRect(0, 0, 256, 256)
  const coreTex = new THREE.CanvasTexture(coreCanvas)
  const coreMat = new THREE.SpriteMaterial({ map: coreTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  const core = new THREE.Sprite(coreMat)
  core.scale.set(12, 12, 1)
  scene.add(core)

  // Background stars
  const bgStarCount = 3000; const bgPos = new Float32Array(bgStarCount * 3)
  for (let i = 0; i < bgStarCount; i++) {
    const i3 = i * 3, r = 100 + Math.random() * 400, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1)
    bgPos[i3] = r * Math.sin(phi) * Math.cos(theta); bgPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta); bgPos[i3 + 2] = r * Math.cos(phi)
  }
  const bgGeo = new THREE.BufferGeometry(); bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3))
  scene.add(new THREE.Points(bgGeo, new THREE.PointsMaterial({ size: 0.3, color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })))

  scene.add(new THREE.AmbientLight(0x222244, 0.1))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 10, maxDistance: 80, autoRotateSpeed: 0.15, enablePan: true })
  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    armPoints.rotation.y = clock.getElapsedTime() * 0.02
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Asteroid Belt Scene ── */
function createAsteroidScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x020205)
  scene.fog = new THREE.FogExp2(0x020205, 0.008)
  const camera = new THREE.PerspectiveCamera(55, (container.clientWidth || 300) / (container.clientHeight || 300), 0.1, 1000)
  camera.position.set(0, 5, 15)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.3, radius: 0.5, threshold: 0.85 })

  // HDRI environment
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Asteroids
  const asteroids = []
  const astMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.85, metalness: 0.15 }),
    new THREE.MeshStandardMaterial({ color: 0x7a7060, roughness: 0.95, metalness: 0.05 }),
  ]

  for (let i = 0; i < 150; i++) {
    const size = Math.random() * 0.6 + 0.1
    const geoType = Math.random()
    let geo
    if (geoType < 0.5) geo = new THREE.DodecahedronGeometry(size, 0)
    else if (geoType < 0.8) geo = new THREE.IcosahedronGeometry(size, 0)
    else geo = new THREE.OctahedronGeometry(size, 0)
    const mat = astMaterials[Math.floor(Math.random() * astMaterials.length)]
    const mesh = new THREE.Mesh(geo, mat)
    const dist = 8 + Math.random() * 20
    const angle = Math.random() * Math.PI * 2
    mesh.position.set(Math.cos(angle) * dist, (Math.random() - 0.5) * 6, Math.sin(angle) * dist)
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
    mesh.userData = { rotSpeed: { x: (Math.random() - 0.5) * 0.02, y: (Math.random() - 0.5) * 0.02, z: (Math.random() - 0.5) * 0.01 }, orbitSpeed: (Math.random() * 0.1 + 0.02), dist, baseAngle: angle }
    scene.add(mesh)
    asteroids.push(mesh)
  }

  // Dust particles
  const dustCount = 2000; const dustPos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) {
    const dist = 5 + Math.random() * 25
    const angle = Math.random() * Math.PI * 2
    dustPos[i * 3] = Math.cos(angle) * dist
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 8
    dustPos[i * 3 + 2] = Math.sin(angle) * dist
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.08, color: 0x888899, transparent: true, opacity: 0.3, depthWrite: false })))

  // Background stars
  const starCount = 2000; const starPos = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3, r = 80 + Math.random() * 300, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1)
    starPos[i3] = r * Math.sin(phi) * Math.cos(theta); starPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta); starPos[i3 + 2] = r * Math.cos(phi)
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.4, color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false })))

  // Distant sun
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffddaa, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }))
  sunGlow.position.set(40, 15, -30); sunGlow.scale.set(8, 8, 1); scene.add(sunGlow)

  const sunLight = new THREE.DirectionalLight(0xfff5dd, 1.5); sunLight.position.set(40, 15, -30); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x111122, 0.2))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 5, maxDistance: 50, autoRotateSpeed: 0.15, enablePan: true })
  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    asteroids.forEach(a => {
      a.rotation.x += a.userData.rotSpeed.x
      a.rotation.y += a.userData.rotSpeed.y
      a.rotation.z += a.userData.rotSpeed.z
      const angle = a.userData.baseAngle + t * a.userData.orbitSpeed
      a.position.x = Math.cos(angle) * a.userData.dist
      a.position.z = Math.sin(angle) * a.userData.dist
    })
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Volcano Scene ── */
function createVolcanoScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a0a05)
  scene.fog = new THREE.FogExp2(0x2a1510, 0.012)
  const camera = new THREE.PerspectiveCamera(55, (container.clientWidth || 300) / (container.clientHeight || 300), 0.1, 500)
  camera.position.set(0, 12, 25)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 0.9
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.4, radius: 0.5, threshold: 0.8 })

  // HDRI environment
  loadHDRI('/3d-textures/outdoor_daytime_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Volcano cone
  const volcGeo = new THREE.ConeGeometry(10, 18, 32, 8)
  const posArr = volcGeo.attributes.position.array
  for (let i = 0; i < posArr.length; i += 3) {
    const y = posArr[i + 1]
    if (y > 7) {
      // Crater depression
      const distFromCenter = Math.sqrt(posArr[i] * posArr[i] + posArr[i + 2] * posArr[i + 2])
      posArr[i + 1] = y - (1 - distFromCenter / 4) * 2
    }
    // Add roughness
    posArr[i] += (Math.random() - 0.5) * 0.5
    posArr[i + 2] += (Math.random() - 0.5) * 0.5
  }
  volcGeo.computeVertexNormals()
  const volcColors = new Float32Array(posArr.length)
  for (let i = 0; i < posArr.length; i += 3) {
    const y = posArr[i + 1]
    let r, g, b
    if (y > 14) { r = 0.15; g = 0.08; b = 0.05 } // dark near crater
    else if (y > 8) { r = 0.35; g = 0.2; b = 0.12 } // rock
    else if (y > 3) { r = 0.25; g = 0.22; b = 0.15 } // lower rock
    else { r = 0.15; g = 0.2; b = 0.1 } // base with vegetation
    const v = (Math.random() - 0.5) * 0.08
    volcColors[i] = Math.max(0, r + v); volcColors[i + 1] = Math.max(0, g + v); volcColors[i + 2] = Math.max(0, b + v)
  }
  volcGeo.setAttribute('color', new THREE.BufferAttribute(volcColors, 3))
  const volcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0 })
  const volc = new THREE.Mesh(volcGeo, volcMat)
  volc.position.y = 9
  scene.add(volc)

  // Lava in crater
  const lavaGeo = new THREE.CircleGeometry(3, 32)
  const lavaCanvas = document.createElement('canvas'); lavaCanvas.width = 256; lavaCanvas.height = 256
  const lctx = lavaCanvas.getContext('2d')
  const lavaGrad = lctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  lavaGrad.addColorStop(0, '#ff4400'); lavaGrad.addColorStop(0.4, '#ff6600')
  lavaGrad.addColorStop(0.7, '#cc3300'); lavaGrad.addColorStop(1, '#881100')
  lctx.fillStyle = lavaGrad; lctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 50; i++) {
    lctx.beginPath(); lctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 15 + 5, 0, Math.PI * 2)
    lctx.fillStyle = `rgba(255,${150 + Math.random() * 105},0,${Math.random() * 0.5 + 0.3})`; lctx.fill()
  }
  const lavaTex = new THREE.CanvasTexture(lavaCanvas); lavaTex.encoding = THREE.sRGBEncoding
  const lavaMat = new THREE.MeshBasicMaterial({ map: lavaTex, side: THREE.DoubleSide })
  const lava = new THREE.Mesh(lavaGeo, lavaMat)
  lava.rotation.x = -Math.PI / 2; lava.position.y = 17.5
  scene.add(lava)

  // Lava glow
  const lavaLight = new THREE.PointLight(0xff4400, 3, 30); lavaLight.position.set(0, 18, 0); scene.add(lavaLight)

  // Eruption particles
  const eruptCount = 500; const eruptPos = new Float32Array(eruptCount * 3)
  const eruptVel = []
  for (let i = 0; i < eruptCount; i++) {
    eruptPos[i * 3] = (Math.random() - 0.5) * 2
    eruptPos[i * 3 + 1] = 18 + Math.random() * 5
    eruptPos[i * 3 + 2] = (Math.random() - 0.5) * 2
    eruptVel.push({ x: (Math.random() - 0.5) * 0.3, y: Math.random() * 0.2 + 0.1, z: (Math.random() - 0.5) * 0.3 })
  }
  const eruptGeo = new THREE.BufferGeometry(); eruptGeo.setAttribute('position', new THREE.BufferAttribute(eruptPos, 3))
  const eruptMat = new THREE.PointsMaterial({ size: 0.3, color: 0xff6622, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })
  const erupt = new THREE.Points(eruptGeo, eruptMat)
  scene.add(erupt)

  // Ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x1a2a10, roughness: 0.9 }))
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0; scene.add(ground)

  // Lava streams flowing down
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5
    const streamGeo = new THREE.PlaneGeometry(1 + Math.random(), 10 + Math.random() * 5, 1, 10)
    streamGeo.rotateX(-Math.PI / 2)
    const streamMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    const stream = new THREE.Mesh(streamGeo, streamMat)
    stream.position.set(Math.cos(angle) * 5, 5 + Math.random() * 3, Math.sin(angle) * 5)
    stream.rotation.y = -angle
    scene.add(stream)
  }

  // Smoke
  for (let i = 0; i < 10; i++) {
    const smokeGeo = new THREE.SphereGeometry(1.5 + Math.random() * 2, 8, 6)
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.15, depthWrite: false })
    const smoke = new THREE.Mesh(smokeGeo, smokeMat)
    smoke.position.set((Math.random() - 0.5) * 3, 22 + Math.random() * 8, (Math.random() - 0.5) * 3)
    smoke.scale.set(1, 0.5 + Math.random() * 0.5, 1)
    scene.add(smoke)
  }

  // Lighting
  scene.add(new THREE.AmbientLight(0x1a0808, 0.3))
  const moonLight = new THREE.DirectionalLight(0x4466aa, 0.3); moonLight.position.set(-10, 20, -10); scene.add(moonLight)

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 10, maxDistance: 60, autoRotateSpeed: 0.2, enablePan: true })
  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    // Animate eruption particles
    const ePos = eruptGeo.attributes.position.array
    for (let i = 0; i < eruptCount; i++) {
      ePos[i * 3] += eruptVel[i].x * 0.1
      ePos[i * 3 + 1] += eruptVel[i].y * 0.1
      ePos[i * 3 + 2] += eruptVel[i].z * 0.1
      if (ePos[i * 3 + 1] > 30) {
        ePos[i * 3] = (Math.random() - 0.5) * 2
        ePos[i * 3 + 1] = 18
        ePos[i * 3 + 2] = (Math.random() - 0.5) * 2
      }
    }
    eruptGeo.attributes.position.needsUpdate = true
    lavaLight.intensity = 2.5 + Math.sin(t * 3) * 0.8
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Forest Scene ── */
function createForestScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a3a1a)
  scene.fog = new THREE.FogExp2(0x2a4a2a, 0.015)
  const camera = new THREE.PerspectiveCamera(55, (container.clientWidth || 300) / (container.clientHeight || 300), 0.1, 200)
  camera.position.set(0, 5, 15)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 1.1
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.3, radius: 0.5, threshold: 0.85 })

  // HDRI environment
  loadHDRI('/3d-textures/forest_nature_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Ground
  const groundCanvas = document.createElement('canvas'); groundCanvas.width = 256; groundCanvas.height = 256
  const gctx = groundCanvas.getContext('2d')
  gctx.fillStyle = '#2a4a1a'; gctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 500; i++) {
    gctx.beginPath(); gctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 4 + 1, 0, Math.PI * 2)
    gctx.fillStyle = `rgba(${30 + Math.random() * 30},${60 + Math.random() * 40},${15 + Math.random() * 20},0.4)`; gctx.fill()
  }
  const groundTex = new THREE.CanvasTexture(groundCanvas); groundTex.encoding = THREE.sRGBEncoding
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(4, 4)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9 }))
  ground.rotation.x = -Math.PI / 2; scene.add(ground)

  // Trees
  function addTree(x, z, scale) {
    const s = scale || 1
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 2.5 * s, 6)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2510, roughness: 0.9 })
    const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.set(x, 1.25 * s, z); scene.add(trunk)
    // Foliage layers
    const foliageColors = [0x1a5a1a, 0x2a6a2a, 0x1a4a15, 0x2a5a20]
    for (let layer = 0; layer < 3; layer++) {
      const radius = (1.5 - layer * 0.3) * s
      const height = (1.8 - layer * 0.2) * s
      const fGeo = new THREE.ConeGeometry(radius, height, 8)
      const fMat = new THREE.MeshStandardMaterial({ color: foliageColors[Math.floor(Math.random() * foliageColors.length)], roughness: 0.85 })
      const foliage = new THREE.Mesh(fGeo, fMat)
      foliage.position.set(x, (2.5 + layer * 1.2) * s, z)
      scene.add(foliage)
    }
  }

  // Dense forest
  for (let i = 0; i < 80; i++) {
    const x = (Math.random() - 0.5) * 60
    const z = (Math.random() - 0.5) * 60
    const distFromCenter = Math.sqrt(x * x + z * z)
    if (distFromCenter < 3) continue // Keep a clearing
    addTree(x, z, 0.6 + Math.random() * 0.8)
  }

  // Sunbeams (volumetric light shafts)
  for (let i = 0; i < 5; i++) {
    const beamGeo = new THREE.CylinderGeometry(0.3, 1.5, 15, 8, 1, true)
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.04, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    const beam = new THREE.Mesh(beamGeo, beamMat)
    beam.position.set((Math.random() - 0.5) * 20, 10, (Math.random() - 0.5) * 20)
    beam.rotation.z = (Math.random() - 0.5) * 0.3
    scene.add(beam)
  }

  // Fireflies
  const ffCount = 100
  const ffPos = new Float32Array(ffCount * 3)
  for (let i = 0; i < ffCount; i++) {
    ffPos[i * 3] = (Math.random() - 0.5) * 40
    ffPos[i * 3 + 1] = 1 + Math.random() * 5
    ffPos[i * 3 + 2] = (Math.random() - 0.5) * 40
  }
  const ffGeo = new THREE.BufferGeometry(); ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3))
  const ffMat = new THREE.PointsMaterial({ size: 0.15, color: 0xaaffaa, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })
  const fireflies = new THREE.Points(ffGeo, ffMat)
  scene.add(fireflies)

  // Lighting
  const sunLight = new THREE.DirectionalLight(0xfff5cc, 1.2); sunLight.position.set(10, 30, 15); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x1a3a1a, 0.4))
  const hemiLight = new THREE.HemisphereLight(0x88aa88, 0x223311, 0.3); scene.add(hemiLight)

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 5, maxDistance: 40, autoRotateSpeed: 0.2, enablePan: true })
  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    // Animate fireflies
    const fPos = ffGeo.attributes.position.array
    for (let i = 0; i < ffCount; i++) {
      fPos[i * 3] += Math.sin(t + i) * 0.01
      fPos[i * 3 + 1] += Math.cos(t * 0.5 + i * 0.7) * 0.005
      fPos[i * 3 + 2] += Math.cos(t + i * 1.3) * 0.01
    }
    ffGeo.attributes.position.needsUpdate = true
    ffMat.opacity = 0.3 + Math.sin(t * 2) * 0.3
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Castle Scene ── */
function createCastleScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x4488bb)
  scene.fog = new THREE.FogExp2(0x4488bb, 0.006)
  const camera = new THREE.PerspectiveCamera(50, (container.clientWidth || 300) / (container.clientHeight || 300), 0.1, 500)
  camera.position.set(0, 15, 35)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.3, radius: 0.5, threshold: 0.85 })

  // HDRI environment
  loadHDRI('/3d-textures/outdoor_daytime_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888880, roughness: 0.9, metalness: 0.0 })
  const stoneLight = new THREE.MeshStandardMaterial({ color: 0xa0a098, roughness: 0.85, metalness: 0.0 })
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x606058, roughness: 0.9, metalness: 0.05 })
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b2020, roughness: 0.7, metalness: 0.1 })
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8, metalness: 0.05 })
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2255aa, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.5 })
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x3a7a2a, roughness: 0.9 })

  // Ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), grassMat)
  ground.rotation.x = -Math.PI / 2; scene.add(ground)

  // Moat
  const moat = new THREE.Mesh(new THREE.RingGeometry(12, 16, 32), waterMat)
  moat.rotation.x = -Math.PI / 2; moat.position.y = 0.05; scene.add(moat)

  // Drawbridge
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 5), woodMat)
  bridge.position.set(0, 0.1, 14); scene.add(bridge)
  for (let i = -1.5; i <= 1.5; i += 1) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 5), woodMat)
    plank.position.set(i, 0.22, 14); scene.add(plank)
  }

  // Castle walls
  function addWall(x, z, w, d, h, mat) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || stoneMat)
    wall.position.set(x, h / 2, z); wall.castShadow = true; scene.add(wall)
    return wall
  }

  // Main walls (square)
  const wallH = 6, wallThick = 0.8
  addWall(0, 10, 20, wallThick, wallH, stoneLight) // front
  addWall(0, -10, 20, wallThick, wallH, stoneLight) // back
  addWall(-10, 0, wallThick, 20, wallH, stoneLight) // left
  addWall(10, 0, wallThick, 20, wallH, stoneLight) // right

  // Battlements (crenellations)
  for (let x = -9.5; x <= 9.5; x += 2) {
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, wallThick + 0.3), stoneLight)
    merlon.position.set(x, wallH + 0.6, 10); scene.add(merlon)
    const merlon2 = merlon.clone(); merlon2.position.z = -10; scene.add(merlon2)
    const merlon3 = new THREE.Mesh(new THREE.BoxGeometry(wallThick + 0.3, 1.2, 1), stoneLight)
    merlon3.position.set(-10, wallH + 0.6, x); scene.add(merlon3)
    const merlon4 = merlon3.clone(); merlon4.position.x = 10; scene.add(merlon4)
  }

  // Corner towers
  function addTower(x, z) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 10, 12), stoneMat)
    tower.position.set(x, 5, z); tower.castShadow = true; scene.add(tower)
    // Tower top
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2, 1, 12), stoneLight)
    top.position.set(x, 10.5, z); scene.add(top)
    // Cone roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 3, 12), roofMat)
    roof.position.set(x, 12.5, z); scene.add(roof)
    // Window slits
    for (let a = 0; a < 4; a++) {
      const angle = (a / 4) * Math.PI * 2
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, 0.1), stoneDark)
      slit.position.set(x + Math.cos(angle) * 2.1, 7, z + Math.sin(angle) * 2.1)
      slit.rotation.y = angle; scene.add(slit)
    }
  }
  addTower(-10, 10); addTower(10, 10); addTower(-10, -10); addTower(10, -10)

  // Keep (central tower)
  const keep = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 6), stoneLight)
  keep.position.set(0, 6, 0); keep.castShadow = true; scene.add(keep)
  const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(5, 4, 4), roofMat)
  keepRoof.position.set(0, 14, 0); keepRoof.rotation.y = Math.PI / 4; scene.add(keepRoof)

  // Keep windows
  for (let a = 0; a < 4; a++) {
    const angle = (a / 4) * Math.PI * 2
    const win = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 0.1), new THREE.MeshBasicMaterial({ color: 0x223344 }))
    win.position.set(Math.cos(angle) * 3.05, 8, Math.sin(angle) * 3.05)
    win.rotation.y = angle; scene.add(win)
  }

  // Courtyard
  const court = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), stoneDark)
  court.rotation.x = -Math.PI / 2; court.position.y = 0.05; scene.add(court)

  // Gate
  const gate = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 1), woodMat)
  gate.position.set(0, 2, 10.5); scene.add(gate)
  const gateArch = new THREE.Mesh(new THREE.TorusGeometry(2, 0.3, 8, 16, Math.PI), stoneLight)
  gateArch.position.set(0, 4, 10.5); scene.add(gateArch)

  // Flag on keep
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 4), woodMat)
  pole.position.set(0, 15.5, 0); scene.add(pole)
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ color: 0xcc2222, side: THREE.DoubleSide }))
  flag.position.set(0.6, 16.2, 0); scene.add(flag)

  // Sky dome
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 256; skyCanvas.height = 256
  const skyCtx = skyCanvas.getContext('2d')
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256)
  skyGrad.addColorStop(0, '#1a3a6a'); skyGrad.addColorStop(0.4, '#4488bb')
  skyGrad.addColorStop(0.8, '#88bbdd'); skyGrad.addColorStop(1, '#aaddff')
  skyCtx.fillStyle = skyGrad; skyCtx.fillRect(0, 0, 256, 256)
  // Clouds
  for (let i = 0; i < 15; i++) {
    skyCtx.beginPath(); skyCtx.arc(Math.random() * 256, 50 + Math.random() * 80, Math.random() * 25 + 10, 0, Math.PI * 2)
    skyCtx.fillStyle = 'rgba(255,255,255,0.3)'; skyCtx.fill()
  }
  const skyTex = new THREE.CanvasTexture(skyCanvas); skyTex.encoding = THREE.sRGBEncoding
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 32), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false }))
  scene.add(sky)

  // Lighting
  const sunLight = new THREE.DirectionalLight(0xfff5dd, 1.5); sunLight.position.set(20, 30, 20); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x446688, 0.4))
  const hemiLight = new THREE.HemisphereLight(0x88aacc, 0x445522, 0.3); scene.add(hemiLight)

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 10, maxDistance: 60, autoRotateSpeed: 0.2, enablePan: true })
  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    // Flutter flag
    flag.rotation.y = Math.sin(t * 3) * 0.15
    flag.position.x = 0.6 + Math.sin(t * 3) * 0.05
    // Water shimmer
    moat.material.opacity = 0.5 + Math.sin(t * 0.5) * 0.1
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Crystal Cave Scene ── */
function createCrystalScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x080810)
  scene.fog = new THREE.FogExp2(0x080810, 0.02)
  const camera = new THREE.PerspectiveCamera(55, (container.clientWidth || 300) / (container.clientHeight || 300), 0.1, 200)
  camera.position.set(0, 3, 12)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 1.0
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.5, radius: 0.5, threshold: 0.75 })

  // HDRI environment
  loadHDRI('/3d-textures/dark_cave_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  const crystalColors = [0x4488ff, 0x8844ff, 0xff44aa, 0x44ffaa, 0xffaa44, 0x44aaff]
  const crystalMats = crystalColors.map(c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.75,
    transmission: 0.5, side: THREE.DoubleSide, emissive: c, emissiveIntensity: 0.15,
  }))

  // Cave walls (rough sphere interior)
  const caveGeo = new THREE.SphereGeometry(15, 32, 32)
  const cavePos = caveGeo.attributes.position.array
  for (let i = 0; i < cavePos.length; i += 3) {
    const len = Math.sqrt(cavePos[i] * cavePos[i] + cavePos[i + 1] * cavePos[i + 1] + cavePos[i + 2] * cavePos[i + 2])
    const noise = 0.85 + Math.random() * 0.3
    cavePos[i] = (cavePos[i] / len) * 15 * noise
    cavePos[i + 1] = (cavePos[i + 1] / len) * 15 * noise
    cavePos[i + 2] = (cavePos[i + 2] / len) * 15 * noise
  }
  caveGeo.computeVertexNormals()
  const caveMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.95, metalness: 0.0, side: THREE.BackSide })
  const cave = new THREE.Mesh(caveGeo, caveMat)
  scene.add(cave)

  // Cave floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30, 16, 16), new THREE.MeshStandardMaterial({ color: 0x151520, roughness: 0.9 }))
  floor.rotation.x = -Math.PI / 2; floor.position.y = -5
  // Rough floor
  const floorPos = floor.geometry.attributes.position.array
  for (let i = 0; i < floorPos.length; i += 3) {
    floorPos[i + 1] = -5 + (Math.random() - 0.5) * 0.5
  }
  floor.geometry.computeVertexNormals()
  scene.add(floor)

  // Crystals growing from floor and walls
  function addCrystal(x, y, z, scale, rotX, rotZ) {
    const s = scale || 1
    const mat = crystalMats[Math.floor(Math.random() * crystalMats.length)]
    // Main crystal shard
    const h = (2 + Math.random() * 3) * s
    const geo = new THREE.ConeGeometry((0.3 + Math.random() * 0.3) * s, h, 6, 1)
    const crystal = new THREE.Mesh(geo, mat)
    crystal.position.set(x, y + h / 2, z)
    crystal.rotation.x = rotX || 0
    crystal.rotation.z = rotZ || 0
    scene.add(crystal)
    // Smaller satellite crystals
    for (let i = 0; i < 2; i++) {
      const smallH = h * (0.3 + Math.random() * 0.3)
      const smallGeo = new THREE.ConeGeometry((0.15 + Math.random() * 0.15) * s, smallH, 5, 1)
      const small = new THREE.Mesh(smallGeo, mat)
      small.position.set(x + (Math.random() - 0.5) * s, y + smallH / 2, z + (Math.random() - 0.5) * s)
      small.rotation.x = (rotX || 0) + (Math.random() - 0.5) * 0.5
      small.rotation.z = (rotZ || 0) + (Math.random() - 0.5) * 0.5
      scene.add(small)
    }
  }

  // Floor crystals
  for (let i = 0; i < 30; i++) {
    const x = (Math.random() - 0.5) * 20
    const z = (Math.random() - 0.5) * 20
    addCrystal(x, -5, z, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3)
  }

  // Wall crystals (growing sideways)
  for (let i = 0; i < 15; i++) {
    const angle = Math.random() * Math.PI * 2
    const wallR = 12
    const x = Math.cos(angle) * wallR
    const z = Math.sin(angle) * wallR
    const y = -3 + Math.random() * 8
    const towardCenter = Math.atan2(-z, -x)
    addCrystal(x, y, z, 0.4 + Math.random() * 0.4, towardCenter + Math.PI / 2 + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5)
  }

  // Ceiling stalactites
  for (let i = 0; i < 20; i++) {
    const x = (Math.random() - 0.5) * 20
    const z = (Math.random() - 0.5) * 20
    const h = 1 + Math.random() * 3
    const geo = new THREE.ConeGeometry(0.15 + Math.random() * 0.2, h, 5, 1)
    const stalactite = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.85 }))
    stalactite.position.set(x, 10 - h / 2, z)
    stalactite.rotation.x = Math.PI
    scene.add(stalactite)
  }

  // Glowing light sources from crystals
  const lightColors = [0x4488ff, 0x8844ff, 0xff44aa, 0x44ffaa]
  const lights = []
  for (let i = 0; i < 6; i++) {
    const color = lightColors[i % lightColors.length]
    const light = new THREE.PointLight(color, 0.8, 10)
    light.position.set((Math.random() - 0.5) * 15, -2 + Math.random() * 5, (Math.random() - 0.5) * 15)
    scene.add(light)
    lights.push(light)
  }

  scene.add(new THREE.AmbientLight(0x0a0a15, 0.3))

  // Floating particles (mineral dust)
  const dustCount = 500; const dustPos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 20
    dustPos[i * 3 + 1] = -4 + Math.random() * 14
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 20
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dustMat = new THREE.PointsMaterial({ size: 0.08, color: 0x88aaff, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })
  scene.add(new THREE.Points(dustGeo, dustMat))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 3, maxDistance: 20, autoRotateSpeed: 0.15, enablePan: true })
  const clock = new THREE.Clock()
  let animId
  function animate() {
    animId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()
    // Pulsate crystal lights
    lights.forEach((l, i) => {
      l.intensity = 0.6 + Math.sin(t * 1.5 + i * 2) * 0.3
    })
    dustMat.opacity = 0.3 + Math.sin(t * 0.8) * 0.15
    if (orbitControls) orbitControls.update()
    if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Jupiter Scene ── */
function createJupiterScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x020208)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000)
  camera.position.set(0, 0.5, 5)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.2, radius: 0.5, threshold: 0.9 })

  // HDRI environment
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Jupiter body with procedural bands
  const jupCanvas = document.createElement('canvas'); jupCanvas.width = 512; jupCanvas.height = 256
  const jctx = jupCanvas.getContext('2d')
  const bandColors = ['#c4a46e','#d4b07a','#b89560','#c9a870','#a8844e','#d4b888','#b89050','#c4a060','#d0b888','#a88040','#c4a46e','#b89060']
  bandColors.forEach((c,i) => { jctx.fillStyle = c; jctx.fillRect(0, i*21, 512, 22) })
  for (let i = 0; i < 600; i++) { const x = Math.random()*512, y = Math.random()*256, w = Math.random()*20+5, h = Math.random()*3+1; jctx.fillStyle = `rgba(${180+Math.random()*40},${150+Math.random()*30},${80+Math.random()*40},0.3)`; jctx.fillRect(x,y,w,h) }
  // Great Red Spot
  jctx.beginPath(); jctx.ellipse(300, 140, 30, 18, 0.1, 0, Math.PI*2)
  const spotGrad = jctx.createRadialGradient(300, 140, 0, 300, 140, 30)
  spotGrad.addColorStop(0, 'rgba(180,60,30,0.8)'); spotGrad.addColorStop(0.5, 'rgba(200,80,40,0.5)'); spotGrad.addColorStop(1, 'rgba(180,120,60,0.2)')
  jctx.fillStyle = spotGrad; jctx.fill()
  const jupTex = new THREE.CanvasTexture(jupCanvas); jupTex.encoding = THREE.sRGBEncoding

  const jupGeo = new THREE.SphereGeometry(1.8, 96, 96)
  const jupMat = new THREE.MeshStandardMaterial({ map: jupTex, roughness: 0.85, metalness: 0.05 })
  const jupMesh = new THREE.Mesh(jupGeo, jupMat)
  scene.add(jupMesh)

  // Load real NASA Jupiter texture
  const textureLoader = new THREE.TextureLoader()
  textureLoader.load('/3d-textures/jupiter_color.jpg', (tex) => { if (disposed) return; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); jupMat.map = tex; jupMat.needsUpdate = true }, undefined, () => {})

  // Starfield
  const starCount = 2500; const starPos = new Float32Array(starCount*3); const starCols = new Float32Array(starCount*3)
  for(let i=0;i<starCount;i++){const i3=i*3,r=60+Math.random()*400,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);starPos[i3]=r*Math.sin(phi)*Math.cos(theta);starPos[i3+1]=r*Math.sin(phi)*Math.sin(theta);starPos[i3+2]=r*Math.cos(phi);starCols[i3]=1;starCols[i3+1]=1;starCols[i3+2]=1}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));starGeo.setAttribute('color',new THREE.BufferAttribute(starCols,3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({size:0.5,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.7,depthWrite:false})))

  const sunLight = new THREE.DirectionalLight(0xfff5e6, 2); sunLight.position.set(5,2,5); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x151520, 0.2))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 3, maxDistance: 15, autoRotateSpeed: 0.2 })
  const clock = new THREE.Clock(); let animId
  function animate() { animId = requestAnimationFrame(animate); const t = clock.getElapsedTime(); jupMesh.rotation.y = t * 0.03; if(orbitControls) orbitControls.update(); if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) } }
  animate()
  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Venus Scene ── */
function createVenusScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050508)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000)
  camera.position.set(0, 0.3, 4)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.25, radius: 0.5, threshold: 0.9 })

  // HDRI environment
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  const venCanvas = document.createElement('canvas'); venCanvas.width = 512; venCanvas.height = 256
  const vctx = venCanvas.getContext('2d')
  const venGrad = vctx.createLinearGradient(0, 0, 0, 256)
  venGrad.addColorStop(0, '#d4a860'); venGrad.addColorStop(0.3, '#c89850'); venGrad.addColorStop(0.5, '#d4a060'); venGrad.addColorStop(0.7, '#c89050'); venGrad.addColorStop(1, '#d4a860')
  vctx.fillStyle = venGrad; vctx.fillRect(0, 0, 512, 256)
  for (let i = 0; i < 800; i++) { const x = Math.random()*512, y = Math.random()*256, r = Math.random()*15+5; vctx.beginPath(); vctx.arc(x,y,r,0,Math.PI*2); vctx.fillStyle = `rgba(${200+Math.random()*40},${160+Math.random()*40},${80+Math.random()*40},${0.1+Math.random()*0.15})`; vctx.fill() }
  const venTex = new THREE.CanvasTexture(venCanvas); venTex.encoding = THREE.sRGBEncoding

  const venGeo = new THREE.SphereGeometry(1.3, 96, 96)
  const venMat = new THREE.MeshStandardMaterial({ map: venTex, roughness: 0.9, metalness: 0.02 })
  const venMesh = new THREE.Mesh(venGeo, venMat)
  scene.add(venMesh)

  // Load real NASA Venus texture
  const textureLoader = new THREE.TextureLoader()
  textureLoader.load('/3d-textures/venus_color.jpg', (tex) => { if (disposed) return; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); venMat.map = tex; venMat.needsUpdate = true }, undefined, () => {})

  // Thick atmosphere glow
  const atmosGeo = new THREE.SphereGeometry(1.5, 64, 64)
  const atmosMat = new THREE.MeshBasicMaterial({ color: 0xddaa55, transparent: true, opacity: 0.15, side: THREE.BackSide, depthWrite: false })
  scene.add(new THREE.Mesh(atmosGeo, atmosMat))

  const starCount = 2000; const starPos = new Float32Array(starCount*3); const starCols = new Float32Array(starCount*3)
  for(let i=0;i<starCount;i++){const i3=i*3,r=60+Math.random()*400,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);starPos[i3]=r*Math.sin(phi)*Math.cos(theta);starPos[i3+1]=r*Math.sin(phi)*Math.sin(theta);starPos[i3+2]=r*Math.cos(phi);starCols[i3]=1;starCols[i3+1]=0.95;starCols[i3+2]=0.9}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));starGeo.setAttribute('color',new THREE.BufferAttribute(starCols,3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({size:0.5,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.6,depthWrite:false})))

  const sunLight = new THREE.DirectionalLight(0xfff5d0, 2.2); sunLight.position.set(5,1,5); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x1a1510, 0.2))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 2, maxDistance: 12 })
  const clock = new THREE.Clock(); let animId
  function animate() { animId = requestAnimationFrame(animate); const t = clock.getElapsedTime(); venMesh.rotation.y = t * 0.02; if(orbitControls) orbitControls.update(); if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) } }
  animate()
  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Mercury Scene ── */
function createMercuryScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x020204)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000)
  camera.position.set(0, 0, 4)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.2, radius: 0.5, threshold: 0.9 })

  // HDRI environment
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  const merCanvas = document.createElement('canvas'); merCanvas.width = 512; merCanvas.height = 256
  const mctx = merCanvas.getContext('2d')
  mctx.fillStyle = '#888888'; mctx.fillRect(0, 0, 512, 256)
  for (let i = 0; i < 3000; i++) { const x = Math.random()*512, y = Math.random()*256, r = Math.random()*3+0.5, v = Math.floor(Math.random()*60+100); mctx.beginPath(); mctx.arc(x,y,r,0,Math.PI*2); mctx.fillStyle = `rgb(${v},${v},${v})`; mctx.fill() }
  for (let i = 0; i < 60; i++) { const x = Math.random()*512, y = Math.random()*256, r = Math.random()*20+5, v = Math.floor(Math.random()*40+90); mctx.beginPath(); mctx.arc(x,y,r,0,Math.PI*2); mctx.strokeStyle = `rgba(${v+30},${v+30},${v+30},0.4)`; mctx.lineWidth = 1.5+Math.random()*2; mctx.stroke(); mctx.beginPath(); mctx.arc(x,y,r*0.8,0,Math.PI*2); mctx.fillStyle = `rgba(${v-20},${v-20},${v-20},0.25)`; mctx.fill() }
  const merTex = new THREE.CanvasTexture(merCanvas); merTex.encoding = THREE.sRGBEncoding

  const merGeo = new THREE.SphereGeometry(1, 96, 96)
  const merMat = new THREE.MeshStandardMaterial({ map: merTex, roughness: 0.95, metalness: 0.0 })
  const merMesh = new THREE.Mesh(merGeo, merMat)
  scene.add(merMesh)

  // Load real NASA Mercury texture
  const textureLoader = new THREE.TextureLoader()
  textureLoader.load('/3d-textures/mercury_color.jpg', (tex) => { if (disposed) return; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); merMat.map = tex; merMat.needsUpdate = true }, undefined, () => {})

  const starCount = 2000; const starPos = new Float32Array(starCount*3); const starCols = new Float32Array(starCount*3)
  for(let i=0;i<starCount;i++){const i3=i*3,r=60+Math.random()*400,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);starPos[i3]=r*Math.sin(phi)*Math.cos(theta);starPos[i3+1]=r*Math.sin(phi)*Math.sin(theta);starPos[i3+2]=r*Math.cos(phi);starCols[i3]=1;starCols[i3+1]=1;starCols[i3+2]=1}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));starGeo.setAttribute('color',new THREE.BufferAttribute(starCols,3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({size:0.5,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.7,depthWrite:false})))

  const sunLight = new THREE.DirectionalLight(0xfff8e0, 3); sunLight.position.set(5,2,5); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x0a0a15, 0.15))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 2, maxDistance: 12 })
  const clock = new THREE.Clock(); let animId
  function animate() { animId = requestAnimationFrame(animate); const t = clock.getElapsedTime(); merMesh.rotation.y = t * 0.015; if(orbitControls) orbitControls.update(); if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) } }
  animate()
  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Neptune Scene ── */
function createNeptuneScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x010108)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000)
  camera.position.set(0, 0.3, 4.5)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.25, radius: 0.5, threshold: 0.9 })

  // HDRI environment
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  const nepCanvas = document.createElement('canvas'); nepCanvas.width = 512; nepCanvas.height = 256
  const nctx = nepCanvas.getContext('2d')
  const nepGrad = nctx.createLinearGradient(0, 0, 0, 256)
  nepGrad.addColorStop(0, '#2244aa'); nepGrad.addColorStop(0.2, '#3355bb'); nepGrad.addColorStop(0.4, '#2244aa'); nepGrad.addColorStop(0.6, '#3355cc'); nepGrad.addColorStop(0.8, '#2244bb'); nepGrad.addColorStop(1, '#1a3388')
  nctx.fillStyle = nepGrad; nctx.fillRect(0, 0, 512, 256)
  for (let i = 0; i < 500; i++) { const x = Math.random()*512, y = Math.random()*256, w = Math.random()*30+5, h = Math.random()*4+1; nctx.fillStyle = `rgba(${50+Math.random()*40},${70+Math.random()*50},${180+Math.random()*60},0.2)`; nctx.fillRect(x,y,w,h) }
  // Dark spot
  nctx.beginPath(); nctx.ellipse(200, 110, 25, 15, -0.1, 0, Math.PI*2); nctx.fillStyle = 'rgba(15,25,80,0.6)'; nctx.fill()
  const nepTex = new THREE.CanvasTexture(nepCanvas); nepTex.encoding = THREE.sRGBEncoding

  const nepGeo = new THREE.SphereGeometry(1.3, 96, 96)
  const nepMat = new THREE.MeshStandardMaterial({ map: nepTex, roughness: 0.8, metalness: 0.05 })
  const nepMesh = new THREE.Mesh(nepGeo, nepMat)
  scene.add(nepMesh)

  // Load real NASA Neptune texture
  const textureLoader = new THREE.TextureLoader()
  textureLoader.load('/3d-textures/neptune_color.jpg', (tex) => { if (disposed) return; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); nepMat.map = tex; nepMat.needsUpdate = true }, undefined, () => {})

  // Faint rings
  const ringGeo = new THREE.RingGeometry(1.7, 2.1, 64)
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x4466aa, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false })
  const ringMesh = new THREE.Mesh(ringGeo, ringMat); ringMesh.rotation.x = -Math.PI / 2.1; scene.add(ringMesh)

  const starCount = 2500; const starPos = new Float32Array(starCount*3); const starCols = new Float32Array(starCount*3)
  for(let i=0;i<starCount;i++){const i3=i*3,r=60+Math.random()*400,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);starPos[i3]=r*Math.sin(phi)*Math.cos(theta);starPos[i3+1]=r*Math.sin(phi)*Math.sin(theta);starPos[i3+2]=r*Math.cos(phi);starCols[i3]=0.8;starCols[i3+1]=0.85;starCols[i3+2]=1}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));starGeo.setAttribute('color',new THREE.BufferAttribute(starCols,3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({size:0.5,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.7,depthWrite:false})))

  const sunLight = new THREE.DirectionalLight(0xddeeff, 1.8); sunLight.position.set(5,2,5); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x0a0a20, 0.25))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 2, maxDistance: 12, autoRotateSpeed: 0.2 })
  const clock = new THREE.Clock(); let animId
  function animate() { animId = requestAnimationFrame(animate); const t = clock.getElapsedTime(); nepMesh.rotation.y = t * 0.04; if(orbitControls) orbitControls.update(); if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) } }
  animate()
  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Uranus Scene ── */
function createUranusScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x010206)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000)
  camera.position.set(0, 2, 5)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.25, radius: 0.5, threshold: 0.9 })

  // HDRI environment
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  const uraCanvas = document.createElement('canvas'); uraCanvas.width = 512; uraCanvas.height = 256
  const uctx = uraCanvas.getContext('2d')
  const uraGrad = uctx.createLinearGradient(0, 0, 0, 256)
  uraGrad.addColorStop(0, '#66aaaa'); uraGrad.addColorStop(0.3, '#77bbcc'); uraGrad.addColorStop(0.5, '#88ccbb'); uraGrad.addColorStop(0.7, '#77bbcc'); uraGrad.addColorStop(1, '#66aaaa')
  uctx.fillStyle = uraGrad; uctx.fillRect(0, 0, 512, 256)
  for (let i = 0; i < 400; i++) { const x = Math.random()*512, y = Math.random()*256, w = Math.random()*25+5, h = Math.random()*3+1; uctx.fillStyle = `rgba(${100+Math.random()*40},${180+Math.random()*40},${170+Math.random()*40},0.15)`; uctx.fillRect(x,y,w,h) }
  const uraTex = new THREE.CanvasTexture(uraCanvas); uraTex.encoding = THREE.sRGBEncoding

  const uraGeo = new THREE.SphereGeometry(1.2, 96, 96)
  const uraMat = new THREE.MeshStandardMaterial({ map: uraTex, roughness: 0.85, metalness: 0.03 })
  const uraMesh = new THREE.Mesh(uraGeo, uraMat)
  uraMesh.rotation.z = Math.PI * 0.45 // Uranus tilts on its side
  scene.add(uraMesh)

  // Load real NASA Uranus texture
  const textureLoader = new THREE.TextureLoader()
  textureLoader.load('/3d-textures/uranus_color.png', (tex) => { if (disposed) return; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); uraMat.map = tex; uraMat.needsUpdate = true }, undefined, () => {})

  // Vertical rings (due to extreme tilt)
  const ringGeo = new THREE.RingGeometry(1.6, 2.0, 64)
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x88aaaa, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false })
  const ringMesh = new THREE.Mesh(ringGeo, ringMat); ringMesh.rotation.x = -Math.PI / 2; uraMesh.add(ringMesh)

  const starCount = 2000; const starPos = new Float32Array(starCount*3); const starCols = new Float32Array(starCount*3)
  for(let i=0;i<starCount;i++){const i3=i*3,r=60+Math.random()*400,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);starPos[i3]=r*Math.sin(phi)*Math.cos(theta);starPos[i3+1]=r*Math.sin(phi)*Math.sin(theta);starPos[i3+2]=r*Math.cos(phi);starCols[i3]=1;starCols[i3+1]=1;starCols[i3+2]=1}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));starGeo.setAttribute('color',new THREE.BufferAttribute(starCols,3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({size:0.5,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.7,depthWrite:false})))

  const sunLight = new THREE.DirectionalLight(0xddeeff, 1.5); sunLight.position.set(3,5,5); scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x0a1015, 0.2))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 2, maxDistance: 12, autoRotateSpeed: 0.2 })
  const clock = new THREE.Clock(); let animId
  function animate() { animId = requestAnimationFrame(animate); const t = clock.getElapsedTime(); uraMesh.rotation.y = t * 0.03; if(orbitControls) orbitControls.update(); if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) } }
  animate()
  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Comet Scene ── */
function createCometScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000005)
  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 2000)
  camera.position.set(0, 2, 8)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.4, radius: 0.5, threshold: 0.8 })

  // HDRI environment
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Comet nucleus
  const nucleusGeo = new THREE.SphereGeometry(0.4, 32, 32)
  const nucleusMat = new THREE.MeshStandardMaterial({ color: 0xccbbaa, roughness: 0.9, metalness: 0.05 })
  const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat)
  nucleus.position.set(2, 0, 0)
  scene.add(nucleus)

  // Coma (fuzzy glow around nucleus)
  const comaGeo = new THREE.SphereGeometry(0.7, 32, 32)
  const comaMat = new THREE.MeshBasicMaterial({ color: 0x88aacc, transparent: true, opacity: 0.15, depthWrite: false })
  const coma = new THREE.Mesh(comaGeo, comaMat)
  nucleus.add(coma)

  // Ion tail (blue, straight)
  const ionTailCount = 1500; const ionPos = new Float32Array(ionTailCount*3); const ionCols = new Float32Array(ionTailCount*3)
  for(let i=0;i<ionTailCount;i++){const i3=i*3;const d=Math.random()*12;const spread=d*0.15;ionPos[i3]=2-d*0.8;ionPos[i3+1]=(Math.random()-0.5)*spread;ionPos[i3+2]=(Math.random()-0.5)*spread;ionCols[i3]=0.4+Math.random()*0.2;ionCols[i3+1]=0.5+Math.random()*0.3;ionCols[i3+2]=0.9+Math.random()*0.1}
  const ionGeo=new THREE.BufferGeometry();ionGeo.setAttribute('position',new THREE.BufferAttribute(ionPos,3));ionGeo.setAttribute('color',new THREE.BufferAttribute(ionCols,3))
  scene.add(new THREE.Points(ionGeo, new THREE.PointsMaterial({size:0.08,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending})))

  // Dust tail (yellowish, curved)
  const dustTailCount = 1200; const dustTPos = new Float32Array(dustTailCount*3); const dustTCols = new Float32Array(dustTailCount*3)
  for(let i=0;i<dustTailCount;i++){const i3=i*3;const d=Math.random()*10;const curve=d*0.15;const spread=d*0.2;dustTPos[i3]=2-d*0.7+curve;dustTPos[i3+1]=(Math.random()-0.5)*spread+curve*0.5;dustTPos[i3+2]=(Math.random()-0.5)*spread;dustTCols[i3]=0.9+Math.random()*0.1;dustTCols[i3+1]=0.8+Math.random()*0.15;dustTCols[i3+2]=0.4+Math.random()*0.3}
  const dustTGeo=new THREE.BufferGeometry();dustTGeo.setAttribute('position',new THREE.BufferAttribute(dustTPos,3));dustTGeo.setAttribute('color',new THREE.BufferAttribute(dustTCols,3))
  scene.add(new THREE.Points(dustTGeo, new THREE.PointsMaterial({size:0.1,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.4,depthWrite:false,blending:THREE.AdditiveBlending})))

  // Stars
  const starCount = 3000; const starPos = new Float32Array(starCount*3); const starCols = new Float32Array(starCount*3)
  for(let i=0;i<starCount;i++){const i3=i*3,r=60+Math.random()*400,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);starPos[i3]=r*Math.sin(phi)*Math.cos(theta);starPos[i3+1]=r*Math.sin(phi)*Math.sin(theta);starPos[i3+2]=r*Math.cos(phi);starCols[i3]=1;starCols[i3+1]=1;starCols[i3+2]=1}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));starGeo.setAttribute('color',new THREE.BufferAttribute(starCols,3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({size:0.5,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.7,depthWrite:false})))

  scene.add(new THREE.DirectionalLight(0xfff5e0, 1.5).translateX(5).translateY(3).translateZ(5))
  scene.add(new THREE.AmbientLight(0x0a0a15, 0.2))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 3, maxDistance: 20, autoRotateSpeed: 0.15 })
  const clock = new THREE.Clock(); let animId
  function animate() { animId = requestAnimationFrame(animate); const t = clock.getElapsedTime(); nucleus.rotation.y = t*0.05; if(orbitControls) orbitControls.update(); if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) } }
  animate()
  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Supernova Scene ── */
function createSupernovaScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x010005)
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000)
  camera.position.set(0, 0, 15)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 1.5
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.6, radius: 0.5, threshold: 0.7 })

  // HDRI environment
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Central explosion
  const coreGeo = new THREE.SphereGeometry(0.8, 32, 32)
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const core = new THREE.Mesh(coreGeo, coreMat)
  scene.add(core)

  // Expanding shell particles
  const shellCount = 4000; const shellPos = new Float32Array(shellCount*3); const shellCols = new Float32Array(shellCount*3); const shellVel = []
  for(let i=0;i<shellCount;i++){const i3=i*3;const theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);const r=1+Math.random()*3;shellPos[i3]=r*Math.sin(phi)*Math.cos(theta);shellPos[i3+1]=r*Math.sin(phi)*Math.sin(theta);shellPos[i3+2]=r*Math.cos(phi);const speed=0.01+Math.random()*0.02;shellVel.push({x:shellPos[i3]*speed,y:shellPos[i3+1]*speed,z:shellPos[i3+2]*speed});const t=Math.random();if(t>0.7){shellCols[i3]=1;shellCols[i3+1]=0.5;shellCols[i3+2]=0.2}else if(t>0.3){shellCols[i3]=0.8;shellCols[i3+1]=0.3;shellCols[i3+2]=0.6}else{shellCols[i3]=1;shellCols[i3+1]=0.9;shellCols[i3+2]=0.7}}
  const shellGeo=new THREE.BufferGeometry();shellGeo.setAttribute('position',new THREE.BufferAttribute(shellPos,3));shellGeo.setAttribute('color',new THREE.BufferAttribute(shellCols,3))
  const shellMat = new THREE.PointsMaterial({size:0.12,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.7,depthWrite:false,blending:THREE.AdditiveBlending})
  scene.add(new THREE.Points(shellGeo, shellMat))

  // Shockwave rings
  const rings = []
  for (let i = 0; i < 3; i++) { const rGeo = new THREE.RingGeometry(3+i*2-0.1, 3+i*2+0.1, 128); const rMat = new THREE.MeshBasicMaterial({color:0x6644aa,transparent:true,opacity:0.2-i*0.05,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}); const rMesh = new THREE.Mesh(rGeo,rMat); rMesh.rotation.x = Math.random()*0.5; rMesh.rotation.y = Math.random()*0.5; scene.add(rMesh); rings.push(rMesh) }

  // Background stars
  const starCount = 2000; const starPos = new Float32Array(starCount*3)
  for(let i=0;i<starCount;i++){const i3=i*3,r=50+Math.random()*400,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);starPos[i3]=r*Math.sin(phi)*Math.cos(theta);starPos[i3+1]=r*Math.sin(phi)*Math.sin(theta);starPos[i3+2]=r*Math.cos(phi)}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({size:0.4,color:0xffffff,transparent:true,opacity:0.5,depthWrite:false})))

  scene.add(new THREE.AmbientLight(0x1a0a20, 0.3))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 5, maxDistance: 40, autoRotateSpeed: 0.1 })
  const clock = new THREE.Clock(); let animId
  function animate() {
    animId = requestAnimationFrame(animate); const t = clock.getElapsedTime()
    const sPos = shellGeo.attributes.position.array
    for(let i=0;i<shellCount;i++){const i3=i*3;sPos[i3]+=shellVel[i].x;sPos[i3+1]+=shellVel[i].y;sPos[i3+2]+=shellVel[i].z}
    shellGeo.attributes.position.needsUpdate = true
    core.scale.setScalar(1+Math.sin(t*3)*0.2); coreMat.color.setHSL((t*0.05)%1, 0.8, 0.7+Math.sin(t*2)*0.15)
    rings.forEach((r,i) => { const s = 1+Math.sin(t*0.5+i)*0.1; r.scale.setScalar(s); r.rotation.z += 0.001*(i+1) })
    if(orbitControls) orbitControls.update(); if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()
  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Pulsar Scene ── */
function createPulsarScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x020005)
  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 2000)
  camera.position.set(0, 5, 15)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.5, radius: 0.5, threshold: 0.75 })

  // HDRI environment
  loadHDRI('/3d-textures/night_sky_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) scene.environment = envMap
  })

  // Neutron star
  const nsGeo = new THREE.SphereGeometry(0.5, 32, 32)
  const nsMat = new THREE.MeshBasicMaterial({ color: 0x88ccff })
  const nsMesh = new THREE.Mesh(nsGeo, nsMat)
  scene.add(nsMesh)

  // Magnetic axis beams
  const beamLen = 20; const beamGeo = new THREE.CylinderGeometry(0.3, 1.5, beamLen, 16, 1, true)
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  const beam1 = new THREE.Mesh(beamGeo, beamMat); beam1.position.y = beamLen/2; scene.add(beam1)
  const beam2 = new THREE.Mesh(beamGeo.clone(), beamMat.clone()); beam2.position.y = -beamLen/2; scene.add(beam2)

  // Accretion disk
  const diskGeo = new THREE.RingGeometry(1.5, 5, 64)
  const diskMat = new THREE.MeshBasicMaterial({ color: 0x6644aa, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  const disk = new THREE.Mesh(diskGeo, diskMat); disk.rotation.x = -Math.PI/2; scene.add(disk)

  // Pulse particles
  const pulseCount = 2000; const pulsePos = new Float32Array(pulseCount*3); const pulseCols = new Float32Array(pulseCount*3)
  for(let i=0;i<pulseCount;i++){const i3=i*3;const angle=Math.random()*Math.PI*2;const r=2+Math.random()*6;pulsePos[i3]=Math.cos(angle)*r;pulsePos[i3+1]=(Math.random()-0.5)*0.5;pulsePos[i3+2]=Math.sin(angle)*r;const t=Math.random();pulseCols[i3]=0.3+t*0.4;pulseCols[i3+1]=0.2+t*0.3;pulseCols[i3+2]=0.7+t*0.3}
  const pulseGeo=new THREE.BufferGeometry();pulseGeo.setAttribute('position',new THREE.BufferAttribute(pulsePos,3));pulseGeo.setAttribute('color',new THREE.BufferAttribute(pulseCols,3))
  scene.add(new THREE.Points(pulseGeo, new THREE.PointsMaterial({size:0.08,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending})))

  const starCount = 2000; const starPos = new Float32Array(starCount*3)
  for(let i=0;i<starCount;i++){const i3=i*3,r=50+Math.random()*400,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);starPos[i3]=r*Math.sin(phi)*Math.cos(theta);starPos[i3+1]=r*Math.sin(phi)*Math.sin(theta);starPos[i3+2]=r*Math.cos(phi)}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({size:0.4,color:0xffffff,transparent:true,opacity:0.5,depthWrite:false})))

  scene.add(new THREE.AmbientLight(0x0a0515, 0.2))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 5, maxDistance: 40, autoRotateSpeed: 0.1 })
  const clock = new THREE.Clock(); let animId
  function animate() {
    animId = requestAnimationFrame(animate); const t = clock.getElapsedTime()
    const pulsePhase = Math.sin(t * 4); const rotAngle = t * 0.8
    beam1.rotation.z = 0.3; beam1.rotation.x = rotAngle; beam2.rotation.z = 0.3; beam2.rotation.x = rotAngle
    beamMat.opacity = 0.15 + Math.abs(pulsePhase) * 0.25
    beam2.material.opacity = beamMat.opacity
    nsMat.color.setHSL(0.55, 0.6, 0.5 + Math.abs(pulsePhase) * 0.3)
    disk.rotation.z = t * 0.1
    if(orbitControls) orbitControls.update(); if (bloom) { bloom.composer.render() } else { renderer.render(scene, camera) }
  }
  animate()
  const onResize = addResizeHandler(camera, renderer, container)
  const origOnResize = onResize
  const bloomResize = () => { origOnResize(); if (bloom) { const w = container.clientWidth||300, h = container.clientHeight||300; bloom.composer.setSize(w, h) } }
  window.removeEventListener('resize', onResize)
  window.addEventListener('resize', bloomResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', bloomResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Desert Scene ── */
function createDesertScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0xd4a050, 0.015)
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000)
  camera.position.set(0, 4, 12)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 1.3
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.3, radius: 0.5, threshold: 0.9 })

  // HDRI environment
  loadHDRI('/3d-textures/outdoor_daytime_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) { scene.environment = envMap; scene.background = envMap }
  })

  // Sand dunes with PBR
  const duneGeo = new THREE.PlaneGeometry(80, 80, 200, 200)
  const dunePos = duneGeo.attributes.position.array
  for (let i = 0; i < dunePos.length; i += 3) {
    const x = dunePos[i], y = dunePos[i+1]
    dunePos[i+2] = Math.sin(x*0.15)*1.5 + Math.sin(y*0.1+2)*2 + Math.sin(x*0.3+y*0.2)*0.8 + Math.sin(x*0.05+y*0.08)*3
  }
  duneGeo.computeVertexNormals()
  const duneMat = loadPBRMaterial('/3d-textures/pbr/Rock021', renderer, { repeat: 8, displacementScale: 0.5, normalScale: 1.2, roughness: 0.95, color: 0xe8c878 })
  const duneMesh = new THREE.Mesh(duneGeo, duneMat); duneMesh.rotation.x = -Math.PI/2; scene.add(duneMesh)

  // Scattered rocks with Rock035
  const rockMat = loadPBRMaterial('/3d-textures/pbr/Rock035', renderer, { repeat: 2, normalScale: 1.5, roughness: 0.9, color: 0x8a7a60 })
  for (let i = 0; i < 12; i++) {
    const rGeo = new THREE.DodecahedronGeometry(0.4 + Math.random()*0.8, 1)
    const rPos = rGeo.attributes.position.array
    for (let j = 0; j < rPos.length; j += 3) { rPos[j] *= 1+Math.random()*0.3; rPos[j+1] *= 0.5+Math.random()*0.5; rPos[j+2] *= 1+Math.random()*0.3 }
    rGeo.computeVertexNormals()
    const rock = new THREE.Mesh(rGeo, rockMat)
    const angle = Math.random()*Math.PI*2, dist = 5+Math.random()*25
    rock.position.set(Math.cos(angle)*dist, Math.random()*0.3, Math.sin(angle)*dist)
    rock.rotation.set(Math.random()*0.3, Math.random()*Math.PI*2, Math.random()*0.3)
    scene.add(rock)
  }

  // Sun with lens flare sprite
  const sunGeo = new THREE.SphereGeometry(3, 32, 32)
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffee88 })
  const sun = new THREE.Mesh(sunGeo, sunMat); sun.position.set(20, 15, -30); scene.add(sun)
  // Lens flare sprite
  const flareCanvas = document.createElement('canvas'); flareCanvas.width = 128; flareCanvas.height = 128
  const fCtx = flareCanvas.getContext('2d')
  const grad = fCtx.createRadialGradient(64,64,0,64,64,64)
  grad.addColorStop(0, 'rgba(255,240,180,0.6)'); grad.addColorStop(0.3, 'rgba(255,220,120,0.2)'); grad.addColorStop(1, 'rgba(255,200,80,0)')
  fCtx.fillStyle = grad; fCtx.fillRect(0,0,128,128)
  const flareTex = new THREE.CanvasTexture(flareCanvas)
  const flareMat = new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })
  const flare = new THREE.Sprite(flareMat); flare.position.copy(sun.position); flare.scale.set(20,20,1); scene.add(flare)

  // Heat shimmer particles
  const shimmerCount = 600; const shimmerPos = new Float32Array(shimmerCount*3)
  for(let i=0;i<shimmerCount;i++){shimmerPos[i*3]=(Math.random()-0.5)*40;shimmerPos[i*3+1]=Math.random()*2+0.5;shimmerPos[i*3+2]=(Math.random()-0.5)*40}
  const shimmerGeo = new THREE.BufferGeometry(); shimmerGeo.setAttribute('position', new THREE.BufferAttribute(shimmerPos, 3))
  scene.add(new THREE.Points(shimmerGeo, new THREE.PointsMaterial({size:0.2,color:0xffddaa,transparent:true,opacity:0.12,depthWrite:false,blending:THREE.AdditiveBlending})))

  // Lights
  const dirLight = new THREE.DirectionalLight(0xfff0cc, 2); dirLight.position.set(20,15,-10); scene.add(dirLight)
  scene.add(new THREE.AmbientLight(0xd4a060, 0.3))
  scene.add(new THREE.HemisphereLight(0xffee88, 0xd4a060, 0.4))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 5, maxDistance: 40, maxPolarAngle: Math.PI/2.1, enablePan: true })
  const clock = new THREE.Clock(); let animId
  function animate() {
    animId = requestAnimationFrame(animate); const t = clock.getElapsedTime()
    const sPos = shimmerGeo.attributes.position.array
    for(let i=0;i<shimmerCount;i++){sPos[i*3+1]=0.5+Math.sin(t*2+i*0.5)*0.3+Math.random()*0.05;sPos[i*3]+=Math.sin(t*0.7+i)*0.002}
    shimmerGeo.attributes.position.needsUpdate=true
    flare.material.opacity = 0.5 + Math.sin(t*1.5)*0.1
    if(orbitControls) orbitControls.update()
    if(bloom){bloom.composer.render()}else{renderer.render(scene,camera)}
  }
  animate()
  const onResize = () => {
    const w = container.clientWidth||300, h = container.clientHeight||300
    camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h)
    if(bloom) bloom.composer.setSize(w,h)
  }
  window.addEventListener('resize', onResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Cave Scene ── */
function createCaveScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x020304)
  scene.fog = new THREE.FogExp2(0x020304, 0.025)
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100)
  camera.position.set(0, 2, 8)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.6, radius: 0.7, threshold: 0.7 })

  // HDRI environment
  loadHDRI('/3d-textures/dark_cave_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) { scene.environment = envMap }
  })

  // Cave walls - multiple overlapping spheres with PBR
  const caveMat = loadPBRMaterial('/3d-textures/pbr/Rock035', renderer, { repeat: 3, displacementScale: 0.4, normalScale: 2.0, roughness: 0.95, color: 0x3a3530, side: THREE.BackSide })
  const cave1 = new THREE.Mesh(new THREE.SphereGeometry(15, 64, 64), caveMat); scene.add(cave1)
  const cave2Mat = loadPBRMaterial('/3d-textures/pbr/Rock035', renderer, { repeat: 2, normalScale: 1.5, roughness: 0.95, color: 0x2a2520, side: THREE.BackSide })
  const cave2 = new THREE.Mesh(new THREE.SphereGeometry(8, 32, 32), cave2Mat); cave2.position.set(5, -3, -5); scene.add(cave2)

  // Stalactites with organic shapes
  const stalMat = loadPBRMaterial('/3d-textures/pbr/Rock035', renderer, { repeat: 1, normalScale: 1.5, roughness: 0.9, color: 0x5a5550 })
  for (let i = 0; i < 25; i++) {
    const h = 1+Math.random()*3.5, rTop = 0.05+Math.random()*0.1, rBot = 0.15+Math.random()*0.35
    const stalGeo = new THREE.CylinderGeometry(rTop, rBot, h, 8)
    const stal = new THREE.Mesh(stalGeo, stalMat)
    const angle = Math.random()*Math.PI*2, dist = Math.random()*10
    stal.position.set(Math.cos(angle)*dist, 7-h/2, Math.sin(angle)*dist)
    stal.rotation.x = Math.PI; stal.rotation.z = (Math.random()-0.5)*0.3
    scene.add(stal)
  }

  // Stalagmites
  const stagMat = loadPBRMaterial('/3d-textures/pbr/Rock035', renderer, { repeat: 1, normalScale: 1.5, roughness: 0.9, color: 0x4a4540 })
  for (let i = 0; i < 20; i++) {
    const h = 0.5+Math.random()*2.5, rTop = 0.05+Math.random()*0.1, rBot = 0.15+Math.random()*0.4
    const stagGeo = new THREE.CylinderGeometry(rTop, rBot, h, 8)
    const stag = new THREE.Mesh(stagGeo, stagMat)
    const angle = Math.random()*Math.PI*2, dist = Math.random()*10
    stag.position.set(Math.cos(angle)*dist, -7.5+h/2, Math.sin(angle)*dist)
    stag.rotation.z = (Math.random()-0.5)*0.2
    scene.add(stag)
  }

  // Crystal formations with emissive materials
  const crystalColors = [0x44ff88, 0x88ff44, 0x22ddff, 0xaa66ff]
  const crystals = []
  for (let i = 0; i < 15; i++) {
    const cGeo = new THREE.IcosahedronGeometry(0.15+Math.random()*0.3, 0)
    const cMat = new THREE.MeshStandardMaterial({ color: crystalColors[i%4], emissive: crystalColors[i%4], emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.85 })
    const crystal = new THREE.Mesh(cGeo, cMat)
    const angle = Math.random()*Math.PI*2, dist = Math.random()*10
    crystal.position.set(Math.cos(angle)*dist, (Math.random()-0.5)*10, Math.sin(angle)*dist)
    crystal.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0)
    scene.add(crystal)
    crystals.push(crystal)
    const pl = new THREE.PointLight(crystalColors[i%4], 0.5+Math.random()*0.5, 6)
    pl.position.copy(crystal.position); scene.add(pl)
  }

  // Underground pool - reflective water
  const poolGeo = new THREE.CircleGeometry(5, 32)
  const poolMat = new THREE.MeshStandardMaterial({ color: 0x114466, roughness: 0.05, metalness: 0.95, envMapIntensity: 2.0, transparent: true, opacity: 0.9 })
  const pool = new THREE.Mesh(poolGeo, poolMat); pool.rotation.x = -Math.PI/2; pool.position.y = -7.5; scene.add(pool)

  // Bioluminescent volumetric glow spheres
  const glowColors = [0x44ff88, 0x88ff44, 0x22ddaa, 0x66ffaa]
  const glowSpheres = []
  for (let i = 0; i < 8; i++) {
    for (let layer = 0; layer < 3; layer++) {
      const r = 0.3 + layer*0.3
      const gGeo = new THREE.SphereGeometry(r, 8, 8)
      const gMat = new THREE.MeshBasicMaterial({ color: glowColors[i%4], transparent: true, opacity: 0.15-layer*0.04, depthWrite: false, blending: THREE.AdditiveBlending })
      const gMesh = new THREE.Mesh(gGeo, gMat)
      const angle = Math.random()*Math.PI*2, dist = Math.random()*8
      gMesh.position.set(Math.cos(angle)*dist, (Math.random()-0.5)*8, Math.sin(angle)*dist)
      scene.add(gMesh)
      glowSpheres.push(gMesh)
    }
  }

  scene.add(new THREE.AmbientLight(0x0a0a10, 0.1))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 2, maxDistance: 15, autoRotateSpeed: 0.15 })
  const clock = new THREE.Clock(); let animId
  function animate() {
    animId = requestAnimationFrame(animate); const t = clock.getElapsedTime()
    crystals.forEach((c,i) => { c.rotation.y = t*0.3+i; c.material.emissiveIntensity = 0.5+Math.sin(t*2+i)*0.4 })
    glowSpheres.forEach((g,i) => { g.material.opacity = 0.08+Math.sin(t*1.5+i*0.7)*0.06 })
    if(orbitControls) orbitControls.update()
    if(bloom){bloom.composer.render()}else{renderer.render(scene,camera)}
  }
  animate()
  const onResize = () => {
    const w = container.clientWidth||300, h = container.clientHeight||300
    camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h)
    if(bloom) bloom.composer.setSize(w,h)
  }
  window.addEventListener('resize', onResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Waterfall Scene ── */
function createWaterfallScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x2a4030, 0.012)
  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 500)
  camera.position.set(0, 5, 18)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.35, radius: 0.6, threshold: 0.85 })

  // HDRI environment
  loadHDRI('/3d-textures/forest_nature_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) { scene.environment = envMap; scene.background = envMap }
  })

  // Cliff with PBR
  const cliffMat = loadPBRMaterial('/3d-textures/pbr/Rock035', renderer, { repeat: 3, displacementScale: 0.3, normalScale: 1.8, roughness: 0.95, color: 0x555040 })
  const cliffGeo = new THREE.BoxGeometry(20, 15, 5, 10, 10, 2)
  const cPos = cliffGeo.attributes.position.array
  for (let i = 0; i < cPos.length; i += 3) { if(Math.abs(cPos[i])>8) cPos[i]+=Math.random()*0.5; cPos[i+1]+=Math.random()*0.3 }
  cliffGeo.computeVertexNormals()
  const cliff = new THREE.Mesh(cliffGeo, cliffMat); cliff.position.set(0, 5, -5); scene.add(cliff)

  // Waterfall mesh - animated plane
  const fallGeo = new THREE.PlaneGeometry(3, 12, 8, 30)
  const fallMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
  const fallMesh = new THREE.Mesh(fallGeo, fallMat); fallMesh.position.set(0, 3, -2.5); scene.add(fallMesh)

  // Waterfall particles
  const waterCount = 2000; const waterPos = new Float32Array(waterCount*3); const waterVel = []
  for (let i = 0; i < waterCount; i++) {
    waterPos[i*3] = (Math.random()-0.5)*3; waterPos[i*3+1] = Math.random()*12; waterPos[i*3+2] = -2+Math.random()*2
    waterVel.push(0.03+Math.random()*0.06)
  }
  const waterGeo = new THREE.BufferGeometry(); waterGeo.setAttribute('position', new THREE.BufferAttribute(waterPos, 3))
  scene.add(new THREE.Points(waterGeo, new THREE.PointsMaterial({size:0.06,color:0xaaddff,transparent:true,opacity:0.4,depthWrite:false,blending:THREE.AdditiveBlending})))

  // Pool - reflective water
  const poolGeo = new THREE.PlaneGeometry(15, 10, 20, 20)
  const poolMat = new THREE.MeshStandardMaterial({ color: 0x225588, roughness: 0.05, metalness: 0.95, envMapIntensity: 2.0, transparent: true, opacity: 0.85 })
  const pool = new THREE.Mesh(poolGeo, poolMat); pool.rotation.x = -Math.PI/2; pool.position.y = -2.5; scene.add(pool)

  // Wet ground around pool
  const wetGroundMat = loadPBRMaterial('/3d-textures/pbr/Ground042', renderer, { repeat: 4, normalScale: 1.2, roughness: 0.7, color: 0x3a4a30 })
  const wetGround = new THREE.Mesh(new THREE.PlaneGeometry(25, 20), wetGroundMat)
  wetGround.rotation.x = -Math.PI/2; wetGround.position.y = -2.55; scene.add(wetGround)

  // Mist - large soft sprite particles
  const mistCount = 300; const mistPos = new Float32Array(mistCount*3)
  for(let i=0;i<mistCount;i++){mistPos[i*3]=(Math.random()-0.5)*10;mistPos[i*3+1]=Math.random()*3-2;mistPos[i*3+2]=Math.random()*5-2}
  const mistGeo = new THREE.BufferGeometry(); mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3))
  scene.add(new THREE.Points(mistGeo, new THREE.PointsMaterial({size:0.5,color:0xffffff,transparent:true,opacity:0.08,depthWrite:false})))

  // Lush vegetation
  const treeColors = [0x2a6a2a, 0x1a5a1a, 0x3a7a3a, 0x2a5a3a]
  for (let i = 0; i < 18; i++) {
    const treeGeo = new THREE.ConeGeometry(0.6+Math.random()*0.6, 2+Math.random()*3, 8)
    const treeMat = new THREE.MeshStandardMaterial({ color: treeColors[i%4], roughness: 0.9 })
    const tree = new THREE.Mesh(treeGeo, treeMat)
    const side = Math.random() > 0.5 ? 1 : -1
    tree.position.set(side*(6+Math.random()*6), -2+Math.random(), -4+Math.random()*8)
    scene.add(tree)
  }

  // God rays - transparent cones with additive blending
  for (let i = 0; i < 4; i++) {
    const rayGeo = new THREE.ConeGeometry(1.5, 12, 8, 1, true)
    const rayMat = new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.03, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    const ray = new THREE.Mesh(rayGeo, rayMat)
    ray.position.set(-4+i*2.5, 6, -3); ray.rotation.x = 0.1; ray.rotation.z = (Math.random()-0.5)*0.3
    scene.add(ray)
  }

  scene.add(new THREE.DirectionalLight(0xfff8e0, 1.5).translateX(5).translateY(10).translateZ(5))
  scene.add(new THREE.AmbientLight(0x1a3020, 0.3))
  scene.add(new THREE.HemisphereLight(0x88ccff, 0x225533, 0.3))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 5, maxDistance: 30, maxPolarAngle: Math.PI/2, autoRotateSpeed: 0.15 })
  const clock = new THREE.Clock(); let animId
  function animate() {
    animId = requestAnimationFrame(animate); const t = clock.getElapsedTime()
    // Animate waterfall mesh vertices
    const fPos = fallGeo.attributes.position.array
    for (let i = 0; i < fPos.length; i += 3) { fPos[i] = (Math.random()-0.5)*0.15; fPos[i+2] = (Math.random()-0.5)*0.1 }
    fallGeo.attributes.position.needsUpdate = true
    // Waterfall particles
    const wPos = waterGeo.attributes.position.array
    for(let i=0;i<waterCount;i++){wPos[i*3+1]-=waterVel[i];if(wPos[i*3+1]<-2.5){wPos[i*3+1]=12;wPos[i*3]=(Math.random()-0.5)*3;wPos[i*3+2]=-2+Math.random()*2}}
    waterGeo.attributes.position.needsUpdate=true
    // Mist drift
    const mPos = mistGeo.attributes.position.array
    for(let i=0;i<mistCount;i++){mPos[i*3]+=Math.sin(t+i)*0.003;mPos[i*3+1]+=Math.cos(t*0.5+i)*0.002}
    mistGeo.attributes.position.needsUpdate=true
    // Pool ripples
    const pPos = poolGeo.attributes.position.array
    for(let i=0;i<pPos.length;i+=3){pPos[i+2]=Math.sin(pPos[i]*0.5+t*2)*0.03+Math.cos(pPos[i+1]*0.5+t*1.5)*0.03}
    poolGeo.attributes.position.needsUpdate=true
    if(orbitControls) orbitControls.update()
    if(bloom){bloom.composer.render()}else{renderer.render(scene,camera)}
  }
  animate()
  const onResize = () => {
    const w = container.clientWidth||300, h = container.clientHeight||300
    camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h)
    if(bloom) bloom.composer.setSize(w,h)
  }
  window.addEventListener('resize', onResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Arctic Scene ── */
function createArcticScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x0a1020, 0.008)
  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1000)
  camera.position.set(0, 5, 18)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.5, radius: 0.6, threshold: 0.8 })

  // HDRI environment
  loadHDRI('/3d-textures/arctic_snow_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) { scene.environment = envMap; scene.background = envMap }
  })

  // Ice ground with PBR
  const iceGeo = new THREE.PlaneGeometry(80, 80, 40, 40)
  const iceMat = loadPBRMaterial('/3d-textures/pbr/Snow003', renderer, { repeat: 6, displacementScale: 0.2, normalScale: 1.5, roughness: 0.2, metalness: 0.3, color: 0xc0d8e8, envMapIntensity: 1.5 })
  const ice = new THREE.Mesh(iceGeo, iceMat); ice.rotation.x = -Math.PI/2; scene.add(ice)

  // Icebergs with irregular geometry
  for (let i = 0; i < 8; i++) {
    const bgGeo = new THREE.DodecahedronGeometry(1+Math.random()*2, 2)
    const bgPos = bgGeo.attributes.position.array
    for (let j = 0; j < bgPos.length; j += 3) { bgPos[j+1] *= 0.5+Math.random()*0.5; bgPos[j] *= 1+Math.random()*0.3; bgPos[j+2] *= 1+Math.random()*0.3 }
    bgGeo.computeVertexNormals()
    const bgMat = new THREE.MeshStandardMaterial({ color: 0xc0d8e8, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85, envMapIntensity: 1.5 })
    const bg = new THREE.Mesh(bgGeo, bgMat)
    bg.position.set((Math.random()-0.5)*30, -0.5+Math.random()*1.5, (Math.random()-0.5)*30-5)
    bg.rotation.y = Math.random()*Math.PI
    scene.add(bg)
  }

  // Aurora borealis - shader-based curtain effect
  const auroraColors = [0x22ff66, 0x44ffaa, 0x22ddff, 0x88ff44, 0x44aaff, 0x66ffcc]
  const auroraPlanes = []
  for (let i = 0; i < 8; i++) {
    const aGeo = new THREE.PlaneGeometry(18, 4, 30, 8)
    const aPositions = aGeo.attributes.position.array
    // Create curtain wave shape
    for (let j = 0; j < aPositions.length; j += 3) {
      aPositions[j+2] += Math.sin(aPositions[j]*0.3)*1.5 + Math.sin(aPositions[j]*0.7)*0.5
    }
    aGeo.computeVertexNormals()
    const aMat = new THREE.MeshBasicMaterial({ color: auroraColors[i%6], transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    const aMesh = new THREE.Mesh(aGeo, aMat)
    aMesh.position.set((i-4)*4, 14+Math.random()*4, -25)
    aMesh.rotation.x = -0.15
    scene.add(aMesh)
    auroraPlanes.push(aMesh)
  }

  // Snow particles with varying sizes and wind drift
  const snowCount = 2500; const snowPos = new Float32Array(snowCount*3); const snowSizes = new Float32Array(snowCount)
  for(let i=0;i<snowCount;i++){snowPos[i*3]=(Math.random()-0.5)*60;snowPos[i*3+1]=Math.random()*30;snowPos[i*3+2]=(Math.random()-0.5)*60;snowSizes[i]=0.05+Math.random()*0.2}
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3))
  scene.add(new THREE.Points(snowGeo, new THREE.PointsMaterial({size:0.15,color:0xeeeeff,transparent:true,opacity:0.6,depthWrite:false})))

  // Frost/mist effect - transparent particle planes
  const frostCount = 200; const frostPos = new Float32Array(frostCount*3)
  for(let i=0;i<frostCount;i++){frostPos[i*3]=(Math.random()-0.5)*40;frostPos[i*3+1]=Math.random()*5;frostPos[i*3+2]=(Math.random()-0.5)*40}
  const frostGeo = new THREE.BufferGeometry(); frostGeo.setAttribute('position', new THREE.BufferAttribute(frostPos, 3))
  scene.add(new THREE.Points(frostGeo, new THREE.PointsMaterial({size:0.8,color:0xccddff,transparent:true,opacity:0.04,depthWrite:false})))

  scene.add(new THREE.DirectionalLight(0xaaccff, 0.8).translateX(5).translateY(10).translateZ(5))
  scene.add(new THREE.AmbientLight(0x1a2040, 0.3))
  scene.add(new THREE.HemisphereLight(0x4488cc, 0x223344, 0.4))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 5, maxDistance: 40, maxPolarAngle: Math.PI/2.1, autoRotateSpeed: 0.1 })
  const clock = new THREE.Clock(); let animId
  function animate() {
    animId = requestAnimationFrame(animate); const t = clock.getElapsedTime()
    // Animate aurora
    auroraPlanes.forEach((a,i) => {
      a.position.y = 14+Math.sin(t*0.3+i)*2.5
      a.material.opacity = 0.06+Math.sin(t*0.5+i*1.5)*0.05
      const pos = a.geometry.attributes.position.array
      for(let j=0;j<pos.length;j+=3){pos[j+2]=Math.sin(pos[j]*0.3+t*0.5+i)*1.5+Math.sin(pos[j]*0.7+t*0.3)*0.5}
      a.geometry.attributes.position.needsUpdate = true
    })
    // Snow
    const sPos = snowGeo.attributes.position.array
    for(let i=0;i<snowCount;i++){sPos[i*3+1]-=0.02+Math.sin(t+i)*0.005;sPos[i*3]+=Math.sin(t*0.5+i)*0.003;if(sPos[i*3+1]<0){sPos[i*3+1]=30;sPos[i*3]=(Math.random()-0.5)*60}}
    snowGeo.attributes.position.needsUpdate=true
    if(orbitControls) orbitControls.update()
    if(bloom){bloom.composer.render()}else{renderer.render(scene,camera)}
  }
  animate()
  const onResize = () => {
    const w = container.clientWidth||300, h = container.clientHeight||300
    camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h)
    if(bloom) bloom.composer.setSize(w,h)
  }
  window.addEventListener('resize', onResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Pyramid Scene ── */
function createPyramidScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x1a1008, 0.008)
  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000)
  camera.position.set(0, 6, 20)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.2, radius: 0.5, threshold: 0.9 })

  // HDRI environment
  loadHDRI('/3d-textures/outdoor_daytime_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) { scene.environment = envMap }
  })

  // Sand ground with PBR
  const sandMat = loadPBRMaterial('/3d-textures/pbr/Rock021', renderer, { repeat: 10, displacementScale: 0.3, normalScale: 1.0, roughness: 0.95, color: 0xd4a860 })
  const sandGeo = new THREE.PlaneGeometry(100, 100, 80, 80)
  const sPos = sandGeo.attributes.position.array
  for (let i = 0; i < sPos.length; i += 3) { sPos[i+2] = Math.sin(sPos[i]*0.05)*1.5+Math.sin(sPos[i+1]*0.08)*1 }
  sandGeo.computeVertexNormals()
  const sand = new THREE.Mesh(sandGeo, sandMat); sand.rotation.x = -Math.PI/2; scene.add(sand)

  // Stepped pyramid builder
  function createSteppedPyramid(baseSize, height, steps) {
    const group = new THREE.Group()
    const pyrMat = loadPBRMaterial('/3d-textures/pbr/Rock021', renderer, { repeat: 2, normalScale: 1.2, roughness: 0.85, color: 0xc4a860 })
    for (let s = 0; s < steps; s++) {
      const scale = 1 - s/steps
      const w = baseSize * scale, h = height / steps
      const stepGeo = new THREE.BoxGeometry(w, h, w)
      const step = new THREE.Mesh(stepGeo, pyrMat)
      step.position.y = s * h + h/2
      group.add(step)
    }
    return group
  }

  // Great Pyramid
  const greatPyr = createSteppedPyramid(12, 10, 8)
  greatPyr.position.y = 0; scene.add(greatPyr)

  // Smaller pyramids
  const smallSizes = [{x:12,z:-4,s:7,h:5},{x:16,z:0,s:5,h:3.5},{x:10,z:2,s:4,h:2.5}]
  smallSizes.forEach(p => {
    const sp = createSteppedPyramid(p.s, p.h, 5)
    sp.position.set(p.x, 0, p.z); scene.add(sp)
  })

  // Sphinx silhouette (box body + cone headdress)
  const sphinxMat = loadPBRMaterial('/3d-textures/pbr/Rock021', renderer, { repeat: 1, normalScale: 1.5, roughness: 0.9, color: 0xb89850 })
  const sphinxBody = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 8), sphinxMat); sphinxBody.position.set(-5, 1, 5); scene.add(sphinxBody)
  const sphinxHead = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 1.5), sphinxMat); sphinxHead.position.set(-5, 3.25, 1.5); scene.add(sphinxHead)
  const sphinxHeaddress = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.5, 4), sphinxMat); sphinxHeaddress.position.set(-5, 5, 1.5); sphinxHeaddress.rotation.y = Math.PI/4; scene.add(sphinxHeaddress)

  // Stars with color variation
  const starCount = 3000; const starPos = new Float32Array(starCount*3); const starColors = new Float32Array(starCount*3)
  for(let i=0;i<starCount;i++){
    const i3=i*3,r=50+Math.random()*400,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1)
    starPos[i3]=r*Math.sin(phi)*Math.cos(theta);starPos[i3+1]=Math.abs(r*Math.sin(phi)*Math.sin(theta));starPos[i3+2]=r*Math.cos(phi)
    const warm = Math.random() > 0.7
    starColors[i3] = warm ? 1.0 : 0.7+Math.random()*0.3; starColors[i3+1] = warm ? 0.85+Math.random()*0.15 : 0.8+Math.random()*0.2; starColors[i3+2] = warm ? 0.6+Math.random()*0.2 : 1.0
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3)); starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3))
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({size:0.5,vertexColors:true,transparent:true,opacity:0.7,depthWrite:false})))

  // Moon with glow sprite
  const moonGeo = new THREE.SphereGeometry(2, 32, 32)
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeedd })
  const moon = new THREE.Mesh(moonGeo, moonMat); moon.position.set(25, 20, -30); scene.add(moon)
  const moonGlowCanvas = document.createElement('canvas'); moonGlowCanvas.width = 64; moonGlowCanvas.height = 64
  const mgCtx = moonGlowCanvas.getContext('2d')
  const mgGrad = mgCtx.createRadialGradient(32,32,0,32,32,32)
  mgGrad.addColorStop(0,'rgba(238,238,221,0.4)'); mgGrad.addColorStop(0.5,'rgba(238,238,221,0.1)'); mgGrad.addColorStop(1,'rgba(238,238,221,0)')
  mgCtx.fillStyle = mgGrad; mgCtx.fillRect(0,0,64,64)
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(moonGlowCanvas),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}))
  moonGlow.position.copy(moon.position); moonGlow.scale.set(15,15,1); scene.add(moonGlow)

  const dirLight = new THREE.DirectionalLight(0xaabbcc, 0.8); dirLight.position.set(25,20,-10); scene.add(dirLight)
  scene.add(new THREE.AmbientLight(0x1a1510, 0.25))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 10, maxDistance: 60, maxPolarAngle: Math.PI/2.1, autoRotateSpeed: 0.1 })
  const clock = new THREE.Clock(); let animId
  function animate() { animId = requestAnimationFrame(animate); if(orbitControls) orbitControls.update(); if(bloom){bloom.composer.render()}else{renderer.render(scene,camera)} }
  animate()
  const onResize = () => {
    const w = container.clientWidth||300, h = container.clientHeight||300
    camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h)
    if(bloom) bloom.composer.setSize(w,h)
  }
  window.addEventListener('resize', onResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Lighthouse Scene ── */
function createLighthouseScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x0a1520, 0.015)
  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 500)
  camera.position.set(0, 5, 18)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.5, radius: 0.6, threshold: 0.8 })

  // HDRI environment
  loadHDRI('/3d-textures/sunset_dusk_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) { scene.environment = envMap; scene.background = envMap }
  })

  // Lighthouse tower with PBR concrete
  const towerMat = loadPBRMaterial('/3d-textures/pbr/Concrete012', renderer, { repeat: 2, normalScale: 1.0, roughness: 0.7, color: 0xdddddd })
  const towerGeo = new THREE.CylinderGeometry(0.7, 1.3, 10, 16)
  const tower = new THREE.Mesh(towerGeo, towerMat); tower.position.y = 5; scene.add(tower)

  // Gallery/deck
  const deckGeo = new THREE.CylinderGeometry(1.5, 1.4, 0.4, 16)
  const deckMat = loadPBRMaterial('/3d-textures/pbr/Concrete012', renderer, { repeat: 1, roughness: 0.7, color: 0xcccccc })
  const deck = new THREE.Mesh(deckGeo, deckMat); deck.position.y = 10.2; scene.add(deck)

  // Red stripes
  for (let i = 0; i < 3; i++) {
    const r = 0.72 - i*0.15
    const stripGeo = new THREE.CylinderGeometry(r, r+0.03, 1.5, 16)
    const stripMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.6 })
    const strip = new THREE.Mesh(stripGeo, stripMat); strip.position.y = 2+i*3; scene.add(strip)
  }

  // Glass light room with emissive
  const lightRoomGeo = new THREE.CylinderGeometry(1.1, 0.9, 1.5, 16, 1, true)
  const lightRoomMat = new THREE.MeshStandardMaterial({ color: 0xffff88, emissive: 0xffff44, emissiveIntensity: 0.8, transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.2 })
  const lightRoom = new THREE.Mesh(lightRoomGeo, lightRoomMat); lightRoom.position.y = 11; scene.add(lightRoom)

  // Dome roof
  const roofGeo = new THREE.SphereGeometry(1.1, 16, 8, 0, Math.PI*2, 0, Math.PI/2)
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.3 })
  const roof = new THREE.Mesh(roofGeo, roofMat); roof.position.y = 11.75; scene.add(roof)

  // Rotating beam - volumetric effect with multiple layers
  const beamGroup = new THREE.Group(); beamGroup.position.y = 11
  for (let layer = 0; layer < 3; layer++) {
    const bGeo = new THREE.ConeGeometry(5+layer*2, 30, 16, 1, true)
    const bMat = new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.04-layer*0.01, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    beamGroup.add(new THREE.Mesh(bGeo, bMat))
  }
  scene.add(beamGroup)

  // Point light
  const lighthouseLight = new THREE.PointLight(0xffffaa, 2, 35); lighthouseLight.position.y = 11; scene.add(lighthouseLight)

  // Rocky base with PBR
  const rockMat = loadPBRMaterial('/3d-textures/pbr/Rock035', renderer, { repeat: 2, normalScale: 1.5, roughness: 0.95, color: 0x4a4540 })
  const rockGeo = new THREE.CylinderGeometry(4, 6, 3, 12)
  const rPos = rockGeo.attributes.position.array
  for(let i=0;i<rPos.length;i+=3){rPos[i]*=1+Math.random()*0.15;rPos[i+2]*=1+Math.random()*0.15}
  rockGeo.computeVertexNormals()
  const rock = new THREE.Mesh(rockGeo, rockMat); rock.position.y = -0.5; scene.add(rock)

  // Ocean with animated waves
  const oceanGeo = new THREE.PlaneGeometry(100, 100, 40, 40)
  const oceanMat = new THREE.MeshStandardMaterial({ color: 0x1a3344, roughness: 0.1, metalness: 0.7, envMapIntensity: 1.5 })
  const ocean = new THREE.Mesh(oceanGeo, oceanMat); ocean.rotation.x = -Math.PI/2; ocean.position.y = -2; scene.add(ocean)

  // Foam/spray particles around base
  const foamCount = 400; const foamPos = new Float32Array(foamCount*3)
  for(let i=0;i<foamCount;i++){const a=Math.random()*Math.PI*2,d=3+Math.random()*5;foamPos[i*3]=Math.cos(a)*d;foamPos[i*3+1]=-1.5+Math.random()*1;foamPos[i*3+2]=Math.sin(a)*d}
  const foamGeo = new THREE.BufferGeometry(); foamGeo.setAttribute('position', new THREE.BufferAttribute(foamPos, 3))
  scene.add(new THREE.Points(foamGeo, new THREE.PointsMaterial({size:0.15,color:0xffffff,transparent:true,opacity:0.2,depthWrite:false})))

  // Atmospheric fog particles
  const fogCount = 400; const fogPos = new Float32Array(fogCount*3)
  for(let i=0;i<fogCount;i++){fogPos[i*3]=(Math.random()-0.5)*50;fogPos[i*3+1]=Math.random()*5-1;fogPos[i*3+2]=(Math.random()-0.5)*50}
  const fogGeo = new THREE.BufferGeometry(); fogGeo.setAttribute('position', new THREE.BufferAttribute(fogPos, 3))
  scene.add(new THREE.Points(fogGeo, new THREE.PointsMaterial({size:0.5,color:0x88aacc,transparent:true,opacity:0.06,depthWrite:false})))

  scene.add(new THREE.AmbientLight(0x0a1520, 0.25))
  scene.add(new THREE.HemisphereLight(0x2244aa, 0x0a0a10, 0.3))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 5, maxDistance: 30, maxPolarAngle: Math.PI/2, autoRotateSpeed: 0.15 })
  const clock = new THREE.Clock(); let animId
  function animate() {
    animId = requestAnimationFrame(animate); const t = clock.getElapsedTime()
    beamGroup.rotation.y = t * 0.8
    lighthouseLight.intensity = 1.5 + Math.sin(t*8)*0.5
    // Ocean waves
    const oPos = oceanGeo.attributes.position.array
    for(let i=0;i<oPos.length;i+=3){oPos[i+2]=Math.sin(oPos[i]*0.3+t)*0.2+Math.cos(oPos[i+1]*0.2+t*0.7)*0.15}
    oceanGeo.attributes.position.needsUpdate=true
    // Foam
    const fPos = foamGeo.attributes.position.array
    for(let i=0;i<foamCount;i++){fPos[i*3+1]=-1.5+Math.sin(t*2+i)*0.3;fPos[i*3]+=Math.sin(t*0.5+i)*0.005}
    foamGeo.attributes.position.needsUpdate=true
    if(orbitControls) orbitControls.update()
    if(bloom){bloom.composer.render()}else{renderer.render(scene,camera)}
  }
  animate()
  const onResize = () => {
    const w = container.clientWidth||300, h = container.clientHeight||300
    camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h)
    if(bloom) bloom.composer.setSize(w,h)
  }
  window.addEventListener('resize', onResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Bridge Scene ── */
function createBridgeScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x1a2030, 0.012)
  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 500)
  camera.position.set(0, 8, 25)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.4, radius: 0.6, threshold: 0.85 })

  // HDRI environment
  loadHDRI('/3d-textures/sunset_dusk_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) { scene.environment = envMap; scene.background = envMap }
  })

  // Bridge deck with PBR concrete
  const deckMat = loadPBRMaterial('/3d-textures/pbr/Concrete012', renderer, { repeat: 4, normalScale: 1.0, roughness: 0.8, color: 0x666660 })
  const deckGeo = new THREE.BoxGeometry(5, 0.4, 30)
  const deck = new THREE.Mesh(deckGeo, deckMat); deck.position.y = 6; scene.add(deck)

  // Bridge towers with PBR metal
  const towerMat = loadPBRMaterial('/3d-textures/pbr/Metal025', renderer, { repeat: 1, normalScale: 1.2, roughness: 0.4, metalness: 0.8, color: 0x888888, envMapIntensity: 1.5 })
  for (let side of [-1, 1]) {
    // Main tower
    const tGeo = new THREE.BoxGeometry(0.8, 12, 0.8)
    const tower = new THREE.Mesh(tGeo, towerMat); tower.position.set(side*2, 12, 0); scene.add(tower)
    // Cross beams
    const crossGeo = new THREE.BoxGeometry(0.3, 0.3, 1.5)
    for (let h = 7; h <= 15; h += 2) {
      const cross = new THREE.Mesh(crossGeo, towerMat); cross.position.set(side*2, h, 0); scene.add(cross)
    }
  }

  // Cable system using TubeGeometry for thick cables
  const cableMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.3, metalness: 0.7 })
  for (let side of [-1, 1]) {
    for (let j = -5; j <= 5; j++) {
      const top = new THREE.Vector3(side*2, 18, 0)
      const bottom = new THREE.Vector3(side*2, 6, j*3)
      const mid = new THREE.Vector3(side*2, 12, j*1.5)
      const curve = new THREE.QuadraticBezierCurve3(top, mid, bottom)
      const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.05, 6, false)
      scene.add(new THREE.Mesh(tubeGeo, cableMat))
    }
    // Main cable (catenary)
    const mainPts = []
    for (let k = -15; k <= 15; k++) {
      const x = side*2, y = 18 - 6*Math.cos(k*Math.PI/15)*0.5, z = k
      mainPts.push(new THREE.Vector3(x,y,z))
    }
    const mainCurve = new THREE.CatmullRomCurve3(mainPts)
    const mainTubeGeo = new THREE.TubeGeometry(mainCurve, 30, 0.1, 8, false)
    scene.add(new THREE.Mesh(mainTubeGeo, cableMat))
  }

  // Animated water with wave displacement
  const waterGeo = new THREE.PlaneGeometry(100, 100, 40, 40)
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1a3344, roughness: 0.1, metalness: 0.7, envMapIntensity: 1.5 })
  const water = new THREE.Mesh(waterGeo, waterMat); water.rotation.x = -Math.PI/2; scene.add(water)

  // City skyline silhouette in background
  const skylineMat = new THREE.MeshStandardMaterial({ color: 0x0a0a15, roughness: 0.9, metalness: 0.1 })
  const skylineBuildings = [{x:-30,w:4,h:12},{x:-24,w:3,h:18},{x:-19,w:5,h:8},{x:-12,w:3,h:22},{x:-7,w:4,h:14},{x:7,w:3,h:16},{x:12,w:5,h:10},{x:19,w:3,h:20},{x:24,w:4,h:14},{x:30,w:3,h:9}]
  skylineBuildings.forEach(b => {
    const bGeo = new THREE.BoxGeometry(b.w, b.h, 3)
    const bMesh = new THREE.Mesh(bGeo, skylineMat); bMesh.position.set(b.x, b.h/2, -45); scene.add(bMesh)
    // Random lit windows
    const winLight = new THREE.PointLight(0xffaa44, 0.3, 10); winLight.position.set(b.x, b.h*0.6, -43); scene.add(winLight)
  })

  // Street lights on bridge
  for (let z = -12; z <= 12; z += 6) {
    for (let side of [-1, 1]) {
      const poleGeo = new THREE.CylinderGeometry(0.03, 0.05, 2, 6)
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5 })
      const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(side*2.2, 7, z); scene.add(pole)
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xffdd88 })
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), lampMat); lamp.position.set(side*2.2, 8, z); scene.add(lamp)
      const sl = new THREE.PointLight(0xffdd88, 0.3, 8); sl.position.set(side*2.2, 8, z); scene.add(sl)
    }
  }

  // Cars on bridge (small emissive boxes with headlights)
  const cars = []
  for (let i = 0; i < 6; i++) {
    const carMat = new THREE.MeshStandardMaterial({ color: [0xcc2222,0x2222cc,0x222222,0xcccccc,0x22cc22][i%5], roughness: 0.3, metalness: 0.5 })
    const carGeo = new THREE.BoxGeometry(0.3, 0.2, 0.8)
    const car = new THREE.Mesh(carGeo, carMat)
    const lane = i%2 === 0 ? -1.5 : 1.5
    car.position.set(lane, 6.3, -12+i*5)
    scene.add(car)
    // Headlights
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffcc })
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), hlMat)
    hl.position.set(lane, 6.35, car.position.z + (i%2===0 ? 0.4 : -0.4))
    scene.add(hl)
    cars.push(car)
  }

  scene.add(new THREE.DirectionalLight(0xffa060, 0.8).translateX(10).translateY(8).translateZ(-5))
  scene.add(new THREE.AmbientLight(0x1a2030, 0.25))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 10, maxDistance: 50, autoRotateSpeed: 0.15, enablePan: true })
  const clock = new THREE.Clock(); let animId
  function animate() {
    animId = requestAnimationFrame(animate); const t = clock.getElapsedTime()
    // Water waves
    const wPos = waterGeo.attributes.position.array
    for(let i=0;i<wPos.length;i+=3){wPos[i+2]=Math.sin(wPos[i]*0.2+t)*0.15+Math.cos(wPos[i+1]*0.15+t*0.6)*0.1}
    waterGeo.attributes.position.needsUpdate=true
    // Move cars
    cars.forEach((c,i) => {
      c.position.z += (i%2===0 ? 0.02 : -0.02)
      if(c.position.z > 15) c.position.z = -15
      if(c.position.z < -15) c.position.z = 15
    })
    if(orbitControls) orbitControls.update()
    if(bloom){bloom.composer.render()}else{renderer.render(scene,camera)}
  }
  animate()
  const onResize = () => {
    const w = container.clientWidth||300, h = container.clientHeight||300
    camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h)
    if(bloom) bloom.composer.setSize(w,h)
  }
  window.addEventListener('resize', onResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Skyscraper Scene ── */
function createSkyscraperScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x0a1020, 0.006)
  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 500)
  camera.position.set(0, 15, 30)
  const renderer = createRenderer(container)
  renderer.physicallyCorrectLights = true
  let disposed = false

  // Bloom post-processing
  const bloom = setupBloom(scene, camera, renderer, { strength: 0.6, radius: 0.7, threshold: 0.7 })

  // HDRI environment
  loadHDRI('/3d-textures/urban_night_1k.hdr', renderer).then(envMap => {
    if (disposed) return
    if (envMap) { scene.environment = envMap; scene.background = envMap }
  })

  // Building data
  const buildings = [
    {x:0,z:0,w:3,d:3,h:30},{x:-8,z:-5,w:4,d:3,h:22},{x:7,z:-3,w:3,d:4,h:25},
    {x:-4,z:6,w:3,d:3,h:18},{x:5,z:7,w:4,d:3,h:15},{x:-10,z:3,w:3,d:3,h:20},
    {x:12,z:-6,w:3,d:4,h:28},{x:-6,z:-8,w:4,d:3,h:16},{x:3,z:-9,w:3,d:3,h:24},
  ]

  // Buildings with PBR materials
  const metalMat = loadPBRMaterial('/3d-textures/pbr/Metal025', renderer, { repeat: 1, normalScale: 0.8, roughness: 0.4, metalness: 0.8, color: 0x445566, envMapIntensity: 2.0 })
  const concreteMat = loadPBRMaterial('/3d-textures/pbr/Concrete012', renderer, { repeat: 2, normalScale: 1.0, roughness: 0.7, color: 0x334455, envMapIntensity: 1.5 })
  const windowMats = [] // for animated windows

  buildings.forEach((b, idx) => {
    const bGeo = new THREE.BoxGeometry(b.w, b.h, b.d)
    // Window texture
    const wCanvas = document.createElement('canvas'); wCanvas.width = 64; wCanvas.height = 256
    const wctx = wCanvas.getContext('2d')
    wctx.fillStyle = '#0a1525'; wctx.fillRect(0, 0, 64, 256)
    for (let y = 0; y < 32; y++) for (let x = 0; x < 8; x++) {
      const lit = Math.random() > 0.4
      wctx.fillStyle = lit ? `rgba(255,${200+Math.random()*55},${100+Math.random()*80},${0.6+Math.random()*0.4})` : 'rgba(15,25,45,0.9)'
      wctx.fillRect(x*8+1, y*8+1, 6, 6)
    }
    const wTex = new THREE.CanvasTexture(wCanvas); wTex.encoding = THREE.sRGBEncoding
    const bMat = new THREE.MeshStandardMaterial({ map: wTex, roughness: 0.3, metalness: 0.6, envMapIntensity: 1.5 })
    const bMesh = new THREE.Mesh(bGeo, bMat); bMesh.position.set(b.x, b.h/2, b.z); scene.add(bMesh)
    windowMats.push({ mat: bMat, canvas: wCanvas, ctx: wctx, tex: wTex, litState: Array(256).fill(true) })

    // Glass curtain wall (front face) for tallest buildings
    if (b.h > 20) {
      const glassGeo = new THREE.PlaneGeometry(b.w*0.95, b.h*0.9)
      const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x88aacc, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3, envMapIntensity: 3.0 })
      const glass = new THREE.Mesh(glassGeo, glassMat)
      glass.position.set(b.x, b.h/2, b.z + b.d/2 + 0.02); scene.add(glass)
    }
  })

  // Ground with wet road reflection
  const groundMat = loadPBRMaterial('/3d-textures/pbr/Concrete012', renderer, { repeat: 8, normalScale: 0.5, roughness: 0.2, metalness: 0.8, color: 0x151520, envMapIntensity: 2.0 })
  const groundGeo = new THREE.PlaneGeometry(100, 100)
  const ground = new THREE.Mesh(groundGeo, groundMat); ground.rotation.x = -Math.PI/2; scene.add(ground)

  // Street-level detail: small light sources
  for (let i = 0; i < 12; i++) {
    const sl = new THREE.PointLight(0xffaa44, 0.4, 12)
    sl.position.set((Math.random()-0.5)*25, 0.5, (Math.random()-0.5)*20)
    scene.add(sl)
    const lampGeo = new THREE.SphereGeometry(0.08, 6, 6)
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 })
    const lamp = new THREE.Mesh(lampGeo, lampMat); lamp.position.copy(sl.position); scene.add(lamp)
  }

  // Car headlights at street level
  for (let i = 0; i < 5; i++) {
    const carMat = new THREE.MeshStandardMaterial({ color: [0x111111,0x222222,0x333333][i%3], roughness: 0.3, metalness: 0.5 })
    const car = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 1), carMat)
    const side = i%2===0 ? -1 : 1
    car.position.set(side*3, 0.2, -10+i*5); scene.add(car)
    const hlGeo = new THREE.SphereGeometry(0.05, 4, 4)
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffee })
    const hl = new THREE.Mesh(hlGeo, hlMat); hl.position.set(car.position.x, 0.3, car.position.z + side*0.5); scene.add(hl)
  }

  // City glow
  const cityGlowGeo = new THREE.PlaneGeometry(40, 40)
  const cityGlowMat = new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.03, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  const cityGlow = new THREE.Mesh(cityGlowGeo, cityGlowMat); cityGlow.rotation.x = -Math.PI/2; cityGlow.position.y = 0.1; scene.add(cityGlow)

  // Helipad lights on tallest building
  const tallB = buildings[0]
  for (let a = 0; a < 8; a++) {
    const angle = a/8*Math.PI*2, r = 1.2
    const hlGeo = new THREE.SphereGeometry(0.06, 4, 4)
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xff2222 })
    const hl = new THREE.Mesh(hlGeo, hlMat)
    hl.position.set(tallB.x+Math.cos(angle)*r, tallB.h+0.1, tallB.z+Math.sin(angle)*r)
    scene.add(hl)
    if (a % 2 === 0) {
      const pl = new THREE.PointLight(0xff2222, 0.3, 5)
      pl.position.copy(hl.position); scene.add(pl)
    }
  }

  scene.add(new THREE.DirectionalLight(0x334466, 0.4).translateX(5).translateY(10).translateZ(5))
  scene.add(new THREE.AmbientLight(0x0a1020, 0.25))
  scene.add(new THREE.HemisphereLight(0x1a2040, 0x050510, 0.3))

  const orbitControls = addOrbitControls(camera, renderer, { minDistance: 10, maxDistance: 60, autoRotateSpeed: 0.15, enablePan: true })
  const clock = new THREE.Clock(); let animId
  function animate() {
    animId = requestAnimationFrame(animate); const t = clock.getElapsedTime()
    // Flicker some windows every ~60 frames
    if (Math.random() < 0.02) {
      const idx = Math.floor(Math.random()*windowMats.length)
      const wm = windowMats[idx]
      const row = Math.floor(Math.random()*32), col = Math.floor(Math.random()*8)
      const lit = Math.random() > 0.3
      wm.ctx.fillStyle = lit ? `rgba(255,${200+Math.random()*55},${100+Math.random()*80},${0.6+Math.random()*0.4})` : 'rgba(15,25,45,0.9)'
      wm.ctx.fillRect(col*8+1, row*8+1, 6, 6)
      wm.tex.needsUpdate = true
    }
    if(orbitControls) orbitControls.update()
    if(bloom){bloom.composer.render()}else{renderer.render(scene,camera)}
  }
  animate()
  const onResize = () => {
    const w = container.clientWidth||300, h = container.clientHeight||300
    camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h)
    if(bloom) bloom.composer.setSize(w,h)
  }
  window.addEventListener('resize', onResize)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

const SCENE_CREATORS = {
  moon: createMoonScene,
  earth: createEarthScene,
  solar: createSolarScene,
  deepspace: createDeepSpaceScene,
  globe: createGlobeScene,
  ocean: createOceanScene,
  terrain: createTerrainScene,
  house: createHouseScene,
  museum: createMuseumScene,
  cube: createCubeScene,
  mars: createMarsScene,
  saturn: createSaturnScene,
  blackhole: createBlackHoleScene,
  galaxy: createGalaxyScene,
  asteroid: createAsteroidScene,
  volcano: createVolcanoScene,
  forest: createForestScene,
  castle: createCastleScene,
  crystal: createCrystalScene,
  jupiter: createJupiterScene,
  venus: createVenusScene,
  mercury: createMercuryScene,
  neptune: createNeptuneScene,
  uranus: createUranusScene,
  comet: createCometScene,
  supernova: createSupernovaScene,
  pulsar: createPulsarScene,
  desert: createDesertScene,
  cave: createCaveScene,
  waterfall: createWaterfallScene,
  arctic: createArcticScene,
  pyramid: createPyramidScene,
  lighthouse: createLighthouseScene,
  bridge: createBridgeScene,
  skyscraper: createSkyscraperScene,
}

/* ── Main Component ── */
export default function ThreeDClient() {
  const { t } = useTranslation()
  const [activeScene, setActiveScene] = useState('moon')
  const [activeCategory, setActiveCategory] = useState('all')
  // Hydration-safe: load saved scene from localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kivora-3d-last-scene')
      if (saved && saved !== 'moon') {
        setActiveScene(saved)
        const scene = SCENES.find(s => s.id === saved)
        if (scene?.category) setActiveCategory(scene.category)
      }
    } catch {}
  }, [])
  const [fullscreen, setFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null) // null = no error, 'NO_WEBGL' = no WebGL, 'LOAD' = script error
  const [transitioning, setTransitioning] = useState(false)
  const canvasContainerRef = useRef(null)
  const outerRef = useRef(null)
  const cleanupRef = useRef(null)

  // Initialize scene
  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return

    let cancelled = false
    let safetyTimer = null
    setLoading(true)
    setError(null)

    // Safety timeout: ensure loading goes away after max 15 seconds
    // even if scene creation hangs
    safetyTimer = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 15000)

    ensureThreeJS()
      .then(() => {
        if (cancelled) return
        // Defer scene creation with double rAF so the loading spinner
        // actually renders before the heavy synchronous work starts
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (cancelled) return
            try {
              container.innerHTML = ''
              const creator = SCENE_CREATORS[activeScene]
              if (creator) {
                cleanupRef.current = creator(container)
              }
            } catch (err) {
              console.error('3D scene creation error:', err)
              setError('LOAD')
            }
            setLoading(false)
            clearTimeout(safetyTimer)
          })
        })
      })
      .catch((err) => {
        if (cancelled) return
        console.error('3D scene error:', err)
        setError(err?.message === 'NO_WEBGL' ? 'NO_WEBGL' : 'LOAD')
        setLoading(false)
        clearTimeout(safetyTimer)
      })

    return () => {
      cancelled = true
      clearTimeout(safetyTimer)
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null }
    }
  }, [activeScene])

  // Component unmount cleanup — dispose HDRI cache and reset script flag
  useEffect(() => {
    return () => {
      clearHDRICache()
      threeLoaded = false
    }
  }, [])

  // Persist last scene to localStorage
  useEffect(() => {
    try { localStorage.setItem('kivora-3d-last-scene', activeScene) } catch {}
  }, [activeScene])

  // Handle URL scene param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sceneParam = params.get('scene')
    if (sceneParam && SCENES.some(s => s.id === sceneParam)) {
      setActiveScene(sceneParam)
      const scene = SCENES.find(s => s.id === sceneParam)
      if (scene) setActiveCategory(scene.category)
    }
  }, [])

  // Screenshot function
  const handleScreenshot = useCallback(() => {
    const canvas = canvasContainerRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `kivora-3d-${activeScene}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [activeScene])

  // Scene switch with crossfade
  const switchScene = useCallback((sceneId) => {
    if (sceneId === activeScene || transitioning) return
    setTransitioning(true)
    // Update category when switching scenes
    const scene = SCENES.find(s => s.id === sceneId)
    if (scene && activeCategory !== 'all' && scene.category !== activeCategory) {
      setActiveCategory(scene.category)
    }
    const container = canvasContainerRef.current
    if (container) {
      container.style.transition = 'opacity 0.3s ease'
      container.style.opacity = '0'
      setTimeout(() => {
        setActiveScene(sceneId)
        setTimeout(() => {
          container.style.opacity = '1'
          setTransitioning(false)
        }, 50)
      }, 300)
    } else {
      setActiveScene(sceneId)
      setTransitioning(false)
    }
  }, [activeScene, transitioning, activeCategory])

  // Fullscreen
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!fullscreen && outerRef.current) {
      outerRef.current.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }, [fullscreen])

  const handleCubeScramble = useCallback(() => { window.__cubeScramble?.() }, [])
  const handleCubeReset = useCallback(() => { window.__cubeReset?.() }, [])

  return (
    <div
      ref={outerRef}
      className={`bg-[#0a0a0a] text-white ${fullscreen ? 'fixed inset-0 z-50' : 'min-h-screen'}`}
    >
      {/* Header */}
      {!fullscreen && (
        <div className="mb-6 animate-fade-up px-4 sm:px-6 pt-2">
          <h1 className="text-display font-semibold mb-2 tracking-tight">
            3D <span className="text-red-500">Viewer</span>
          </h1>
          <p className="text-muted text-body-sm mt-0.5">
            Explore interactive 3D scenes in your browser
          </p>
        </div>
      )}

      {/* Category tabs + Scene pills */}
      {!fullscreen && (
        <div className="px-4 sm:px-6 mb-4 space-y-2">
          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {CATEGORIES.map((cat) => {
              const catColor = activeCategory === cat.id ? cat.color : undefined
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all whitespace-nowrap flex-shrink-0 ${
                    activeCategory === cat.id
                      ? 'text-[#0a0a0a] border-transparent'
                      : 'bg-[#141414] border-[#262626] text-[#737373] hover:text-white hover:border-[#3a3a3a]'
                  }`}
                  style={activeCategory === cat.id ? { background: cat.color, borderColor: cat.color } : {}}
                >
                  <cat.icon size={14} />
                  {cat.label}
                </button>
              )
            })}
          </div>

          {/* Scene pills for active category */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {(activeCategory === 'all' ? SCENES : SCENES.filter(s => s.category === activeCategory)).map((scene) => (
              <button
                key={scene.id}
                onClick={() => switchScene(scene.id)}
                title={scene.label}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-all whitespace-nowrap flex-shrink-0 ${
                  activeScene === scene.id
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-[#141414] border-[#262626] text-[#737373] hover:text-white hover:border-[#3a3a3a]'
                }`}
              >
                <scene.icon size={14} />
                {scene.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons row */}
      {!fullscreen ? (
        <div className="px-4 sm:px-6 mb-4 flex items-center gap-2">
          {activeScene === 'cube' && (
            <div className="flex items-center gap-1.5">
              <button onClick={handleCubeScramble} className="text-[10px] px-3 py-1.5 rounded-full bg-[#141414] border border-[#262626] text-[#737373] hover:text-white hover:border-[#3a3a3a] transition-all uppercase tracking-wider font-medium">Scramble</button>
              <button onClick={handleCubeReset} className="text-[10px] px-3 py-1.5 rounded-full bg-[#141414] border border-[#262626] text-[#737373] hover:text-white hover:border-[#3a3a3a] transition-all uppercase tracking-wider font-medium">Reset</button>
            </div>
          )}
          <div className="flex-1" />
          <button
            onClick={handleScreenshot}
            title="Save screenshot"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-[#141414] border-[#262626] text-[#737373] hover:text-white hover:border-[#3a3a3a] transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Save
          </button>
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-[#141414] border-[#262626] text-[#737373] hover:text-white hover:border-[#3a3a3a] transition-all"
          >
            <IconMaximize size={12} />
            Fullscreen
          </button>
        </div>
      ) : (
        /* Floating exit fullscreen button */
        <div className="absolute top-3 left-3 z-20">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-[#0a0a0a]/80 backdrop-blur-md border-[#262626] text-white hover:bg-[#1a1a1a] transition-all"
          >
            <IconMinimize size={12} />
            Exit
          </button>
        </div>
      )}

      {/* 3D Canvas container */}
      <div className={`${fullscreen ? 'h-screen' : 'h-[calc(100vh-260px)] sm:h-[calc(100vh-200px)] lg:h-[calc(100vh-180px)]'} relative bg-black`}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80 pointer-events-none">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-[#525252] tracking-wider">Loading 3D...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-[#111111] rounded-xl flex items-center justify-center mx-auto mb-4">
                <IconEye size={20} className="text-red-400" />
              </div>
              {error === 'NO_WEBGL' ? (
                <>
                  <p className="text-sm text-[#737373] mb-1">3D Viewer requires WebGL</p>
                  <p className="text-xs text-[#404040]">Try Chrome, Edge, or Firefox</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-[#737373] mb-1">Failed to load 3D scene</p>
                  <p className="text-xs text-[#404040]">Try refreshing the page</p>
                </>
              )}
            </div>
          </div>
        )}
        <div ref={canvasContainerRef} className="w-full h-full" />

        {/* Scene info overlay */}
        <div className="absolute bottom-3 left-3 bg-[#0a0a0a]/70 backdrop-blur-md border border-[#1a1a1a] rounded-lg px-3 py-2 pointer-events-none max-w-[200px] sm:max-w-[260px]">
          <p className="text-[11px] font-semibold text-white/80 mb-0.5">{SCENES.find(s => s.id === activeScene)?.label}</p>
          <p className="text-[10px] text-[#737373] leading-relaxed">{SCENES.find(s => s.id === activeScene)?.description}</p>
        </div>

        {/* WebGL status */}
        <div className="absolute top-3 right-3 pointer-events-none">
          <div className="flex items-center gap-1.5 bg-[#0a0a0a]/70 backdrop-blur-md border border-[#1a1a1a] rounded-full px-2.5 py-1">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-[#525252]">WebGL</span>
          </div>
        </div>
      </div>
    </div>
  )
}
