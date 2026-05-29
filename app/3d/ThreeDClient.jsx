'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import { IconEye, IconMaximize, IconMinimize, IconBuild, IconGrid, IconPlanet, IconNebula, IconNature, IconBuildings, IconMoon, IconEarth, IconSun, IconGlobe, IconTelescope, IconWaves, IconMountain, IconHome, IconMuseum, IconCube, IconMars, IconSaturn, IconBlackHole, IconGalaxy, IconAsteroid, IconVolcano, IconForest, IconCastle, IconCrystal } from '@/components/Icons'
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

let threeLoaded = false
async function ensureThreeJS() {
  if (threeLoaded && window.THREE) return
  await loadScript('/3d-lib/three.min.js')
  await loadScript('/3d-lib/OrbitControls.js')
  threeLoaded = true
}

/* ── Helper: create standard renderer ── */
function createRenderer(container) {
  const THREE = window.THREE
  const width = container.clientWidth || 300
  const height = container.clientHeight || 300
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.outputEncoding = THREE.sRGBEncoding
  container.appendChild(renderer.domElement)
  return renderer
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
          m.dispose()
        })
      } else {
        if (obj.material.map) obj.material.map.dispose()
        if (obj.material.bumpMap) obj.material.bumpMap.dispose()
        if (obj.material.specularMap) obj.material.specularMap.dispose()
        if (obj.material.emissiveMap) obj.material.emissiveMap.dispose()
        obj.material.dispose()
      }
    }
  })
  scene.clear()
  renderer.dispose()
  renderer.forceContextLoss()
  if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
}

/* ── Moon Scene ── */
function createMoonScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000005)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000)
  camera.position.set(0, 0, 4.5)
  const renderer = createRenderer(container)
  let disposed = false

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
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
  let disposed = false

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Solar System Scene ── */
function createSolarScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000003)
  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 2000)
  camera.position.set(0, 18, 30)
  const renderer = createRenderer(container)

  // Sun
  const sunGeo = new THREE.SphereGeometry(2, 64, 64)
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 })
  const sunMesh = new THREE.Mesh(sunGeo, sunMat)
  scene.add(sunMesh)

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Deep Space Scene ── */
function createDeepSpaceScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000); scene.fog = new THREE.FogExp2(0x000000, 0.003)
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000); camera.position.set(0, 1, 12)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 1.4
  let disposed = false

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('touchmove', onTouchMove); document.removeEventListener('wheel', onWheel); fullCleanup(scene, renderer, null) }
}

/* ── Globe Scene ── */
function createGlobeScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000)
  camera.position.z = 4
  const renderer = createRenderer(container)
  let disposed = false

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Ocean Scene ── */
function createOceanScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 500)
  camera.position.set(0, 5, 15)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 1.3

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Cube Scene ── */
function createCubeScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x050505)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100); camera.position.set(8, 6, 10)
  const renderer = createRenderer(container)
  renderer.toneMappingExposure = 1.1
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap

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
    updateCamera(); renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls); delete window.__cubeScramble; delete window.__cubeReset }
}

/* ── House Scene ── */
function createHouseScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a2a3a)
  scene.fog = new THREE.FogExp2(0x1a2a3a, 0.015)
  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 200)
  camera.position.set(14, 10, 18)
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.outputEncoding = THREE.sRGBEncoding
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Mars Scene ── */
function createMarsScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a0805)
  const camera = new THREE.PerspectiveCamera(45, (container.clientWidth || 300) / (container.clientHeight || 300), 0.1, 2000)
  camera.position.set(0, 0, 4.5)
  const renderer = createRenderer(container)
  let disposed = false

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}

/* ── Saturn Scene ── */
function createSaturnScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050510)
  const camera = new THREE.PerspectiveCamera(45, (container.clientWidth || 300) / (container.clientHeight || 300), 0.1, 2000)
  camera.position.set(0, 3, 8)
  const renderer = createRenderer(container)
  let disposed = false

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
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
  let disposed = false

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
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
  let disposed = false

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
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
  let disposed = false

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
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
  let disposed = false

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
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
  let disposed = false

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
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
  let disposed = false

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
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
  let disposed = false

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
    renderer.render(scene, camera)
  }
  animate()

  const onResize = addResizeHandler(camera, renderer, container)
  return () => { disposed = true; cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); fullCleanup(scene, renderer, orbitControls) }
}
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
}

/* ── Main Component ── */
export default function ThreeDClient() {
  const { t } = useTranslation()
  const [activeScene, setActiveScene] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('kivora-3d-last-scene') || 'moon' } catch { return 'moon' }
    }
    return 'moon'
  })
  const [activeCategory, setActiveCategory] = useState(() => {
    // Derive category from the active scene
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('kivora-3d-last-scene') || 'moon'
        const scene = SCENES.find(s => s.id === saved)
        return scene?.category || 'all'
      } catch { return 'all' }
    }
    return 'all'
  })
  const [fullscreen, setFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
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
    setError(false)

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
              setError(true)
            }
            setLoading(false)
            clearTimeout(safetyTimer)
          })
        })
      })
      .catch((err) => {
        if (cancelled) return
        console.error('3D scene error:', err)
        setError(true)
        setLoading(false)
        clearTimeout(safetyTimer)
      })

    return () => {
      cancelled = true
      clearTimeout(safetyTimer)
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null }
    }
  }, [activeScene])

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
              <p className="text-sm text-[#737373] mb-1">3D Viewer requires WebGL</p>
              <p className="text-xs text-[#404040]">Try Chrome, Edge, or Firefox</p>
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
