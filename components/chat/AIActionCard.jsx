'use client'
import { IconTool } from '@/components/Icons'
import { useTranslation } from '@/components/LanguageProvider'

// v5.30.15 — system-action card. Renders a tool-call payload the model
// spelled out as pseudo-XML text (<file type="json" title="…">…</file> and
// siblings) as a proper card instead of dumping raw tag+JSON into the
// message stream. Normal flow: the backend converts these into real tool
// calls before anything renders (lib/toolCallRecovery.js) — this card is
// what legacy persisted messages and unrecoverable payloads fall back to.
// Chrome matches the app's card language: #111 surface, #262626 border,
// rounded-2xl, #FF3366 accent chip (ChatNoticeCard convention).
export default function AIActionCard({ toolName, title, args, rawJson, valid }) {
  const { t } = useTranslation()
  const pretty = (() => {
    if (args !== null && args !== undefined) {
      try {
        return JSON.stringify(args, null, 2)
      } catch {
        /* fall through to raw */
      }
    }
    return rawJson || ''
  })()
  return (
    <div className="my-3 max-w-2xl rounded-2xl border border-[#262626] bg-[#111] overflow-hidden text-left">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#1a1a1a] border-b border-[#262626]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 shrink-0 bg-[#FF3366]/10 border border-[#FF3366]/25 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#FF3366]">
            <IconTool size={11} />
            {t('chat.action.badge')}
          </span>
          <span className="text-[13px] font-medium text-[#e2e2e2] truncate min-w-0">
            {title || toolName}
          </span>
        </div>
        <span
          className="shrink-0 text-[10px] uppercase tracking-wider text-[#737373]"
          style={{
            fontFamily:
              "var(--font-jetbrains, 'JetBrains Mono'), 'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, monospace",
          }}
        >
          {toolName}
        </span>
      </div>
      <div className="px-4 py-3">
        <pre className="bg-[#0f0f0f] border border-[#262626] rounded-lg p-3 text-[11px] leading-[16px] overflow-x-auto max-h-[min(320px,40dvh)] whitespace-pre">
          {/* globals.css forces `code, pre, kbd` onto var(--font-mono) with
              !important — and --font-mono computes guaranteed-invalid app-wide
              (its :root value references var(--font-jetbrains), which next/font
              only defines on body — custom properties resolve at :root first).
              Every code block in the app therefore silently renders Inter. A
              pre's font cannot be overridden inline (the !important rule wins),
              so the mono stack rides on an inner div the rule cannot match.
              Pre-existing app-wide issue — flagged, not fixed here. */}
          <div
            style={{
              fontFamily:
                "var(--font-jetbrains, 'JetBrains Mono'), 'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, monospace",
            }}
          >
            {pretty}
          </div>
        </pre>
      </div>
      <div className="px-4 py-1.5 border-t border-[#262626] text-[10px] uppercase tracking-wider text-[#737373]">
        {valid ? t('chat.action.footer') : t('chat.action.footer_unparsed')}
      </div>
    </div>
  )
}
