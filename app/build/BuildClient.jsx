'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { IconBuild, IconFolder, IconPlay, IconEye, IconCode, IconBulb, IconSearch, IconFilter, IconStar } from '@/components/Icons'

// ── Project data (static until database is wired) ──
const PROJECTS = [
  {
    id: 'lunar-base',
    name: 'Lunar Base Alpha',
    description: 'Build a modular Moon base with habitat modules, solar arrays, and rover docking stations.',
    scene: 'moon',
    difficulty: 'Beginner',
    partsTotal: 5,
    partsComplete: 2,
    category: 'Space',
    accent: '#94a3b8',
  },
  {
    id: 'earth-observatory',
    name: 'Earth Observatory',
    description: 'Construct an orbital station with telescopes, comms arrays, and research labs.',
    scene: 'earth',
    difficulty: 'Intermediate',
    partsTotal: 6,
    partsComplete: 0,
    category: 'Space',
    accent: '#3b82f6',
  },
  {
    id: 'solar-cruiser',
    name: 'Solar Cruiser',
    description: 'Design and assemble a multi-planet spacecraft with engine modules and crew quarters.',
    scene: 'solar',
    difficulty: 'Advanced',
    partsTotal: 8,
    partsComplete: 1,
    category: 'Space',
    accent: '#f59e0b',
  },
  {
    id: 'nebula-lab',
    name: 'Nebula Lab',
    description: 'Build a deep-space research facility inside a nebula with sensor arrays and dark matter detectors.',
    scene: 'deepspace',
    difficulty: 'Advanced',
    partsTotal: 7,
    partsComplete: 0,
    category: 'Research',
    accent: '#a855f7',
  },
  {
    id: 'global-network',
    name: 'Global Network Hub',
    description: 'Construct a worldwide data network with fiber nodes, satellite links, and server clusters.',
    scene: 'globe',
    difficulty: 'Intermediate',
    partsTotal: 6,
    partsComplete: 3,
    category: 'Infrastructure',
    accent: '#10b981',
  },
  {
    id: 'ocean-rig',
    name: 'Deep Ocean Rig',
    description: 'Build an underwater research platform with submersible bays, sonar arrays, and living quarters.',
    scene: 'ocean',
    difficulty: 'Intermediate',
    partsTotal: 5,
    partsComplete: 0,
    category: 'Research',
    accent: '#0ea5e9',
  },
  {
    id: 'mountain-outpost',
    name: 'Mountain Outpost',
    description: 'Construct a high-altitude base with weather stations, wind turbines, and observatory domes.',
    scene: 'terrain',
    difficulty: 'Beginner',
    partsTotal: 4,
    partsComplete: 4,
    category: 'Infrastructure',
    accent: '#22c55e',
  },
  {
    id: 'smart-home',
    name: 'Smart Home',
    description: 'Design and build a modern smart home with interconnected rooms, IoT devices, and automation.',
    scene: 'house',
    difficulty: 'Beginner',
    partsTotal: 5,
    partsComplete: 1,
    category: 'Architecture',
    accent: '#ef4444',
  },
  {
    id: 'art-museum',
    name: 'Art Museum',
    description: 'Build a grand museum with gallery wings, sculpture halls, and interactive exhibits.',
    scene: 'museum',
    difficulty: 'Intermediate',
    partsTotal: 6,
    partsComplete: 2,
    category: 'Architecture',
    accent: '#a8a29e',
  },
  {
    id: 'cube-solver',
    name: 'Cube Solver Bot',
    description: 'Program an AI-powered Rubik\'s Cube solver with move optimization and pattern recognition.',
    scene: 'cube',
    difficulty: 'Advanced',
    partsTotal: 4,
    partsComplete: 0,
    category: 'AI & Robotics',
    accent: '#f43f5e',
  },
]

const TABS = [
  { id: 'gallery', label: 'Gallery', icon: IconEye },
  { id: 'build', label: 'Build', icon: IconBuild },
  { id: 'my-assets', label: 'My Assets', icon: IconFolder },
]

const CATEGORIES = ['All', 'Space', 'Research', 'Infrastructure', 'Architecture', 'AI & Robotics']

export default function BuildClient() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('gallery')
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name') // name, difficulty, progress

  // Read tab from URL
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && TABS.some(t => t.id === tab)) setActiveTab(tab)
  }, [searchParams])

  const filteredProjects = PROJECTS.filter(p => {
    if (category !== 'All' && p.category !== category) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    if (sortBy === 'difficulty') {
      const order = { Beginner: 0, Intermediate: 1, Advanced: 2 }
      return order[a.difficulty] - order[b.difficulty]
    }
    if (sortBy === 'progress') {
      return (b.partsComplete / b.partsTotal) - (a.partsComplete / a.partsTotal)
    }
    return a.name.localeCompare(b.name)
  })

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ── Header ── */}
      <div className="border-b border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-red-400">
              <IconBuild size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Build Studio</h1>
              <p className="text-sm text-[#737373]">Construct modular 3D projects part by part</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-2">
        <div className="flex gap-1 bg-[#111111] rounded-lg p-0.5 border border-[#1a1a1a]">
            {TABS.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-[#dc2626] text-white'
                      : 'bg-[#141414] border border-[#262626] text-[#737373] hover:text-white hover:border-[#3a3a3a]'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              )
            })}
          </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'gallery' && (
          <GalleryView
            projects={filteredProjects}
            category={category}
            setCategory={setCategory}
            search={search}
            setSearch={setSearch}
            sortBy={sortBy}
            setSortBy={setSortBy}
          />
        )}
        {activeTab === 'build' && (
          <BuildView projects={filteredProjects} />
        )}
        {activeTab === 'my-assets' && (
          <MyAssetsView />
        )}
      </div>

      <style jsx>{`
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

/* ── Gallery View ── */
function GalleryView({ projects, category, setCategory, search, setSearch, sortBy, setSortBy }) {
  return (
    <div className="animate-fade-in">
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#525252]" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#111] border border-[#1a1a1a] text-sm text-white placeholder-[#525252] focus:outline-none focus:border-[#2a2a2a] transition-colors"
          />
        </div>
        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#111] border border-[#1a1a1a] text-sm text-[#a3a3a3] focus:outline-none focus:border-[#2a2a2a] transition-colors cursor-pointer"
        >
          <option value="name">Sort by Name</option>
          <option value="difficulty">Sort by Difficulty</option>
          <option value="progress">Sort by Progress</option>
        </select>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              category === cat
                ? 'bg-[#dc2626] text-white'
                : 'bg-[#111] text-[#737373] hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Project grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-16">
          <IconSearch size={32} className="mx-auto mb-3 text-[#333]" />
          <p className="text-[#525252] text-sm">No projects match your filters</p>
        </div>
      )}
    </div>
  )
}

/* ── Project Card ── */
function ProjectCard({ project }) {
  const progress = Math.round((project.partsComplete / project.partsTotal) * 100)
  const isComplete = progress === 100

  return (
    <Link
      href={`/build/${project.id}`}
      className="group block rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#2a2a2a] overflow-hidden transition-colors duration-200"
    >
      {/* Top accent + scene preview */}
      <div
        className="relative h-32 flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${project.accent}15, ${project.accent}08)` }}
      >
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Accent glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full opacity-20 blur-2xl"
          style={{ backgroundColor: project.accent }}
        />
        <div className="relative text-center">
          <a
            href={`/3d?scene=${project.scene}`}
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium bg-white/5 text-white/40 hover:text-white/70 transition-colors"
          >
            <IconPlay size={10} />
            Preview Scene
          </a>
        </div>
        {/* Difficulty badge */}
        <div className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-semibold ${
          project.difficulty === 'Beginner' ? 'bg-emerald-500/15 text-emerald-400' :
          project.difficulty === 'Intermediate' ? 'bg-red-500/15 text-red-400' :
          'bg-red-500/15 text-red-400'
        }`}>
          {project.difficulty}
        </div>
        {/* Completion badge */}
        {isComplete && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 flex items-center gap-1">
            <IconStar size={10} />
            Complete
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-white group-hover:text-white/90 transition-colors mb-1">
          {project.name}
        </h3>
        <p className="text-xs text-[#525252] leading-relaxed mb-3 line-clamp-2">
          {project.description}
        </p>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-in-out"
              style={{
                width: `${progress}%`,
                backgroundColor: isComplete ? '#10b981' : project.accent,
              }}
            />
          </div>
          <span className="text-[10px] text-[#525252] font-medium whitespace-nowrap">
            {project.partsComplete}/{project.partsTotal}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-[#525252]">{project.category}</span>
          <span className="text-[10px] text-[#525252]">{progress}%</span>
        </div>
      </div>
    </Link>
  )
}

/* ── Build View (active projects) ── */
function BuildView({ projects }) {
  const activeProjects = projects.filter(p => p.partsComplete > 0 && p.partsComplete < p.partsTotal)
  const completedProjects = projects.filter(p => p.partsComplete === p.partsTotal)

  return (
    <div className="animate-fade-in space-y-8">
      {/* Active Projects */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <IconBuild size={16} className="text-red-400" />
          Active Projects
        </h2>
        {activeProjects.length > 0 ? (
          <div className="space-y-3">
            {activeProjects.map(project => (
              <ActiveProjectRow key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a]">
            <IconBuild size={28} className="mx-auto mb-2 text-[#333]" />
            <p className="text-[#525252] text-sm">No active projects yet</p>
            <p className="text-[#404040] text-xs mt-1">Browse the Gallery to start building</p>
          </div>
        )}
      </section>

      {/* Completed Projects */}
      {completedProjects.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <IconStar size={16} className="text-emerald-400" />
            Completed
          </h2>
          <div className="space-y-3">
            {completedProjects.map(project => (
              <ActiveProjectRow key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/* ── Active Project Row ── */
function ActiveProjectRow({ project }) {
  const progress = Math.round((project.partsComplete / project.partsTotal) * 100)
  const isComplete = progress === 100

  return (
    <Link
      href={`/build/${project.id}`}
      className="group flex items-center gap-4 p-4 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#2a2a2a] transition-colors duration-200"
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${project.accent}15`, color: project.accent }}
      >
        <IconBuild size={18} />
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-white group-hover:text-white/90 transition-colors">{project.name}</h3>
        <p className="text-xs text-[#525252] truncate">{project.description}</p>
        {/* Progress */}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden max-w-[160px]">
            <div
              className="h-full rounded-full transition-all duration-700 ease-in-out"
              style={{
                width: `${progress}%`,
                backgroundColor: isComplete ? '#10b981' : project.accent,
              }}
            />
          </div>
          <span className="text-[10px] text-[#525252] font-medium">
            {project.partsComplete}/{project.partsTotal} parts
          </span>
        </div>
      </div>
      {/* Arrow */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#404040] group-hover:text-[#737373] transition-colors shrink-0">
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

/* ── My Assets View ── */
function MyAssetsView() {
  return (
    <div className="animate-fade-in text-center py-16">
      <IconFolder size={32} className="mx-auto mb-3 text-[#333]" />
      <h3 className="text-sm font-semibold text-[#737373] mb-1">My Assets</h3>
      <p className="text-xs text-[#525252] max-w-xs mx-auto">
        Your completed build parts and custom 3D assets will appear here once you start building.
      </p>
      <Link
        href="/build?tab=gallery"
        className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors duration-300"
      >
        <IconBuild size={12} />
        Browse Projects
      </Link>
    </div>
  )
}
