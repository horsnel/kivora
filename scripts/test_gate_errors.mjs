// Regression tests: gate failures must travel in-band on streaming routes.
//
// Root cause of "I couldn't generate a response for that." + "engine out of
// capacity": credit/plan gates inside sseResponse callbacks returned bare
// Response objects, which ReadableStream.start() silently DISCARDS — the
// client got an event-less stream (rendered as the generic empty-reply
// fallback) and the explore page mapped 402 onto a misleading engine message.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(path.join(root, p), 'utf8')
const chatRoute = read('app/api/chat/route.js')
const chatClient = read('app/chat/ChatClient.jsx')
const explorePage = read('app/explore/page.jsx')

let pass = 0
let fail = 0
const t = (name, cond) => { if (cond) { pass++; console.log(`  PASS  ${name}`) } else { fail++; console.log(`  FAIL  ${name}`) } }

console.log('── chat route: gates are stream-aware ──')
t('no bare `return creditCheck.response` (discarded mid-stream)',
  !chatRoute.includes('return creditCheck.response'))
t('no bare `return proGate.response` (discarded mid-stream)',
  !chatRoute.includes('return proGate.response'))
t('credits gate routes payload through stream-aware json() helper',
  /if \(!creditCheck\.ok\) \{[\s\S]{0,400}?gateRes\.json\(\)[\s\S]{0,200}?return json\(gatePayload, gateRes\.status\)/.test(chatRoute))
t('pro gate routes payload through stream-aware json() helper',
  /if \(proGate\) \{[\s\S]{0,400}?return json\(gatePayload, gateRes\.status\)/.test(chatRoute))
t('IP rate-limit uses the json() helper (in-band error event)',
  /rateLimit\(ip\)\.ok\) \{[\s\S]{0,300}?return json\(\{ error: "You're sending requests too quickly/.test(chatRoute))
t('json() helper emits {type:error} events in stream mode',
  /send\(\{ type: 'error', status: status \|\| 200, \.\.\.payload \}\)/.test(chatRoute))

console.log('── behavioral: ReadableStream.start() discards return values ──')
// Reproduce the exact mechanism: a handler that RETURNS a Response from a
// stream start() callback produces zero data events; a handler that calls
// send() first delivers its event. This is why bare returns broke the client.
{
  const enc = new TextEncoder()
  let received = []
  const makeStream = (handler) => new ReadableStream({
    async start(controller) {
      const send = (e) => received.push(JSON.parse(JSON.stringify(e)))
      try { await handler(send) } catch (e) { send({ type: 'error', error: String(e) }) }
      finally { try { controller.close() } catch {} }
    },
  })
  // eslint-disable-next-line no-new
  new Response(makeStream(async (send) => {
    return Response.json({ error: 'You are out of credits.' }, { status: 402 }) // the OLD buggy shape
  }), {}).status // touch to settle
  await new Promise(r => setTimeout(r, 10))
  t('bare Response return from handler yields ZERO events (bug mechanism)', received.length === 0)
  // eslint-disable-next-line no-new
  new Response(makeStream(async (send) => {
    send({ type: 'error', status: 402, error: 'You are out of credits.' })
    return null // the NEW fixed shape
  }), {}).status
  await new Promise(r => setTimeout(r, 10))
  t('send() + null return yields the in-band error event', received.length === 1 && received[0].status === 402)
}

console.log('── chat client: gate errors surface with upgrade nudge ──')
t('stream path appends upgrade hint when payload carries upgrade_url',
  (chatClient.match(/data\.error \+ \(data\.upgrade_url \? ' Upgrade your plan to keep going\.' : ''\)/g) || []).length >= 1)
t('legacy JSON path appends the same hint',
  /data\.reply \|\| data\.error \|\| "I couldn't generate a response[^"]+"\) \+ \(data\.upgrade_url/.test(chatClient))

console.log('── explore page: 402/403 show the real reason, 5xx keep engine copy ──')
t('402/403 branch exists and surfaces server error verbatim',
  /res\.status === 402 \|\| res\.status === 403\s*\?\s*\(data\.error \|\| 'This feature needs more credits or a plan upgrade\.'\)/.test(explorePage))
t('engine-at-capacity copy reserved for 5xx only',
  explorePage.indexOf('res.status >= 500') > explorePage.indexOf('res.status === 402 || res.status === 403') &&
  explorePage.includes('Our generation engine is temporarily out of capacity'))
t('429 branch unchanged', /res\.status === 429\s*\?\s*\(data\.error \|\| 'Too many requests/.test(explorePage))

console.log(`\n${pass}/${pass + fail} PASS`)
process.exit(fail > 0 ? 1 : 0)
