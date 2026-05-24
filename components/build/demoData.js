// Demo data for the 3D Gamified Build System
// Hardcoded — no database calls

export const PROJECTS = [
  {
    id: 'red-house',
    title: 'The Red House',
    community: '@architects',
    status: 'ongoing', // ongoing | completed | joinable
    completedParts: 12,
    totalParts: 24,
    builders: 8,
    gradient: 'from-red-900/40 via-orange-900/30 to-yellow-900/20',
    accentColor: '#dc2626',
  },
  {
    id: 'neo-tokyo',
    title: 'Neo Tokyo Town',
    community: '@scifi_builders',
    status: 'completed',
    completedParts: 48,
    totalParts: 48,
    builders: 24,
    gradient: 'from-purple-900/40 via-blue-900/30 to-cyan-900/20',
    accentColor: '#a855f7',
  },
  {
    id: 'mars-base',
    title: 'Mars Base Alpha',
    community: '@space_devs',
    status: 'joinable',
    completedParts: 3,
    totalParts: 20,
    builders: 2,
    gradient: 'from-orange-900/40 via-red-900/30 to-amber-900/20',
    accentColor: '#ea580c',
  },
  {
    id: 'crystal-palace',
    title: 'Crystal Palace',
    community: '@fantasy_guild',
    status: 'ongoing',
    completedParts: 18,
    totalParts: 30,
    builders: 12,
    gradient: 'from-teal-900/40 via-emerald-900/30 to-green-900/20',
    accentColor: '#00C9A7',
  },
  {
    id: 'ocean-pavilion',
    title: 'Ocean Pavilion',
    community: '@nature_builders',
    status: 'ongoing',
    completedParts: 7,
    totalParts: 15,
    builders: 5,
    gradient: 'from-blue-900/40 via-sky-900/30 to-indigo-900/20',
    accentColor: '#3b82f6',
  },
  {
    id: 'sky-tower',
    title: 'Sky Tower',
    community: '@tower_crew',
    status: 'joinable',
    completedParts: 1,
    totalParts: 12,
    builders: 1,
    gradient: 'from-slate-900/40 via-gray-900/30 to-zinc-900/20',
    accentColor: '#94a3b8',
  },
]

// Parts for "The Red House" project
export const RED_HOUSE_PARTS = [
  { id: 'foundation', name: 'Foundation', status: 'completed', color: 0x8B6914, builder: 'Alex' },
  { id: 'front-wall', name: 'Front Wall', status: 'completed', color: 0xD2B48C, builder: 'Maya' },
  { id: 'back-wall', name: 'Back Wall', status: 'completed', color: 0xD2B48C, builder: 'Maya' },
  { id: 'left-wall', name: 'Left Wall', status: 'completed', color: 0xD2B48C, builder: 'Kofi' },
  { id: 'right-wall', name: 'Right Wall', status: 'completed', color: 0xD2B48C, builder: 'Kofi' },
  { id: 'roof', name: 'Roof', status: 'completed', color: 0x8B1A1A, builder: 'Alex' },
  { id: 'door', name: 'Door', status: 'incomplete', color: 0x8B4513 },
  { id: 'window-left', name: 'Window Left', status: 'incomplete', color: 0x87CEEB },
  { id: 'window-right', name: 'Window Right', status: 'locked', color: 0x87CEEB, requires: 'door' },
  { id: 'garage', name: 'Garage', status: 'locked', color: 0xA0A0A0, requires: 'door' },
  { id: 'chimney', name: 'Chimney', status: 'completed', color: 0x4A4A4A, builder: 'Sam' },
  { id: 'porch', name: 'Porch', status: 'incomplete', color: 0xDEB887 },
]

// 3D positions for each part
export const PART_POSITIONS = {
  foundation:  { x: 0,    y: 0,    z: 0,    w: 4,   h: 0.3, d: 3.5 },
  'front-wall':{ x: 0,    y: 1.15, z: 1.75, w: 4,   h: 2,   d: 0.15 },
  'back-wall': { x: 0,    y: 1.15, z: -1.75,w: 4,   h: 2,   d: 0.15 },
  'left-wall': { x: -2,   y: 1.15, z: 0,    w: 0.15,h: 2,   d: 3.5 },
  'right-wall':{ x: 2,    y: 1.15, z: 0,    w: 0.15,h: 2,   d: 3.5 },
  roof:        { x: 0,    y: 2.8,  z: 0,    w: 4.8, h: 0.15,d: 4.2, isRoof: true },
  door:        { x: 0,    y: 0.95, z: 1.83, w: 0.8, h: 1.9, d: 0.1 },
  'window-left':{ x: -1.2,y: 1.3,  z: 1.83, w: 0.6, h: 0.8, d: 0.1 },
  'window-right':{ x: 1.2,y: 1.3,  z: 1.83, w: 0.6, h: 0.8, d: 0.1 },
  garage:      { x: 3,    y: 0.9,  z: 0,    w: 2,   h: 1.8, d: 2.5 },
  chimney:     { x: 1,    y: 3.2,  z: -0.5, w: 0.4, h: 0.8, d: 0.4 },
  porch:       { x: 0,    y: 0.05, z: 2.5,  w: 3,   h: 0.1, d: 1.2 },
}

export const DOOR_TEMPLATES = [
  { id: 'classic', name: 'Door A: Classic', description: 'Traditional wooden door with panels', color: '#8B4513' },
  { id: 'modern', name: 'Door B: Modern', description: 'Sleek modern door with clean lines', color: '#6B7280' },
  { id: 'glass', name: 'Door C: Glass', description: 'Glass door with metal frame', color: '#87CEEB' },
  { id: 'sliding', name: 'Door D: Sliding', description: 'Sliding barn door style', color: '#A0522D' },
]

export function getProject(id) {
  return PROJECTS.find(p => p.id === id) || null
}

export function getProjectParts(projectId) {
  if (projectId === 'red-house') return RED_HOUSE_PARTS
  const project = getProject(projectId)
  if (!project) return []
  const parts = []
  for (let i = 0; i < project.totalParts; i++) {
    parts.push({
      id: `part-${i + 1}`,
      name: `Part ${i + 1}`,
      status: i < project.completedParts ? 'completed' : (i < project.completedParts + 2 ? 'incomplete' : 'locked'),
      color: 0x888888,
      builder: i < project.completedParts ? 'Builder' : undefined,
    })
  }
  return parts
}
