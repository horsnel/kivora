// esbuild harness entry — renderToString(AIActionCard) for the v5.30.15
// unit suite. Bundled with --alias:@=. so the component's @/ imports resolve.
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import AIActionCard from '@/components/chat/AIActionCard'
import { LanguageProvider } from '@/components/LanguageProvider'

export function renderCard(props) {
  return renderToString(
    createElement(LanguageProvider, null, createElement(AIActionCard, props))
  )
}
