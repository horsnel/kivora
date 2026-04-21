// scripts/update-rates.js
// Run via GitHub Actions weekly

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function updateRates() {
  console.log('[update-rates] Fetching fresh exchange rates...')

  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    const data = await res.json()

    await supabase.from('exchange_rates').upsert({
      id: 1,
      rates: data.rates,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })

    const ngn = data.rates?.NGN
    const ghs = data.rates?.GHS
    const kes = data.rates?.KES
    console.log(`[update-rates] Done. 1 USD = ₦${ngn} | GH₵${ghs} | KSh${kes}`)
  } catch (err) {
    console.error('[update-rates] Error:', err)
    process.exit(1)
  }
}

updateRates()
