import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — Kivora',
  description: 'The terms and conditions for using Kivora.',
}

const LAST_UPDATED = 'April 20, 2026'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="mb-10">
          <Link href="/welcome" className="text-xs text-[#737373] hover:text-white transition-colors">← Back to home</Link>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Terms of Service</h1>
          <p className="text-[#737373] text-sm">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-8 text-[#d4d4d4] text-sm leading-relaxed">

          <Section title="1. Acceptance of Terms">
            <p>By accessing or using Kivora ("the platform", "the service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the platform.</p>
            <p>These terms apply to all visitors and users, including those who use the platform without an account.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>Kivora is a free AI-powered platform providing tools and guides for builders, developers, students, and entrepreneurs worldwide. The platform includes an opportunity explorer, AI chat, study tools, developer tools, and curated guides.</p>
            <p>The platform is provided free of charge. We reserve the right to introduce optional paid features in the future with advance notice.</p>
          </Section>

          <Section title="3. Acceptable Use">
            <p>You agree not to use Kivora to:</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Generate content that is illegal, harmful, fraudulent, or deceptive</li>
              <li>Harass, abuse, or harm others</li>
              <li>Distribute spam, malware, or phishing content</li>
              <li>Attempt to circumvent rate limits, access controls, or security measures</li>
              <li>Scrape or systematically extract data from the platform without permission</li>
              <li>Impersonate other users, companies, or individuals</li>
              <li>Use the platform to train AI models without express written permission</li>
              <li>Violate any applicable local, national, or international law</li>
            </ul>
          </Section>

          <Section title="4. AI-Generated Content">
            <p>Kivora uses AI models to generate content including opportunity guides, responses, tool outputs, and summaries. You acknowledge that:</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>AI-generated content may be inaccurate, incomplete, or outdated</li>
              <li>Income and cost estimates in opportunity guides are illustrative and not guaranteed</li>
              <li>Content is not financial, legal, or professional advice</li>
              <li>You are responsible for verifying any information before acting on it</li>
            </ul>
            <p>Kivora does not guarantee any specific results, income, or outcomes from information provided on the platform.</p>
          </Section>

          <Section title="5. User Accounts">
            <p>Accounts are optional. If you create an account, you are responsible for maintaining the security of your credentials. You must provide accurate information and are responsible for all activity under your account.</p>
            <p>We reserve the right to suspend or terminate accounts that violate these terms without prior notice.</p>
          </Section>

          <Section title="6. Intellectual Property">
            <p>The Kivora platform, branding, and underlying code are owned by Kivora and protected by applicable intellectual property laws. You may not copy, reproduce, or distribute any part of the platform without permission.</p>
            <p>Content you generate using the platform belongs to you, subject to the AI provider's terms. You grant us a limited, non-exclusive license to display and cache generated content for platform operation (e.g. the explore results cache).</p>
          </Section>

          <Section title="7. Third-Party Links and Services">
            <p>Kivora may link to third-party tools, services, and websites. We are not responsible for their content, privacy practices, or terms. Use third-party services at your own risk.</p>
          </Section>

          <Section title="8. Disclaimers">
            <p>THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.</p>
            <p>We make no representations about the accuracy, completeness, or suitability of any content on the platform for any purpose.</p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, KIVORA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM.</p>
          </Section>

          <Section title="10. Changes to Terms">
            <p>We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms. Material changes will be communicated to registered users by email.</p>
          </Section>

          <Section title="11. Governing Law">
            <p>These terms shall be governed by and construed in accordance with applicable law. Any disputes shall be resolved through binding arbitration or the courts of competent jurisdiction.</p>
          </Section>

          <Section title="12. Contact">
            <p>For questions about these terms: <a href="mailto:legal@kivora.com" className="text-red-400 hover:text-red-300 transition-colors">legal@kivora.com</a></p>
          </Section>

        </div>

        <div className="mt-12 pt-8 border-t border-[#141414] flex gap-4 text-xs text-[#737373]">
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          <Link href="/" className="hover:text-white transition-colors">Back to app</Link>
        </div>
      </div>
    </main>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-white font-semibold text-base mb-3 tracking-tight">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}
