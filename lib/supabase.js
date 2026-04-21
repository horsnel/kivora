import { createClient } from '@supabase/supabase-js'

function makeClient(urlKey, keyKey) {
  const url = process.env[urlKey] || ''
  const key = process.env[keyKey] || ''
  if (!url || !key) return null
  return createClient(url, key)
}

export const supabaseAdmin = makeClient('SUPABASE_URL', 'SUPABASE_SERVICE_KEY')
export const supabasePublic = makeClient('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
