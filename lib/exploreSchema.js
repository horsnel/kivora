// ── Explore result schema-drift guard ─────────────────────────────
// The explore guide is AI-generated JSON. Models occasionally drift from
// the requested schema (e.g. failure_reasons: [{reason:"..."}] instead of
// string[]). One drifted field used to crash the whole guide page with
// React error #31 ("Objects are not valid as a React child") and render
// the generic "Something went wrong" boundary. These helpers coerce every
// field to the shape the UI expects BEFORE it reaches the renderer.
//
// Used by both POST /api/explore (sanitize before caching) and
// /explore/[slug] (defensive normalization at render time — covers guides
// cached before this fix).

export function asText(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(', ')
  if (typeof v === 'object') {
    // Common AI-drift shapes: {reason}, {text}, {title}, {name}, …
    for (const key of ['reason', 'text', 'title', 'name', 'description', 'task', 'action', 'step', 'note', 'value', 'label', 'item']) {
      if (typeof v[key] === 'string' && v[key].trim()) return v[key]
      if (typeof v[key] === 'number') return String(v[key])
    }
    const inner = Object.values(v).map(asText).filter(Boolean).join(', ')
    return inner
  }
  return ''
}

export function asStringArray(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map(asText).map(s => s.trim()).filter(Boolean)
}

export function asNumber(v, fallback = 0) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(asText(v).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : fallback
}

export function normalizeExploreResult(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    ...r,
    title: asText(r.title) || 'Untitled guide',
    tagline: asText(r.tagline),
    overview: asText(r.overview),
    income_period: asText(r.income_period) || 'mo',
    income_min: asNumber(r.income_min),
    income_max: asNumber(r.income_max),
    start_days: asNumber(r.start_days),
    monthly_cost: asNumber(r.monthly_cost),
    tags: asStringArray(r.tags),
    works_in: asStringArray(r.works_in),
    challenges: asStringArray(r.challenges),
    success_tips: asStringArray(r.success_tips),
    failure_reasons: asStringArray(r.failure_reasons),
    cost_breakdown: (Array.isArray(r.cost_breakdown) ? r.cost_breakdown : []).map(it => ({
      tool: asText(it?.tool ?? it?.name ?? it?.item),
      note: asText(it?.note ?? it?.description ?? it?.what),
      cost: asNumber(it?.cost ?? it?.price),
    })),
    tool_stack: (Array.isArray(r.tool_stack) ? r.tool_stack : []).filter(t => t && typeof t === 'object').map(t => ({
      ...t,
      name: asText(t.name ?? t.tool),
      use: asText(t.use ?? t.purpose),
      cost: asText(t.cost),
      url: typeof t.url === 'string' ? t.url : '',
      works_without_vpn: Boolean(t.works_without_vpn),
      accepts_local_payment: Boolean(t.accepts_local_payment),
    })),
    action_plan: (Array.isArray(r.action_plan) ? r.action_plan : []).map(s => ({
      period: asText(s?.period ?? s?.timeline ?? s?.week ?? s?.month ?? s?.phase),
      task: asText(s?.task ?? s?.action ?? s?.description ?? s?.step ?? s),
    })),
  }
}
