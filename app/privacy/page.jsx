import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Kivora',
  description: 'How Kivora collects, uses, and protects your information.',
}

const LAST_UPDATED = 'April 20, 2026'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-14">
        <div className="mb-10">
          <Link href="/welcome" className="text-xs text-[#737373] hover:text-white transition-colors">← Back to home</Link>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-[#737373] text-sm">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="prose-legal space-y-8 text-[#d4d4d4] text-sm leading-relaxed">

          <Section title="1. Introduction">
            <p>Kivora ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit Kivora and use our platform tools.</p>
            <p>By using Kivora, you agree to the collection and use of information as described in this policy. If you do not agree, please do not use the platform.</p>
          </Section>

          <Section title="2. Information We Collect">
            <p><strong className="text-white">Information you provide:</strong> When you create an account, we collect your email address and optionally your full name and onboarding preferences (your goal, experience level, location, and interests).</p>
            <p><strong className="text-white">Usage data:</strong> We collect information about how you use the platform — which tools you use, what queries you search, and which pages you visit. This data is used to improve the platform and personalize your experience.</p>
            <p><strong className="text-white">Automatically collected data:</strong> We collect your approximate location based on IP address to suggest your local currency. We do not store your precise location.</p>
            <p><strong className="text-white">Chat and saved content:</strong> If you are logged in, your chat sessions and saved opportunity results are stored in our database so you can access them across devices.</p>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-disc list-inside space-y-1.5 text-[#d4d4d4]">
              <li>To provide, operate, and improve the Kivora platform</li>
              <li>To personalize your experience based on onboarding answers</li>
              <li>To detect and suggest your local currency</li>
              <li>To save and display your chat history and saved results (if logged in)</li>
              <li>To send transactional emails (account confirmation, password reset)</li>
              <li>To analyze platform usage and improve features</li>
              <li>To prevent abuse and enforce our Terms of Service</li>
            </ul>
            <p>We do not sell your personal data. We do not serve ads. We do not share your data with third parties for marketing purposes.</p>
          </Section>

          <Section title="4. Third-Party Services">
            <p>Kivora uses the following third-party services to operate:</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li><strong className="text-white">Supabase</strong> — database and authentication provider</li>
              <li><strong className="text-white">Groq</strong> — AI inference provider that processes your queries</li>
              <li><strong className="text-white">Cloudflare</strong> — hosting, CDN, and DDoS protection</li>
              <li><strong className="text-white">ipapi.co</strong> — IP-based country detection (no stored data)</li>
              <li><strong className="text-white">ExchangeRate-API</strong> — currency conversion rates</li>
            </ul>
            <p>Each of these services has their own privacy policies. We encourage you to review them. We use only the data necessary to operate the platform and do not share excess data with providers.</p>
          </Section>

          <Section title="5. Data Storage and Security">
            <p>Your data is stored in Supabase (PostgreSQL) with row-level security enabled. This means users can only access their own data — not other users' data.</p>
            <p>We use HTTPS for all data in transit. Passwords are hashed by Supabase Auth and are never stored in plain text.</p>
            <p>We do not store payment information. Kivora is free and does not process payments.</p>
          </Section>

          <Section title="6. Data Retention">
            <p>Account data is retained as long as your account exists. If you delete your account, your profile, saved results, and chat history are permanently deleted within 30 days.</p>
            <p>Explore cache results (opportunity guides) are not tied to user accounts and may persist for the benefit of all users.</p>
          </Section>

          <Section title="7. Cookies and Local Storage">
            <p>Kivora uses browser localStorage to store your currency preference and anonymous session state. No advertising cookies are set. We use Umami Analytics which is cookieless and GDPR-compliant.</p>
          </Section>

          <Section title="8. Your Rights">
            <p>Depending on your location, you may have rights to access, correct, or delete your personal data. To exercise these rights, contact us at the email below. We will respond within 30 days.</p>
          </Section>

          <Section title="9. Children">
            <p>Kivora is not directed at children under 13. We do not knowingly collect data from children. If you believe a child has provided personal information, contact us immediately.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>We may update this policy periodically. We will notify registered users by email for material changes. Continued use of the platform after changes constitutes acceptance.</p>
          </Section>

          <Section title="11. Contact">
            <p>For privacy-related questions, contact us at: <a href="mailto:privacy@kivora.com" className="text-red-400 hover:text-red-300 transition-colors">privacy@kivora.com</a></p>
          </Section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#141414] flex gap-4 text-xs text-[#737373]">
          <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
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
