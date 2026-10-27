// ════════════════════════════════════════════════════════════════════
// devtools-agent.mjs — Kivora Browser in-page DevTools agent (v5.25)
//
// The proxied iframe is sandboxed WITHOUT allow-same-origin: its origin
// is opaque, so the parent can NEVER reach contentDocument. Real DevTools
// therefore require an agent that runs INSIDE the page and talks to the
// dock over postMessage. The proxy injects AGENT_SRC as the first script
// in <head> (before any site script), so console / network / error hooks
// see everything from the very first tick.
//
// Protocol (every message carries __kv_dt: 1):
//   agent → parent : hello | console | error | net | perf | nav
//                    | inspect | eval | find | picked
//   parent → agent : inspect | eval | find | findClear | picker | perfSub
//
// Hard rules:
//   - never throw (every hook is try/catch-wrapped; a broken site beats
//     a broken DevTools)
//   - never leak more than caps (depth 6, leaf 240 chars, 48 KB/msg)
//   - hide the hook patch from naive site checks (toString shim)
// ════════════════════════════════════════════════════════════════════

function kvDevtoolsAgent() {
  if (window.__kv_dt_agent) return
  window.__kv_dt_agent = true

  var MAX_DEPTH = 6
  var MAX_LEAF = 240
  var MAX_MSG = 48 * 1024
  var MAX_NET = 400
  var MAX_CONSOLE = 500

  var buffer = { console: [], net: [] } // replayed on hello
  var perfOn = false
  var fpsOn = false
  var frames = 0
  var fpsLast = 0
  var fpsTimer = null
  var pickerOn = false
  var pickerEl = null
  var findState = null

  // ── safe postMessage to the parent ────────────────────────────────
  function send(type, data) {
    try {
      var msg = { __kv_dt: 1, side: 'agent', type: type }
      if (data) for (var k in data) msg[k] = data[k]
      var s = JSON.stringify(msg)
      if (s.length > MAX_MSG) {
        msg.truncated = true
        s = JSON.stringify(msg)
      }
      window.parent.postMessage(s, '*')
    } catch (e) { /* never throw */ }
  }

  // ── value serialization with caps ─────────────────────────────────
  function ser(v, depth) {
    try {
      if (v === undefined) return { u: 1 }
      if (v === null) return { n: 1 }
      var t = typeof v
      if (t === 'number') return isFinite(v) ? v : { s: String(v) }
      if (t === 'boolean') return v
      if (t === 'string') return v.length > MAX_LEAF ? v.slice(0, MAX_LEAF) + '…' : v
      if (t === 'bigint') return { s: String(v) + 'n' }
      if (t === 'symbol' || t === 'function') return { s: (t === 'function' ? 'ƒ ' : '') + (v.name || (t === 'function' ? 'anonymous' : String(v))).slice(0, 60) }
      if (depth >= MAX_DEPTH) return { s: '…' }
      if (v instanceof Error) return { s: (v.stack || (v.name + ': ' + v.message)).slice(0, 1200) }
      if (v instanceof Node) {
        var tag = v.nodeName || ''
        var preview = ''
        if (v.nodeType === 3) preview = String(v.textContent || '').slice(0, 80)
        else if (v.nodeType === 1) {
          preview = '<' + tag.toLowerCase()
          if (v.id) preview += ' id=' + v.id
          if (v.className && typeof v.className === 'string') preview += ' class=' + v.className.split(/\s+/).slice(0, 2).join('.')
          preview += '>'
        }
        return { node: preview || tag }
      }
      if (Array.isArray(v)) {
        var arr = v.slice(0, 20).map(function (x) { return ser(x, depth + 1) })
        if (v.length > 20) arr.push({ s: '…+' + (v.length - 20) })
        return { a: arr, len: v.length }
      }
      if (t === 'object') {
        var keys = Object.keys(v).slice(0, 20)
        var o = {}
        for (var i = 0; i < keys.length; i++) o[keys[i]] = ser(v[keys[i]], depth + 1)
        return { o: o }
      }
      return { s: String(v).slice(0, MAX_LEAF) }
    } catch (e) {
      return { s: '[unserializable]' }
    }
  }

  // ── console hooks ─────────────────────────────────────────────────
  var origConsole = {}
  ;['log', 'warn', 'error', 'info', 'debug'].forEach(function (level) {
    try {
      var orig = console[level] ? console[level].bind(console) : function () {}
      origConsole[level] = orig
      console[level] = function () {
        var args = []
        for (var i = 0; i < arguments.length && i < 12; i++) args.push(ser(arguments[i], 0))
        var entry = { level: level, args: args, ts: Date.now() }
        buffer.console.push(entry)
        if (buffer.console.length > MAX_CONSOLE) buffer.console.shift()
        send('console', entry)
        try { orig.apply(null, arguments) } catch (e) {}
      }
      // naive anti-tamper checks (fn.toString()) see native source
      try { console[level].toString = function () { return orig.toString() } } catch (e) {}
    } catch (e) {}
  })

  // ── error hooks ───────────────────────────────────────────────────
  window.addEventListener('error', function (e) {
    var msg = e && e.error && e.error.stack ? String(e.error.stack).slice(0, 1200) : (e ? (e.message + ' @ ' + (e.filename || '') + ':' + (e.lineno || 0)) : 'unknown error')
    send('error', { level: 'error', args: [{ s: msg }], ts: Date.now(), page: true })
  }, true)
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason
    send('error', { level: 'error', args: [{ s: 'Unhandled rejection: ' + (r && r.stack ? String(r.stack).slice(0, 1000) : ser(r, 1)) }], ts: Date.now(), page: true })
  })

  // ── network hooks (fetch + XHR) ───────────────────────────────────
  var origFetch = window.fetch
  if (origFetch) {
    var patchedFetch = function () {
      var url = ''
      var method = 'GET'
      try {
        if (arguments[0] instanceof Request) { url = arguments[0].url; method = arguments[0].method }
        else { url = String(arguments[0] || ''); method = (arguments[1] && arguments[1].method) || 'GET' }
      } catch (e) {}
      var t0 = Date.now()
      return origFetch.apply(this, arguments).then(
        function (res) {
          try {
            reportNet({ method: method, url: url.slice(0, 300), status: res.status, ok: res.ok, ms: Date.now() - t0, type: (res.headers && res.headers.get('content-type')) || '' })
          } catch (e) {}
          return res
        },
        function (err) {
          try { reportNet({ method: method, url: url.slice(0, 300), status: 0, ok: false, ms: Date.now() - t0, err: String(err && err.message || err).slice(0, 120) }) } catch (e) {}
          throw err
        }
      )
    }
    try { patchedFetch.toString = function () { return origFetch.toString() } } catch (e) {}
    window.fetch = patchedFetch
  }
  try {
    var XO = XMLHttpRequest.prototype.open
    var XS = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.open = function (m, u) {
      try { this.__kv_dt_m = m; this.__kv_dt_u = String(u).slice(0, 300) } catch (e) {}
      return XO.apply(this, arguments)
    }
    XMLHttpRequest.prototype.send = function () {
      var self = this
      var t0 = Date.now()
      this.addEventListener('loadend', function () {
        try {
          reportNet({ method: self.__kv_dt_m || 'GET', url: self.__kv_dt_u || '', status: self.status, ok: self.status >= 200 && self.status < 400, ms: Date.now() - t0, type: (self.getResponseHeader && self.getResponseHeader('content-type')) || '' })
        } catch (e) {}
      })
      return XS.apply(this, arguments)
    }
  } catch (e) {}

  function reportNet(entry) {
    buffer.net.push(entry)
    if (buffer.net.length > MAX_NET) buffer.net.shift()
    send('net', entry)
  }

  // ── navigation + title watcher (SPA-proof omnibox) ────────────────
  var lastTitle = ''
  function reportNav(kind) {
    send('nav', { kind: kind, url: String(location.href).slice(0, 500), title: String(document.title || '').slice(0, 160) })
  }
  try {
    var ps = history.pushState
    history.pushState = function () { var r = ps.apply(this, arguments); setTimeout(function () { reportNav('push') }, 0); return r }
    var rs = history.replaceState
    history.replaceState = function () { var r = rs.apply(this, arguments); setTimeout(function () { reportNav('replace') }, 0); return r }
    window.addEventListener('popstate', function () { reportNav('pop') })
    window.addEventListener('hashchange', function () { reportNav('hash') })
    // title changes surface in the omnibox — but only on CHANGE, never
    // on every DOM mutation (this observer sees the whole document)
    new MutationObserver(function () {
      var t = String(document.title || '')
      if (t && t !== lastTitle) {
        lastTitle = t
        send('nav', { kind: 'title', url: String(location.href).slice(0, 500), title: t.slice(0, 160) })
      }
    }).observe(document.documentElement || document, { subtree: true, childList: true, characterData: true })
  } catch (e) {}

  // ── perf sampling ─────────────────────────────────────────────────
  function perfSnapshot() {
    var out = { nodes: 0, jsHeap: 0, fps: 0, domReady: 0, load: 0, ttfb: 0, resources: 0, transferred: 0 }
    try { out.nodes = document.getElementsByTagName('*').length } catch (e) {}
    try { out.resources = performance.getEntriesByType('resource').length } catch (e) {}
    try {
      var nav = performance.getEntriesByType('navigation')[0] || {}
      out.ttfb = Math.round(nav.responseStart || 0)
      out.domReady = Math.round(nav.domContentLoadedEventEnd || 0)
      out.load = Math.round(nav.loadEventEnd || 0)
      var mem = performance.memory
      if (mem) out.jsHeap = Math.round(mem.usedJSHeapSize / 1048576)
    } catch (e) {}
    out.fps = lastFps
    return out
  }
  var lastFps = 0
  function fpsLoop(ts) {
    if (!fpsOn) return
    frames++
    if (!fpsLast) fpsLast = ts
    if (ts - fpsLast >= 1000) {
      lastFps = Math.round((frames * 1000) / (ts - fpsLast))
      frames = 0
      fpsLast = ts
    }
    requestAnimationFrame(fpsLoop)
  }

  // ── DOM inspector ─────────────────────────────────────────────────
  function nodeInfo(el, depth) {
    var info = { tag: (el.nodeName || '').toLowerCase() }
    try {
      if (el.id) info.id = el.id
      if (el.className && typeof el.className === 'string') info.cls = el.className.split(/\s+/).filter(Boolean).slice(0, 4).join(' ')
      if (el.nodeType === 3) { info.tag = '#text'; info.text = String(el.textContent || '').trim().slice(0, 80) }
      var r = el.getBoundingClientRect ? el.getBoundingClientRect() : null
      if (r) info.box = [Math.round(r.width), Math.round(r.height)]
      if (depth < MAX_DEPTH && el.children && el.children.length) {
        info.kids = []
        var kids = Array.prototype.slice.call(el.children, 0, 30)
        for (var i = 0; i < kids.length; i++) {
          var kn = kids[i].nodeName.toLowerCase()
          if (kn === 'script' || kn === 'style' || kn === 'noscript') continue
          info.kids.push(nodeInfo(kids[i], depth + 1))
        }
        if (el.children.length > 30) info.more = el.children.length - 30
      } else if (el.children) {
        info.kids = el.children.length // count only
      }
    } catch (e) { info.err = 1 }
    return info
  }

  // ── element picker overlay ────────────────────────────────────────
  function ensurePickerEl() {
    if (pickerEl) return pickerEl
    pickerEl = document.createElement('div')
    pickerEl.setAttribute('style', 'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #FF3366;background:rgba(255,51,102,.12);border-radius:2px;transition:all .05s;display:none')
    ;(document.body || document.documentElement).appendChild(pickerEl)
    return pickerEl
  }
  function setPicker(on) {
    pickerOn = !!on
    try {
      if (pickerEl) pickerEl.style.display = 'none'
      if (pickerOn) {
        document.documentElement.style.cursor = 'crosshair'
        document.addEventListener('mousemove', onPickerMove, true)
        document.addEventListener('click', onPickerClick, true)
      } else {
        document.documentElement.style.cursor = ''
        document.removeEventListener('mousemove', onPickerMove, true)
        document.removeEventListener('click', onPickerClick, true)
      }
    } catch (e) {}
  }
  function onPickerMove(e) {
    try {
      var t = e.target
      if (!t || t === pickerEl) return
      var el = ensurePickerEl()
      var r = t.getBoundingClientRect()
      el.style.display = 'block'
      el.style.left = r.left + 'px'
      el.style.top = r.top + 'px'
      el.style.width = r.width + 'px'
      el.style.height = r.height + 'px'
    } catch (e) {}
  }
  function onPickerClick(e) {
    try {
      e.preventDefault()
      e.stopPropagation()
      setPicker(false)
      var t = e.target
      var info = nodeInfo(t, 0)
      try {
        var cs = getComputedStyle(t)
        info.styles = {}
        var interesting = ['display', 'position', 'width', 'height', 'margin', 'padding', 'color', 'background-color', 'font-size', 'font-family', 'border-radius', 'z-index', 'opacity', 'overflow']
        for (var i = 0; i < interesting.length; i++) info.styles[interesting[i]] = cs.getPropertyValue(interesting[i]).slice(0, 60)
      } catch (er) {}
      info.outer = String(t.outerHTML || '').slice(0, 800)
      send('picked', { node: info })
    } catch (er) {}
  }

  // ── find in page ──────────────────────────────────────────────────
  function clearFind() {
    try {
      if (!findState) return
      var marks = document.querySelectorAll('mark[data-kv-dt-find]')
      for (var i = 0; i < marks.length; i++) {
        var m = marks[i]
        var parent = m.parentNode
        parent.replaceChild(document.createTextNode(m.textContent), m)
        parent.normalize()
      }
    } catch (e) {}
    findState = null
  }
  function findInPage(q) {
    clearFind()
    if (!q) return send('find', { count: 0 })
    var count = 0
    var first = null
    try {
      var walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (!n.nodeValue || !n.nodeValue.toLowerCase().includes(q.toLowerCase())) return NodeFilter.FILTER_REJECT
          var p = n.parentNode
          if (p && (p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE' || p.nodeName === 'NOSCRIPT')) return NodeFilter.FILTER_REJECT
          return NodeFilter.FILTER_ACCEPT
        },
      })
      var hits = []
      var node
      while ((node = walker.nextNode()) && hits.length < 500) hits.push(node)
      hits.forEach(function (n) {
        var txt = n.nodeValue
        var lower = txt.toLowerCase()
        var needle = q.toLowerCase()
        var idx = lower.indexOf(needle)
        var frag = document.createDocumentFragment()
        var pos = 0
        while (idx >= 0 && count < 500) {
          if (idx > pos) frag.appendChild(document.createTextNode(txt.slice(pos, idx)))
          var mk = document.createElement('mark')
          mk.setAttribute('data-kv-dt-find', '1')
          mk.setAttribute('style', 'background:#FF3366;color:#fff;border-radius:2px')
          mk.textContent = txt.slice(idx, idx + q.length)
          frag.appendChild(mk)
          if (!first) first = mk
          count++
          pos = idx + q.length
          idx = lower.indexOf(needle, pos)
        }
        if (pos < txt.length) frag.appendChild(document.createTextNode(txt.slice(pos)))
        n.parentNode.replaceChild(frag, n)
      })
      if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } catch (e) {}
    findState = { q: q, count: count }
    send('find', { count: count })
  }

  // ── eval (live console — INDIRECT eval so code runs in global scope,
  //    exactly like pasting into real DevTools) ─────────────────────
  function runEval(id, code) {
    var out
    try {
      var result = (0, eval)(code) // eslint-disable-line no-eval
      out = { id: id, ok: true, value: ser(result, 0) }
    } catch (e) {
      out = { id: id, ok: false, error: String(e && e.stack || e).slice(0, 1200) }
    }
    send('eval', out)
  }

  // ── parent command channel ────────────────────────────────────────
  window.addEventListener('message', function (e) {
    try {
      if (e.source !== window.parent) return
      var d = e.data
      if (typeof d === 'string') { try { d = JSON.parse(d) } catch (er) { return } }
      if (!d || d.__kv_dt !== 1 || d.side === 'agent') return
      switch (d.type) {
        case 'inspect': send('inspect', { tree: nodeInfo(document.documentElement, 0), url: String(location.href).slice(0, 400) }); break
        case 'eval': runEval(d.id, String(d.code || '')); break
        case 'find': findInPage(String(d.q || '')); break
        case 'findClear': clearFind(); break
        case 'picker': setPicker(!!d.on); break
        case 'perfSub': {
          perfOn = !!d.on
          fpsOn = perfOn
          if (perfOn) {
            send('perf', perfSnapshot())
            clearInterval(fpsTimer)
            fpsTimer = setInterval(function () { if (perfOn) send('perf', perfSnapshot()) }, 2000)
            requestAnimationFrame(fpsLoop)
          } else {
            clearInterval(fpsTimer)
            fpsLast = 0
            frames = 0
          }
          break
        }
      }
    } catch (er) {}
  })

  // ── hello (after load, with replay) ───────────────────────────────
  function hello() {
    var meta = { url: '', title: '', viewport: [0, 0], dpr: 1, online: true, ua: '', touch: false, lang: '' }
    try {
      meta.url = String(location.href).slice(0, 500)
      meta.title = String(document.title || '').slice(0, 160)
      meta.viewport = [window.innerWidth, window.innerHeight]
      meta.dpr = window.devicePixelRatio || 1
      meta.online = navigator.onLine !== false
      meta.ua = navigator.userAgent.slice(0, 200)
      meta.touch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0
      meta.lang = navigator.language || ''
    } catch (e) {}
    send('hello', { meta: meta, replay: { console: buffer.console.slice(-100), net: buffer.net.slice(-100) } })
  }
  if (document.readyState === 'complete') setTimeout(hello, 0)
  else window.addEventListener('load', function () { setTimeout(hello, 0) })
}

// The proxy injects this exact source as the first <head> script.
// function.toString() round-trips the implementation above byte-for-byte,
// so the tested module and the shipped bytes can never drift.
export const AGENT_SRC = `(${kvDevtoolsAgent.toString()})();`

export const AGENT_TAG = `<script>${AGENT_SRC}</script>`
