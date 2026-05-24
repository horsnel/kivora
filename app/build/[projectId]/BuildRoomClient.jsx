'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { IconBuild, IconPlay, IconCode, IconBulb, IconCheck, IconArrowLeft, IconEye, IconFolder, IconStar } from '@/components/Icons'

// ── Project definitions (shared with BuildClient) ──
const PROJECTS = {
  'lunar-base': {
    id: 'lunar-base', name: 'Lunar Base Alpha', scene: 'moon', accent: '#94a3b8',
    description: 'Build a modular Moon base with habitat modules, solar arrays, and rover docking stations.',
    difficulty: 'Beginner', category: 'Space',
    parts: [
      { id: 'habitat', name: 'Habitat Module', description: 'Pressurized living quarters with life support systems', status: 'complete', builder: 'You' },
      { id: 'solar-arrays', name: 'Solar Arrays', description: 'Photovoltaic panels for power generation', status: 'complete', builder: 'You' },
      { id: 'rover-bay', name: 'Rover Docking Bay', description: 'Garage and charging station for lunar rovers', status: 'available', builder: null },
      { id: 'comm-tower', name: 'Communications Tower', description: 'High-gain antenna array for Earth communication', status: 'available', builder: null },
      { id: 'airlock', name: 'Airlock Chamber', description: 'Dual-chamber airlock for EVA operations', status: 'available', builder: null },
    ],
  },
  'earth-observatory': {
    id: 'earth-observatory', name: 'Earth Observatory', scene: 'earth', accent: '#3b82f6',
    description: 'Construct an orbital station with telescopes, comms arrays, and research labs.',
    difficulty: 'Intermediate', category: 'Space',
    parts: [
      { id: 'telescope', name: 'Main Telescope', description: 'High-resolution optical telescope for Earth observation', status: 'available', builder: null },
      { id: 'comms-array', name: 'Communications Array', description: 'Satellite relay system for data transmission', status: 'available', builder: null },
      { id: 'research-lab', name: 'Research Laboratory', description: 'Zero-gravity research facility', status: 'in-progress', builder: 'You' },
      { id: 'solar-panels', name: 'Solar Panel Wings', description: 'Deployable solar arrays for power', status: 'available', builder: null },
      { id: 'docking-port', name: 'Docking Port', description: 'Universal docking mechanism for supply ships', status: 'available', builder: null },
      { id: 'crew-quarters', name: 'Crew Quarters', description: 'Living space for 6 crew members', status: 'available', builder: null },
    ],
  },
  'solar-cruiser': {
    id: 'solar-cruiser', name: 'Solar Cruiser', scene: 'solar', accent: '#f59e0b',
    description: 'Design and assemble a multi-planet spacecraft with engine modules and crew quarters.',
    difficulty: 'Advanced', category: 'Space',
    parts: [
      { id: 'ion-drive', name: 'Ion Drive Engine', description: 'High-efficiency ion propulsion system', status: 'complete', builder: 'You' },
      { id: 'crew-module', name: 'Crew Module', description: 'Rotating habitat ring with artificial gravity', status: 'available', builder: null },
      { id: 'nav-computer', name: 'Navigation Computer', description: 'AI-powered navigation and course plotting', status: 'available', builder: null },
      { id: 'shield-gen', name: 'Shield Generator', description: 'Electromagnetic radiation shielding', status: 'available', builder: null },
      { id: 'cargo-bay', name: 'Cargo Bay', description: 'Modular cargo storage system', status: 'available', builder: null },
      { id: 'science-deck', name: 'Science Deck', description: 'Onboard laboratory and analysis suite', status: 'available', builder: null },
      { id: 'bridge', name: 'Command Bridge', description: 'Central command and control center', status: 'available', builder: null },
      { id: 'life-support', name: 'Life Support System', description: 'Atmospheric processing and water recycling', status: 'available', builder: null },
    ],
  },
  'nebula-lab': {
    id: 'nebula-lab', name: 'Nebula Lab', scene: 'deepspace', accent: '#a855f7',
    description: 'Build a deep-space research facility inside a nebula with sensor arrays and dark matter detectors.',
    difficulty: 'Advanced', category: 'Research',
    parts: [
      { id: 'sensor-array', name: 'Sensor Array', description: 'Multi-spectrum sensor suite for nebula analysis', status: 'available', builder: null },
      { id: 'dark-matter', name: 'Dark Matter Detector', description: 'Experimental dark matter detection chamber', status: 'available', builder: null },
      { id: 'plasma-shield', name: 'Plasma Shield', description: 'Protective barrier against nebula radiation', status: 'available', builder: null },
      { id: 'quantum-lab', name: 'Quantum Lab', description: 'Quantum computing research facility', status: 'available', builder: null },
      { id: 'warp-beacon', name: 'Warp Beacon', description: 'Faster-than-light communication relay', status: 'available', builder: null },
      { id: 'hab-dome', name: 'Habitat Dome', description: 'Self-sustaining biosphere for crew', status: 'available', builder: null },
      { id: 'mining-drone', name: 'Mining Drone Bay', description: 'Automated resource extraction drones', status: 'available', builder: null },
    ],
  },
  'global-network': {
    id: 'global-network', name: 'Global Network Hub', scene: 'globe', accent: '#10b981',
    description: 'Construct a worldwide data network with fiber nodes, satellite links, and server clusters.',
    difficulty: 'Intermediate', category: 'Infrastructure',
    parts: [
      { id: 'fiber-core', name: 'Fiber Core', description: 'Transcontinental fiber optic backbone', status: 'complete', builder: 'You' },
      { id: 'sat-link', name: 'Satellite Link', description: 'Low-orbit satellite uplink system', status: 'complete', builder: 'You' },
      { id: 'server-farm', name: 'Server Cluster', description: 'Distributed computing cluster with edge nodes', status: 'complete', builder: 'You' },
      { id: 'noc', name: 'Network Operations Center', description: '24/7 monitoring and management hub', status: 'available', builder: null },
      { id: 'cdn-node', name: 'CDN Edge Node', description: 'Content delivery network edge server', status: 'available', builder: null },
      { id: 'security-hub', name: 'Security Hub', description: 'AI-powered threat detection and response', status: 'available', builder: null },
    ],
  },
  'ocean-rig': {
    id: 'ocean-rig', name: 'Deep Ocean Rig', scene: 'ocean', accent: '#0ea5e9',
    description: 'Build an underwater research platform with submersible bays, sonar arrays, and living quarters.',
    difficulty: 'Intermediate', category: 'Research',
    parts: [
      { id: 'pressure-hull', name: 'Pressure Hull', description: 'Reinforced titanium hull for deep-sea operations', status: 'available', builder: null },
      { id: 'sonar-array', name: 'Sonar Array', description: 'Multi-beam sonar mapping system', status: 'available', builder: null },
      { id: 'sub-bay', name: 'Submersible Bay', description: 'Deployable submarine docking facility', status: 'available', builder: null },
      { id: 'bio-lab', name: 'Marine Biology Lab', description: 'Pressurized laboratory for specimen analysis', status: 'available', builder: null },
      { id: 'quarters', name: 'Living Quarters', description: 'Underwater habitat for 12 researchers', status: 'available', builder: null },
    ],
  },
  'mountain-outpost': {
    id: 'mountain-outpost', name: 'Mountain Outpost', scene: 'terrain', accent: '#22c55e',
    description: 'Construct a high-altitude base with weather stations, wind turbines, and observatory domes.',
    difficulty: 'Beginner', category: 'Infrastructure',
    parts: [
      { id: 'weather-station', name: 'Weather Station', description: 'Meteorological sensors and forecasting system', status: 'complete', builder: 'You' },
      { id: 'wind-turbines', name: 'Wind Turbines', description: 'High-altitude wind energy generators', status: 'complete', builder: 'You' },
      { id: 'observatory', name: 'Observatory Dome', description: 'Telescope housing with adaptive optics', status: 'complete', builder: 'You' },
      { id: 'comms-relay', name: 'Communications Relay', description: 'Mountain-top radio relay station', status: 'complete', builder: 'You' },
    ],
  },
  'smart-home': {
    id: 'smart-home', name: 'Smart Home', scene: 'house', accent: '#ef4444',
    description: 'Design and build a modern smart home with interconnected rooms, IoT devices, and automation.',
    difficulty: 'Beginner', category: 'Architecture',
    parts: [
      { id: 'living-room', name: 'Living Room', description: 'Smart lighting, climate control, and entertainment hub', status: 'complete', builder: 'You' },
      { id: 'kitchen', name: 'Smart Kitchen', description: 'Automated appliances and inventory tracking', status: 'available', builder: null },
      { id: 'bedroom', name: 'Master Bedroom', description: 'Sleep optimization and ambient controls', status: 'available', builder: null },
      { id: 'security', name: 'Security System', description: 'AI-powered surveillance and access control', status: 'available', builder: null },
      { id: 'garage', name: 'Smart Garage', description: 'EV charging and vehicle management', status: 'available', builder: null },
    ],
  },
  'art-museum': {
    id: 'art-museum', name: 'Art Museum', scene: 'museum', accent: '#a8a29e',
    description: 'Build a grand museum with gallery wings, sculpture halls, and interactive exhibits.',
    difficulty: 'Intermediate', category: 'Architecture',
    parts: [
      { id: 'main-hall', name: 'Grand Hall', description: 'Columned entrance hall with marble floors', status: 'complete', builder: 'You' },
      { id: 'gallery-wing-a', name: 'Gallery Wing A', description: 'Natural lit gallery for paintings', status: 'complete', builder: 'You' },
      { id: 'sculpture-hall', name: 'Sculpture Hall', description: 'Climate-controlled hall for 3D artworks', status: 'available', builder: null },
      { id: 'interactive-wing', name: 'Interactive Wing', description: 'Digital and immersive art experiences', status: 'available', builder: null },
      { id: 'conservation-lab', name: 'Conservation Lab', description: 'Restoration and preservation facility', status: 'available', builder: null },
      { id: 'cafe', name: 'Museum Cafe', description: 'Visitor amenities and gift shop', status: 'available', builder: null },
    ],
  },
  'cube-solver': {
    id: 'cube-solver', name: 'Cube Solver Bot', scene: 'cube', accent: '#f43f5e',
    description: "Program an AI-powered Rubik's Cube solver with move optimization and pattern recognition.",
    difficulty: 'Advanced', category: 'AI & Robotics',
    parts: [
      { id: 'vision-system', name: 'Vision System', description: 'Camera-based cube state detection', status: 'available', builder: null },
      { id: 'solver-algo', name: 'Solver Algorithm', description: 'Kociemba two-phase solving algorithm', status: 'available', builder: null },
      { id: 'robot-arm', name: 'Robotic Arm', description: '6-axis manipulator for physical cube rotation', status: 'available', builder: null },
      { id: 'ui-dashboard', name: 'UI Dashboard', description: 'Real-time visualization and control panel', status: 'available', builder: null },
    ],
  },
}

// ── Status colors ──
const STATUS_CONFIG = {
  'complete': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Complete', icon: IconCheck },
  'in-progress': { bg: 'bg-red-500/15', text: 'text-red-400', label: 'In Progress', icon: IconBuild },
  'available': { bg: 'bg-[#1a1a1a]', text: 'text-[#737373]', label: 'Available', icon: IconPlay },
}

export default function BuildRoomClient() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId
  const project = PROJECTS[projectId]
  const [selectedPart, setSelectedPart] = useState(null)
  const [celebration, setCelebration] = useState(false)

  // Celebration effect when a part is completed
  useEffect(() => {
    if (celebration) {
      const timer = setTimeout(() => setCelebration(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [celebration])

  // 404 if project not found
  if (!project) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <IconBuild size={40} className="mx-auto mb-4 text-[#333]" />
          <h1 className="text-xl font-semibold mb-2">Project Not Found</h1>
          <p className="text-sm text-[#737373] mb-4">This build project doesn&apos;t exist yet.</p>
          <Link
            href="/build"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#111] border border-[#1a1a1a] text-[#a3a3a3] hover:bg-[#1a1a1a] hover:text-white transition-colors"
          >
            <IconArrowLeft size={14} />
            Back to Build Studio
          </Link>
        </div>
      </main>
    )
  }

  const partsComplete = project.parts.filter(p => p.status === 'complete').length
  const partsTotal = project.parts.length
  const progress = Math.round((partsComplete / partsTotal) * 100)
  const isComplete = progress === 100

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Celebration overlay */}
      {celebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="text-center animate-celebrate">
            <div className="text-4xl mb-2">
              <IconStar size={48} className="mx-auto text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Part Completed!</h2>
            <p className="text-sm text-[#a3a3a3] mt-1">Great work, Builder</p>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="border-b border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Link
                href="/build"
                className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#737373] hover:text-white transition-colors shrink-0 mt-0.5"
              >
                <IconArrowLeft size={14} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
                  {isComplete && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 flex items-center gap-1">
                      <IconStar size={10} />
                      Complete
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#737373] mt-0.5">{project.description}</p>
              </div>
            </div>
            <a
              href={`/3d?scene=${project.scene}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-colors shrink-0"
            >
              <IconEye size={12} />
              View Scene
            </a>
          </div>

          {/* Progress bar */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-in-out"
                style={{
                  width: `${progress}%`,
                  backgroundColor: isComplete ? '#10b981' : project.accent,
                }}
              />
            </div>
            <span className="text-xs text-[#737373] font-medium whitespace-nowrap">
              {partsComplete}/{partsTotal} parts ({progress}%)
            </span>
          </div>
        </div>
      </div>

      {/* ── Parts Grid ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {project.parts.map((part, index) => (
            <PartCard
              key={part.id}
              part={part}
              project={project}
              index={index}
              selected={selectedPart === part.id}
              onSelect={() => setSelectedPart(selectedPart === part.id ? null : part.id)}
              onComplete={() => setCelebration(true)}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes celebrate {
          0% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-celebrate {
          animation: celebrate 0.5s ease-out forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </main>
  )
}

/* ── Part Card ── */
function PartCard({ part, project, index, selected, onSelect, onComplete }) {
  const statusConfig = STATUS_CONFIG[part.status]
  const StatusIcon = statusConfig.icon

  return (
    <div className="animate-fade-in" style={{ animationDelay: `${index * 60}ms` }}>
      <div
        className={`group rounded-xl bg-[#0f0f0f] border overflow-hidden transition-colors duration-200 cursor-pointer ${
          selected ? 'border-[#333]' : 'border-[#1a1a1a] hover:border-[#2a2a2a]'
        }`}
        onClick={onSelect}
      >
        {/* Top bar with status */}
        <div
          className="relative h-20 flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${project.accent}10, ${project.accent}05)` }}
        >
          {/* Status badge */}
          <div className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${statusConfig.bg} ${statusConfig.text}`}>
            <StatusIcon size={10} />
            {statusConfig.label}
          </div>

          {/* Part number */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: `${project.accent}15`, color: project.accent }}
          >
            {index + 1}
          </div>

          {/* Builder avatar (if completed) */}
          {part.status === 'complete' && (
            <div className="absolute bottom-2 right-2.5 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <IconCheck size={10} className="text-emerald-400" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3.5">
          <h3 className="text-sm font-semibold text-white mb-0.5">{part.name}</h3>
          <p className="text-[11px] text-[#525252] leading-relaxed mb-3">{part.description}</p>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {part.status === 'complete' ? (
              <Link
                href={`/build/${project.id}/${part.id}`}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500/20 transition-colors"
              >
                <IconEye size={10} />
                View
              </Link>
            ) : part.status === 'in-progress' ? (
              <Link
                href={`/build/${project.id}/${part.id}`}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/15 hover:bg-red-500/20 transition-colors"
              >
                <IconBuild size={10} />
                Continue
              </Link>
            ) : (
              <Link
                href={`/build/${project.id}/${part.id}`}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[#111] text-[#a3a3a3] border border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white transition-colors"
              >
                <IconPlay size={10} />
                Start Building
              </Link>
            )}

            <a
              href={`/3d?scene=${project.scene}`}
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] text-[#525252] hover:text-[#737373] transition-colors"
            >
              <IconEye size={10} />
              Scene
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
