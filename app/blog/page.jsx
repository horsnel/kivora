import Link from 'next/link'
import { IconArrowRight, IconExternal } from '@/components/Icons'

export const metadata = {
  title: 'Blog — Kivora',
  description: 'Guides, insights, and deep dives on AI, automation, and building in the modern world.',
}

// ── Update BLOG_URL to point to your Hugo blog domain ──────────
const BLOG_URL = 'https://blog.menshlyglobal.pages.dev' // ← replace with your Hugo blog URL

// Featured posts — update these with real posts from your Hugo blog
const FEATURED_POSTS = [
  {
    title: 'How to Build a WhatsApp Bot Business in 3 Days',
    excerpt: 'A step-by-step guide to creating and selling WhatsApp automation bots for African SMEs — with real cost breakdowns and client acquisition strategies.',
    category: 'Make Money',
    date: 'Apr 18, 2026',
    slug: 'whatsapp-bot-business-guide',
    readTime: '8 min read',
  },
  {
    title: 'The Real Cost of Running a Faceless YouTube Channel',
    excerpt: 'We break down every tool, every subscription, and every hour of work it actually takes to run a successful faceless YouTube channel with AI.',
    category: 'YouTube',
    date: 'Apr 15, 2026',
    slug: 'faceless-youtube-real-costs',
    readTime: '6 min read',
  },
  {
    title: 'Why Most AI Automation Businesses Fail in Month 3',
    excerpt: 'Honest analysis of the patterns we see in businesses that start strong and collapse — and what you can do differently from day one.',
    category: 'Automation',
    date: 'Apr 12, 2026',
    slug: 'ai-automation-failure-analysis',
    readTime: '7 min read',
  },
]

const CATEGORIES = ['All', 'Make Money', 'Automation', 'YouTube', 'Dev Tools', 'Africa', 'Study & Learn']

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-14">

        {/* Header */}
        <div className="mb-12 animate-fade-up">
          <p className="text-xs text-[#737373] font-mono uppercase tracking-widest mb-3">Kivora Blog</p>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Guides for builders.<br />
            <span className="text-red-500">No fluff.</span>
          </h1>
          <p className="text-[#737373] text-base max-w-xl">
            Deep dives on AI opportunities, automation strategies, and honest breakdowns of what actually works.
          </p>
        </div>

        {/* External blog notice */}
        <div className="bg-[#141414] border border-[#262626] rounded-xl px-5 py-4 mb-10 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium mb-0.5">Full blog on MenshlyGlobal</p>
            <p className="text-xs text-[#737373]">Our full editorial archive lives on the MenshlyGlobal blog — hundreds of articles, guides, and analyses.</p>
          </div>
          <a
            href={BLOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Visit blog <IconExternal size={11} />
          </a>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map(c => (
            <span key={c} className={`px-3 py-1.5 rounded-full text-xs border cursor-default ${
              c === 'All' ? 'bg-red-600 border-red-600 text-white' : 'bg-[#141414] border-[#262626] text-[#737373]'
            }`}>
              {c}
            </span>
          ))}
        </div>

        {/* Featured posts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {FEATURED_POSTS.map((post, i) => (
            <a
              key={post.slug}
              href={`${BLOG_URL}/posts/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] rounded-2xl overflow-hidden transition-all group ${i === 0 ? 'md:col-span-2' : ''}`}
            >
              {/* Placeholder gradient image */}
              <div className={`bg-gradient-to-br from-[#1a0a0a] to-[#0d0d0d] border-b border-[#262626] flex items-center justify-center ${i === 0 ? 'h-40' : 'h-28'}`}>
                <div className="w-10 h-10 bg-red-950/40 border border-red-900/30 rounded-xl flex items-center justify-center">
                  <span className="text-red-400 font-mono text-xs font-bold">{post.category[0]}</span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xs font-medium text-red-400 bg-red-950/30 border border-red-900/20 px-2 py-0.5 rounded-full">{post.category}</span>
                  <span className="text-2xs text-[#404040]">{post.readTime}</span>
                </div>
                <h3 className="font-semibold text-sm leading-snug tracking-tight mb-2 group-hover:text-red-400 transition-colors">{post.title}</h3>
                <p className="text-xs text-[#737373] leading-relaxed line-clamp-2">{post.excerpt}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-2xs text-[#404040] font-mono">{post.date}</span>
                  <span className="flex items-center gap-1 text-2xs text-[#404040] group-hover:text-red-400 transition-colors">
                    Read <IconArrowRight size={10} />
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* View all CTA */}
        <div className="text-center py-12 bg-[#0d0d0d] border border-[#141414] rounded-2xl">
          <h3 className="font-semibold text-lg tracking-tight mb-2">More articles on MenshlyGlobal</h3>
          <p className="text-[#737373] text-sm mb-6 max-w-md mx-auto">
            Hundreds of articles covering AI tools, automation, business building, and opportunities for builders everywhere.
          </p>
          <a
            href={BLOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            Browse all articles <IconExternal size={13} />
          </a>
        </div>

        <div className="mt-12 pt-8 border-t border-[#141414] flex flex-wrap gap-4 text-xs text-[#737373]">
          <Link href="/about" className="hover:text-white transition-colors">About</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          <Link href="/" className="hover:text-white transition-colors">Back to app</Link>
        </div>
      </div>
    </main>
  )
}
