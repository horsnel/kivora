'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import { IconEye, IconMaximize, IconMinimize } from '@/components/Icons'

const SCENES = [
  {
    id: 'moon',
    label: 'Moon',
    description: 'Interactive 3D Moon with procedural textures and NASA data',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
      </svg>
    ),
  },
  {
    id: 'deepspace',
    label: 'Deep Space',
    description: 'Nebula exploration with Hubble telescope imagery',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="12" r="6" strokeDasharray="2 3" />
        <circle cx="12" cy="12" r="10" strokeDasharray="1 4" />
      </svg>
    ),
  },
  {
    id: 'cube',
    label: "Rubik's Cube",
    description: "Interactive 3x3 Rubik's Cube with face rotation",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
      </svg>
    ),
  },
]

/* ── Load Three.js + OrbitControls from local files ── */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') { reject('No window'); return }
    // Check if already loaded
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

/* ── Moon Scene ── */
function createMoonScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000005)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 2000)
  camera.position.set(0, 0, 4.5)
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.outputEncoding = THREE.sRGBEncoding
  container.appendChild(renderer.domElement)

  // Procedural color texture
  const colorCanvas = document.createElement('canvas'); colorCanvas.width = 2048; colorCanvas.height = 1024
  const ctx = colorCanvas.getContext('2d')
  ctx.fillStyle = '#9a9a9a'; ctx.fillRect(0, 0, 2048, 1024)
  for (let i = 0; i < 5000; i++) {
    const x = Math.random()*2048, y = Math.random()*1024, r = Math.random()*3+0.5, v = Math.floor(Math.random()*40+110)
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=`rgb(${v},${v},${v})`; ctx.fill()
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.random()*2048, y = Math.random()*1024, r = Math.random()*60+10, v = Math.floor(Math.random()*30+120)
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=`rgba(${v},${v},${v},0.6)`; ctx.fill()
    ctx.strokeStyle=`rgba(${v+20},${v+20},${v+20},0.3)`; ctx.lineWidth=2; ctx.stroke()
    for (let j = 0; j < 8; j++) {
      const angle=(j/8)*Math.PI*2+Math.random()*0.5, len=r*(2+Math.random()*3)
      ctx.beginPath(); ctx.moveTo(x+Math.cos(angle)*r,y+Math.sin(angle)*r)
      ctx.lineTo(x+Math.cos(angle)*len,y+Math.sin(angle)*len)
      ctx.strokeStyle=`rgba(${v+15},${v+15},${v+15},0.15)`; ctx.lineWidth=1+Math.random()*2; ctx.stroke()
    }
  }
  const maria=[{x:600,y:500,rx:280,ry:200},{x:1100,y:450,rx:180,ry:140},{x:1400,y:550,rx:150,ry:100},{x:950,y:700,rx:120,ry:90},{x:1300,y:750,rx:100,ry:80},{x:450,y:350,rx:90,ry:70},{x:1600,y:400,rx:80,ry:60},{x:1700,y:650,rx:70,ry:50}]
  maria.forEach(m=>{ctx.beginPath();ctx.ellipse(m.x,m.y,m.rx,m.ry,Math.random()*Math.PI,0,Math.PI*2);ctx.fillStyle=`rgba(45,45,50,${0.5+Math.random()*0.3})`;ctx.fill();ctx.strokeStyle='rgba(70,70,75,0.2)';ctx.lineWidth=3;ctx.stroke()})
  for(let i=0;i<800;i++){const x=Math.random()*2048,y=Math.random()*1024,r=Math.random()*8+2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=`rgba(${Math.floor(80+Math.random()*40)},${Math.floor(80+Math.random()*40)},${Math.floor(85+Math.random()*40)},0.4)`;ctx.fill();ctx.strokeStyle='rgba(140,140,145,0.25)';ctx.lineWidth=1;ctx.stroke()}
  const colorTex=new THREE.CanvasTexture(colorCanvas);colorTex.encoding=THREE.sRGBEncoding

  // Procedural bump
  const bumpCanvas = document.createElement('canvas'); bumpCanvas.width = 2048; bumpCanvas.height = 1024
  const bctx = bumpCanvas.getContext('2d')
  bctx.fillStyle='#808080'; bctx.fillRect(0,0,2048,1024)
  for(let i=0;i<3000;i++){const x=Math.random()*2048,y=Math.random()*1024,r=Math.random()*20+2,v=Math.floor(Math.random()*40+100);bctx.beginPath();bctx.arc(x,y,r,0,Math.PI*2);bctx.fillStyle=`rgba(${v},${v},${v},0.15)`;bctx.fill()}
  for(let i=0;i<150;i++){const x=Math.random()*2048,y=Math.random()*1024,r=Math.random()*50+5;bctx.beginPath();bctx.arc(x,y,r,0,Math.PI*2);bctx.strokeStyle=`rgba(220,220,220,${0.3+Math.random()*0.3})`;bctx.lineWidth=3+Math.random()*3;bctx.stroke();bctx.beginPath();bctx.arc(x,y,r*0.7,0,Math.PI*2);bctx.fillStyle=`rgba(30,30,30,${0.3+Math.random()*0.3})`;bctx.fill()}
  const bumpTex = new THREE.CanvasTexture(bumpCanvas)

  const moonGeometry = new THREE.SphereGeometry(1.2, 128, 128)
  const moonMaterial = new THREE.MeshStandardMaterial({ map: colorTex, bumpMap: bumpTex, bumpScale: 0.04, roughness: 0.95, metalness: 0.0, color: 0xdddddd })
  const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial)
  moonMesh.rotation.y = -Math.PI / 2
  scene.add(moonMesh)

  // Starfield
  const starCount = 6000; const starPos = new Float32Array(starCount*3); const starCols = new Float32Array(starCount*3)
  for(let i=0;i<starCount;i++){const i3=i*3,r=80+Math.random()*400,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);starPos[i3]=r*Math.sin(phi)*Math.cos(theta);starPos[i3+1]=r*Math.sin(phi)*Math.sin(theta);starPos[i3+2]=r*Math.cos(phi);const t=Math.random();if(t>0.92){starCols[i3]=0.75;starCols[i3+1]=0.80;starCols[i3+2]=1.0}else if(t>0.85){starCols[i3]=1.0;starCols[i3+1]=0.92;starCols[i3+2]=0.75}else{starCols[i3]=1.0;starCols[i3+1]=1.0;starCols[i3+2]=1.0}}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));starGeo.setAttribute('color',new THREE.BufferAttribute(starCols,3))
  const starMat=new THREE.PointsMaterial({size:0.7,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.8,depthWrite:false})
  const starField=new THREE.Points(starGeo,starMat);scene.add(starField)

  // Lights
  const sunLight=new THREE.DirectionalLight(0xfff5e6,2.5);sunLight.position.set(5,3,5);scene.add(sunLight)
  scene.add(new THREE.AmbientLight(0x1a1a2e,0.15))
  const earthShine=new THREE.DirectionalLight(0x4466aa,0.08);earthShine.position.set(-5,-2,-3);scene.add(earthShine)

  // Try loading NASA textures
  const textureLoader=new THREE.TextureLoader();textureLoader.crossOrigin='anonymous'
  textureLoader.load('https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg',(tex)=>{tex.encoding=THREE.sRGBEncoding;tex.anisotropy=renderer.capabilities.getMaxAnisotropy();moonMaterial.map=tex;moonMaterial.needsUpdate=true},undefined,()=>{})
  textureLoader.load('https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_3_8bit.jpg',(tex)=>{tex.anisotropy=renderer.capabilities.getMaxAnisotropy();moonMaterial.bumpMap=tex;moonMaterial.needsUpdate=true},undefined,()=>{})

  // Controls
  let orbitControls
  if(THREE.OrbitControls){orbitControls=new THREE.OrbitControls(camera,renderer.domElement);orbitControls.enableDamping=true;orbitControls.dampingFactor=0.05;orbitControls.enablePan=false;orbitControls.minDistance=2;orbitControls.maxDistance=15;orbitControls.rotateSpeed=0.5;orbitControls.zoomSpeed=0.8;orbitControls.autoRotate=true;orbitControls.autoRotateSpeed=0.3;let autoTimer;orbitControls.addEventListener('start',()=>{orbitControls.autoRotate=false});orbitControls.addEventListener('end',()=>{clearTimeout(autoTimer);autoTimer=setTimeout(()=>{orbitControls.autoRotate=true},5000)})}

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

  const onResize = () => { camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight) }
  window.addEventListener('resize', onResize)

  return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); renderer.dispose(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement) }
}

/* ── Deep Space Scene ── */
function createDeepSpaceScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000); scene.fog = new THREE.FogExp2(0x000000, 0.003)
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000); camera.position.set(0, 1, 12)
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setSize(container.clientWidth, container.clientHeight); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.4; renderer.outputEncoding = THREE.sRGBEncoding
  container.appendChild(renderer.domElement)

  const textureLoader = new THREE.TextureLoader(); textureLoader.crossOrigin = 'anonymous'
  const NEBULA_URLS = ['https://cdn.esahubble.org/archives/images/screen/heic1509a.jpg','https://cdn.esahubble.org/archives/images/screen/heic0910h.jpg','https://cdn.esahubble.org/archives/images/screen/heic0109a.jpg']
  const nebulaPlanes = []
  function createNebulaPlane(url, z, scale, opacity, rotation) {
    const geo = new THREE.PlaneGeometry(scale, scale, 1, 1)
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    const mesh = new THREE.Mesh(geo, mat); mesh.position.z = z; mesh.rotation.z = rotation || 0; scene.add(mesh); nebulaPlanes.push(mesh)
    textureLoader.load(url, (tex) => { tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); mat.map = tex; mat.opacity = opacity; mat.needsUpdate = true }, undefined, () => {})
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

  // Stars
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

  const onResize = () => { camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight) }
  window.addEventListener('resize', onResize)

  return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('touchmove', onTouchMove); document.removeEventListener('wheel', onWheel); renderer.dispose(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement) }
}

/* ── Cube Scene ── */
function createCubeScene(container) {
  const THREE = window.THREE
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x050505)
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100); camera.position.set(8, 6, 10)
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setSize(container.clientWidth, container.clientHeight); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.outputEncoding = THREE.sRGBEncoding
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

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

  // Expose scramble/reset to window for React buttons
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

  const onResize = () => { camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight) }
  window.addEventListener('resize', onResize)

  return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); renderer.dispose(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement); delete window.__cubeScramble; delete window.__cubeReset }
}

const SCENE_CREATORS = {
  moon: createMoonScene,
  deepspace: createDeepSpaceScene,
  cube: createCubeScene,
}

/* ── Main Component ── */
export default function ThreeDClient() {
  const { t } = useTranslation()
  const [activeScene, setActiveScene] = useState('moon')
  const [fullscreen, setFullscreen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const canvasContainerRef = useRef(null)
  const outerRef = useRef(null)
  const cleanupRef = useRef(null)

  // Initialize scene
  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return

    let cancelled = false
    setLoading(true)
    setError(false)

    ensureThreeJS()
      .then(() => {
        if (cancelled) return
        // Clear previous canvas
        container.innerHTML = ''
        const creator = SCENE_CREATORS[activeScene]
        if (creator) {
          cleanupRef.current = creator(container)
        }
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('3D scene error:', err)
        setError(true)
        setLoading(false)
      })

    return () => {
      cancelled = true
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null }
    }
  }, [activeScene])

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
      {/* Header bar */}
      <div className="border-b border-[#1a1a1a] bg-[#0a0a0a]/95 backdrop-blur-md z-20 relative">
        <div className="max-w-full mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center">
              <IconEye size={14} className="text-white" />
            </div>
            <h1 className="font-bold text-sm tracking-tight">
              3D <span className="text-red-500">Viewer</span>
            </h1>
          </div>

          {/* Scene tabs */}
          <div className="hidden sm:flex items-center gap-1 bg-[#111111] rounded-lg p-0.5 border border-[#1a1a1a]">
            {SCENES.map((scene) => (
              <button
                key={scene.id}
                onClick={() => setActiveScene(scene.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  activeScene === scene.id
                    ? 'bg-[#dc2626] text-white shadow-sm'
                    : 'text-[#737373] hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                {scene.icon}
                {scene.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Cube-specific buttons */}
            {activeScene === 'cube' && (
              <div className="hidden sm:flex items-center gap-1.5">
                <button onClick={handleCubeScramble} className="text-[10px] px-2.5 py-1 rounded bg-[#111111] border border-[#1a1a1a] text-[#737373] hover:text-white hover:border-[#2a2a2a] transition-colors uppercase tracking-wider">Scramble</button>
                <button onClick={handleCubeReset} className="text-[10px] px-2.5 py-1 rounded bg-[#111111] border border-[#1a1a1a] text-[#737373] hover:text-white hover:border-[#2a2a2a] transition-colors uppercase tracking-wider">Reset</button>
              </div>
            )}
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 bg-[#111111] border border-[#1a1a1a] hover:border-[#2a2a2a] text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              {fullscreen ? <IconMinimize size={12} /> : <IconMaximize size={12} />}
              {fullscreen ? 'Exit' : 'Fullscreen'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile scene selector */}
      <div className="sm:hidden border-b border-[#1a1a1a] bg-[#0d0d0d] p-2 flex gap-1.5 overflow-x-auto">
        {SCENES.map((scene) => (
          <button
            key={scene.id}
            onClick={() => setActiveScene(scene.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
              activeScene === scene.id
                ? 'bg-[#dc2626] text-white'
                : 'bg-[#111111] text-[#737373] hover:text-white border border-[#1a1a1a]'
            }`}
          >
            {scene.icon}
            {scene.label}
          </button>
        ))}
      </div>

      {/* Cube mobile buttons */}
      {activeScene === 'cube' && (
        <div className="sm:hidden flex gap-2 p-2 border-b border-[#1a1a1a] bg-[#0d0d0d]">
          <button onClick={handleCubeScramble} className="flex-1 text-[10px] py-1.5 rounded bg-[#111111] border border-[#1a1a1a] text-[#737373] hover:text-white transition-colors uppercase tracking-wider">Scramble</button>
          <button onClick={handleCubeReset} className="flex-1 text-[10px] py-1.5 rounded bg-[#111111] border border-[#1a1a1a] text-[#737373] hover:text-white transition-colors uppercase tracking-wider">Reset</button>
        </div>
      )}

      {/* 3D Canvas container */}
      <div className={`${fullscreen ? 'h-[calc(100vh-48px)]' : 'h-[calc(100vh-96px)] sm:h-[calc(100vh-48px)]'} relative bg-black`}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80">
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
        <div className="absolute bottom-3 left-3 bg-[#0a0a0a]/70 backdrop-blur-md border border-[#1a1a1a] rounded-lg px-3 py-2 pointer-events-none max-w-[260px]">
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