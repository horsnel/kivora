import Link from 'next/link'
import { IconGlobe, IconCheck, IconMoney, IconCode } from '@/components/Icons'

export const metadata = {
  title: 'About — Kivora',
  description: 'What Kivora is, why we built it, and who it\'s for.',
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-14">

        {/* Header */}
        <div className="mb-16 animate-fade-up">
          <p className="text-xs text-[#737373] font-mono uppercase tracking-widest mb-4">About Kivora</p>
          <h1 className="text-4xl font-bold tracking-tight mb-5 leading-tight">
            Built for the builder who doesn't have everything —
            <span className="text-red-500"> but refuses to stay behind.</span>
          </h1>
          <p className="text-[#737373] text-base leading-relaxed">
            Kivora is a free intelligence platform for developers, students, entrepreneurs, and anyone building something real with AI. It was created with one belief: that geography should not determine access to knowledge, tools, or opportunity.
          </p>
        </div>

        {/* Mission */}
        <div className="mb-14">
          <h2 className="font-semibold text-lg tracking-tight mb-4">The problem we're solving</h2>
          <div className="space-y-4 text-[#d4d4d4] text-sm leading-relaxed">
            <p>
              Most AI platforms are designed for people in wealthy countries with fast internet, USD bank accounts, and VPN access. The guides assume you have a Stripe account. The tools assume you can pay $20/month without thinking about it. The income examples are in dollars — not because dollars are universal, but because the people building those products live in dollars.
            </p>
            <p>
              There are billions of builders who don't fit that mold. Developers in Lagos who are world-class engineers but can't accept payments from certain clients. Students in Nairobi who need honest homework help without a paywall. Entrepreneurs in Accra building real businesses with $7/month tool stacks instead of $500/month SaaS subscriptions.
            </p>
            <p>
              Kivora is for them. And for the diaspora builders connecting both worlds. And for everyone else who wants practical tools and honest information — not hype, not paywalls, not guides written by people who've never had to worry about exchange rates.
            </p>
          </div>
        </div>

        {/* What we built */}
        <div className="mb-14">
          <h2 className="font-semibold text-lg tracking-tight mb-6">What we built</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { Icon: IconMoney,  title: 'Opportunity Engine',  desc: 'Real income guides with honest cost breakdowns, failure analysis, and tool stacks that work everywhere.' },
              { Icon: IconCode,   title: 'Dev Tools',           desc: 'Six AI-powered tools for developers — code explainer, regex gen, SQL builder, and more. Always free.' },
              { Icon: IconGlobe,  title: 'StudyDesk',           desc: 'AI study tools for students and researchers — homework help, essay outlines, research summaries, citations.' },
              { Icon: IconCheck,  title: 'AI Chat',             desc: 'A fast, free chatbot powered by Groq with knowledge of the platform\'s own content library.' },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="bg-[#141414] border border-[#262626] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                    <Icon size={14} className="text-red-400" />
                  </div>
                  <h3 className="font-semibold text-sm">{title}</h3>
                </div>
                <p className="text-xs text-[#737373] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Values */}
        <div className="mb-14">
          <h2 className="font-semibold text-lg tracking-tight mb-6">What we stand for</h2>
          <div className="space-y-3">
            {[
              { t: 'Honesty over hype',     d: 'We tell you why most people fail at an opportunity before we tell you how to start it. No fake income screenshots. No "6-figure in 30 days" promises.' },
              { t: 'Free, genuinely',        d: 'No trial period. No paywall on the best features. No credit card required. Every tool works for everyone from day one.' },
              { t: 'Built for everywhere',   d: 'The platform auto-detects your country, shows your local currency, and only recommends tools that actually work without a VPN.' },
              { t: 'Gets smarter with use',  d: 'Every search feeds the wiki. Every guide improves the next one. The platform compounds its knowledge over time.' },
            ].map(({ t, d }) => (
              <div key={t} className="flex gap-4 bg-[#141414] border border-[#262626] rounded-xl px-5 py-4">
                <div className="w-5 h-5 bg-red-950/30 border border-red-900/30 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <IconCheck size={9} className="text-red-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm mb-1">{t}</div>
                  <div className="text-xs text-[#737373] leading-relaxed">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-8 text-center">
          <h3 className="font-bold text-xl tracking-tight mb-2">Start exploring</h3>
          <p className="text-[#737373] text-sm mb-6">No signup needed. Just type what you want to build.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/" className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Go to the app →
            </Link>
            <Link href="/contact" className="bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-white px-5 py-2.5 rounded-xl text-sm transition-colors">
              Get in touch
            </Link>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-[#141414] flex flex-wrap gap-4 text-xs text-[#737373]">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
        </div>
      </div>
    </main>
  )
}
