'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { IconArrowRight, IconExternal } from '@/components/Icons'

const BLOG_URL = '/blog'

const POSTS = [
  {
    title: 'How to Build a WhatsApp Bot Business in 3 Days',
    excerpt: 'A step-by-step guide to creating and selling WhatsApp automation bots for African SMEs, with real cost breakdowns and client acquisition strategies.',
    category: 'Make Money',
    date: 'Apr 18, 2026',
    slug: 'whatsapp-bot-business-guide',
    readTime: '8 min read',
    image: '/blog/whatsapp-bot.jpg',
    featured: true,
  },
  {
    title: 'The Real Cost of Running a Faceless YouTube Channel',
    excerpt: 'We break down every tool, every subscription, and every hour of work it actually takes to run a successful faceless YouTube channel with AI.',
    category: 'YouTube',
    date: 'Apr 15, 2026',
    slug: 'faceless-youtube-real-costs',
    readTime: '6 min read',
    image: '/blog/youtube-costs.jpg',
    featured: true,
  },
  {
    title: 'Why Most AI Automation Businesses Fail in Month 3',
    excerpt: 'Honest analysis of the patterns we see in businesses that start strong and collapse, and what you can do differently from day one.',
    category: 'Automation',
    date: 'Apr 12, 2026',
    slug: 'ai-automation-failure-analysis',
    readTime: '7 min read',
    image: '/blog/automation-fail.jpg',
    featured: true,
  },
  {
    title: '5 Free Dev Tools That Replace Paid SaaS Products',
    excerpt: 'From code explainers to SQL builders, these free AI-powered developer tools do what paid products charge monthly for. Here is the full breakdown.',
    category: 'Dev Tools',
    date: 'Apr 8, 2026',
    slug: 'free-dev-tools-replace-saas',
    readTime: '5 min read',
    image: '/blog/dev-tools.jpg',
  },
  {
    title: 'How to Start a Tech Business in Nigeria With Less Than $50',
    excerpt: 'A practical guide for Nigerian builders who want to launch something real without needing foreign credit cards, VPNs, or thousands of dollars.',
    category: 'Africa',
    date: 'Apr 5, 2026',
    slug: 'tech-business-nigeria-under-50',
    readTime: '9 min read',
    image: '/blog/africa-tech.jpg',
  },
  {
    title: 'AI Study Tools That Actually Help You Learn Faster',
    excerpt: 'Not just flashcards. These AI-powered study tools help with research, essay outlines, citation generation, and coding practice, all free.',
    category: 'Study & Learn',
    date: 'Apr 2, 2026',
    slug: 'ai-study-tools-learn-faster',
    readTime: '6 min read',
    image: '/blog/study-learn.jpg',
  },
  {
    title: 'The Side Hustle Blueprint: From Zero to $500/Month With AI',
    excerpt: 'A realistic, no-hype plan for building a side income using AI tools, including exactly which tools to use, how to find clients, and how long it takes.',
    category: 'Make Money',
    date: 'Mar 28, 2026',
    slug: 'side-hustle-blueprint-500-month',
    readTime: '10 min read',
    image: '/blog/make-money.jpg',
  },
]

const CATEGORIES = ['All', 'Make Money', 'Automation', 'YouTube', 'Dev Tools', 'Africa', 'Study & Learn']

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState('All')

  const filtered = activeCategory === 'All'
    ? POSTS
    : POSTS.filter(p => p.category === activeCategory)

  const featured = filtered.filter(p => p.featured)
  const rest = filtered.filter(p => !p.featured)

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-14">

        {/* Header */}
        <div className="mb-12 animate-fade-up">
          <h1 className="text-4xl font-semibold tracking-tight mb-3">
            Guides for builders.<br />
            <span className="text-red-500">No fluff.</span>
          </h1>
          <p className="text-muted text-base max-w-xl">
            Deep dives on AI opportunities, automation strategies, and honest breakdowns of what actually works.
          </p>
        </div>

        {/* Blog info */}
        <div className="bg-[#141414] border border-[#262626] rounded-xl px-5 py-4 mb-10 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium mb-0.5">Kivora Blog</p>
            <p className="text-xs text-muted">Deep dives on AI opportunities, automation strategies, and honest breakdowns of what actually works.</p>
          </div>
          <Link
            href="/home"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Back to app <IconArrowRight size={11} />
          </Link>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors cursor-pointer ${
                activeCategory === c
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-[#141414] border-[#262626] text-muted hover:border-[#3a3a3a] hover:text-[#d4d4d4]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Featured posts (first row — 2+1 layout) */}
        {featured.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {featured.slice(0, 3).map((post, i) => (
              <div
                key={post.slug}
                className={`bg-[#141414] rounded-xl overflow-hidden transition-all group ${i === 0 ? 'md:col-span-2' : ''}`}
              >
                <div className={`relative overflow-hidden ${i === 0 ? 'h-48 md:h-52' : 'h-36 md:h-40'}`}>
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-medium text-red-400 bg-red-950/30 border border-red-900/20 px-2 py-0.5 rounded-full">{post.category}</span>
                    <span className="text-[10px] text-muted2">{post.readTime}</span>
                  </div>
                  <h3 className="font-semibold text-sm leading-snug tracking-tight mb-2 group-hover:text-red-400 transition-colors text-muted">{post.title}</h3>
                  <p className="text-xs text-muted leading-relaxed line-clamp-2">{post.excerpt}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-[10px] text-muted2 font-mono">{post.date}</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted2 group-hover:text-red-400 transition-colors">
                      Read <IconArrowRight size={10} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Remaining posts (3-column grid) */}
        {rest.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {rest.map(post => (
              <div
                key={post.slug}
                className="bg-[#141414] rounded-xl overflow-hidden transition-all group"
              >
                <div className="relative h-36 overflow-hidden">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-medium text-red-400 bg-red-950/30 border border-red-900/20 px-2 py-0.5 rounded-full">{post.category}</span>
                    <span className="text-[10px] text-muted2">{post.readTime}</span>
                  </div>
                  <h3 className="font-semibold text-sm leading-snug tracking-tight mb-2 group-hover:text-red-400 transition-colors text-muted">{post.title}</h3>
                  <p className="text-xs text-muted leading-relaxed line-clamp-2">{post.excerpt}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-[10px] text-muted2 font-mono">{post.date}</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted2 group-hover:text-red-400 transition-colors">
                      Read <IconArrowRight size={10} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted">
            <p className="text-sm">No posts in this category yet.</p>
            <button onClick={() => setActiveCategory('All')} className="text-xs text-red-500 hover:text-red-400 mt-2 transition-colors">
              View all posts
            </button>
          </div>
        )}

        {/* View all CTA */}
        <div className="text-center py-12 bg-[#0d0d0d] rounded-xl">
          <h3 className="font-semibold text-lg tracking-tight mb-2 text-muted">More articles on Kivora</h3>
          <p className="text-muted text-sm mb-6 max-w-md mx-auto">
            Hundreds of articles covering AI tools, automation, business building, and opportunities for builders everywhere.
          </p>
          <Link
            href="/home"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            Explore Kivora <IconArrowRight size={13} />
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-[#141414] flex flex-wrap gap-4 text-xs text-muted">
          <Link href="/about" className="hover:text-white transition-colors">About</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          <Link href="/home" className="hover:text-white transition-colors">Back to app</Link>
        </div>
      </div>
    </main>
  )
}
