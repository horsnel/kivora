'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PROJECTS } from '@/components/build/demoData'
import { IconPlus, IconEye, IconFlame, IconLock, IconUser, IconImage, IconBuild, IconFolder } from '@/components/Icons'

const TABS = [
  { key: 'gallery', label: 'Gallery', Icon: IconImage, href: '/3d' },
  { key: 'build', label: 'Build', Icon: IconBuild, href: '/build' },
  { key: 'assets', label: 'My Assets', Icon: IconFolder, href: '/build' },
]

const FILTERS = ['All', 'Ongoing', 'Completed', 'Joinable', 'My Projects']

function StatusBadge({ status }) {
  const styles = {
    ongoing:   'bg-green-500/15 text-green-400 border-green-500/20',
    completed: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    joinable:  'bg-amber-500/15 text-amber-400 border-amber-500/20',
  }
  const labels = {
    ongoing: 'ONGOING',
    completed: 'COMPLETED',
    joinable: 'JOIN NOW',
  }
  return (
    <span className={`absolute top-3 left-3 px-2 py-0.5 text-[10px] font-bold tracking-wider rounded border ${styles[status] || 'bg-gray-500/15 text-gray-400 border-gray-500/20'}`}>
      {labels[status] || status.toUpperCase()}
    </span>
  )
}

function ActionButton({ status, projectId }) {
  const config = {
    ongoing:   { label: 'Enter Build', href: `/build/${projectId}`, className: 'bg-[#dc2626] hover:bg-red-700 text-white' },
    completed: { label: 'View Scene', href: `/build/${projectId}`, className: 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/20' },
    joinable:  { label: 'Join Project', href: `/build/${projectId}`, className: 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/20' },
  }
  const { label, href, className } = config[status] || config.ongoing
  return (
    <Link href={href} className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${className}`}>
      {label}
    </Link>
  )
}

function ProjectCard({ project }) {
  const progress = (project.completedParts / project.totalParts) * 100
  return (
    <div className="group card relative overflow-hidden transition-all duration-300 hover:-translate-y-1">
      <div className={`relative h-40 bg-gradient-to-br ${project.gradient} rounded-lg mb-4 overflow-hidden`}>
        <StatusBadge status={project.status} />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="absolute bottom-3 right-3 w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: project.accentColor, boxShadow: `0 0 12px ${project.accentColor}60` }} />
      </div>
      <h3 className="text-[15px] font-semibold text-white mb-1 group-hover:text-red-400 transition-colors">{project.title}</h3>
      <p className="text-xs text-[#737373] mb-3">{project.community}</p>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#737373]">{project.completedParts}/{project.totalParts} parts</span>
          <span className="text-xs text-[#737373]">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${project.accentColor}, ${project.accentColor}88)` }} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-[#737373]">
          <IconUser size={12} />
          <span>{project.builders} builder{project.builders !== 1 ? 's' : ''}</span>
        </div>
        <ActionButton status={project.status} projectId={project.id} />
      </div>
    </div>
  )
}

export default function BuildPage() {
  const [activeFilter, setActiveFilter] = useState('All')
  const filteredProjects = PROJECTS.filter(p => {
    if (activeFilter === 'All') return true
    if (activeFilter === 'My Projects') return false
    return p.status === activeFilter.toLowerCase()
  })

  return (
    <div className="min-h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">3D Build Projects</h1>
          <p className="text-sm text-[#737373] mt-1">Community-driven 3D construction</p>
        </div>
        <button disabled className="flex items-center gap-1.5 px-4 py-2 bg-[#1a1a1a] text-[#404040] rounded-lg text-sm font-medium cursor-not-allowed border border-[rgba(255,255,255,0.04)]">
          <IconPlus size={14} />
          New Project
        </button>
      </div>
      <div className="flex gap-1 mb-5 bg-[#111111] border border-[rgba(255,255,255,0.06)] rounded-lg p-1 w-fit">
        {TABS.map(tab => (
          <Link key={tab.key} href={tab.href} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab.key === 'build' ? 'bg-[#1a1a1a] text-white' : 'text-[#737373] hover:text-white hover:bg-[#141414]'}`}>
            <tab.Icon size={13} />
            {tab.label}
          </Link>
        ))}
      </div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
        {FILTERS.map(filter => (
          <button key={filter} onClick={() => setActiveFilter(filter)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeFilter === filter ? 'bg-[#dc2626]/15 text-red-400 border border-red-500/20' : 'bg-[#141414] text-[#737373] border border-[rgba(255,255,255,0.06)] hover:text-white hover:border-[rgba(255,255,255,0.1)]'}`}>
            {filter}
          </button>
        ))}
      </div>
      {filteredProjects.length === 0 ? (
        <div className="text-center py-16"><p className="text-[#737373] text-sm">No projects match this filter</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project, i) => (
            <div key={project.id} className="animate-fade-up" style={{ animationDelay: `${i * 0.06}s` }}>
              <ProjectCard project={project} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
