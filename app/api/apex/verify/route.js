export const runtime = 'edge' 

import { getSupabaseAdmin } from '@/lib/supabase'

// ══════════════════════════════════════════════════════════════════
// APEX 2.0 VERIFY API — Claim verification endpoint
// GET  /api/apex/verify?page_id=...  — Get claims for a wiki page
// POST /api/apex/verify              — Persist claim verifications
// ══════════════════════════════════════════════════════════════════

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('page_id')
  const claimHash = searchParams.get('claim_hash')

  const admin = getSupabaseAdmin()
  if (!admin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    if (pageId) {
      const { data, error } = await admin
        .from('apex_claim_verifications')
        .select('*')
        .eq('page_id', pageId)
        .order('confidence', { ascending: false })

      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }

      return Response.json({ claims: data || [] })
    }

    if (claimHash) {
      const { data, error } = await admin
        .from('apex_claim_verifications')
        .select('*')
        .eq('claim_hash', claimHash)
        .single()

      if (error || !data) {
        return Response.json({ error: 'Claim not found' }, { status: 404 })
      }

      return Response.json({ claim: data })
    }

    return Response.json({ error: 'page_id or claim_hash required' }, { status: 400 })
  } catch (err) {
    console.error('[APEX Verify] GET error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  const admin = getSupabaseAdmin()
  if (!admin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { pageId, claims } = body

    if (!claims || !Array.isArray(claims)) {
      return Response.json({ error: 'claims array required' }, { status: 400 })
    }

    const results = []

    for (const claim of claims) {
      const claimText = claim.statement || claim.text || String(claim)
      const normalized = claimText.toLowerCase().trim()

      const encoder = new TextEncoder()
      const hashData = encoder.encode(normalized)
      const hashBuffer = await crypto.subtle.digest('SHA-256', hashData)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const claimHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      const data = {
        page_id: pageId || null,
        claim_text: claimText,
        claim_hash: claimHash,
        epistemic_status: claim.epistemic_status || 'UNVERIFIED',
        confidence: claim.confidence || 0.0,
        evidence_type: claim.evidence_type || '',
        supporting_sources: JSON.stringify(claim.supporting_sources || []),
        conflicting_sources: JSON.stringify(claim.conflicting_sources || []),
        sample_size: claim.sample_size || null,
        study_year: claim.study_year || claim.year || null,
      }

      const { data: existing } = await admin
        .from('apex_claim_verifications')
        .select('id')
        .eq('claim_hash', claimHash)

      if (existing && existing.length > 0) {
        await admin
          .from('apex_claim_verifications')
          .update(data)
          .eq('id', existing[0].id)
        results.push({ claimHash, action: 'updated', id: existing[0].id })
      } else {
        const { data: inserted } = await admin
          .from('apex_claim_verifications')
          .insert(data)
          .select('id')
        results.push({ claimHash, action: 'created', id: inserted?.[0]?.id })
      }
    }

    return Response.json({ success: true, results, count: results.length })
  } catch (err) {
    console.error('[APEX Verify] POST error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
