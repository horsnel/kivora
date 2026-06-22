// ── Client-safe plan + credit-cost constants ──────────────────────
// Safe to import from client components ('use client') — no server-only deps.
//
// Keep in sync with the `plans` table seeded in credits-migration.sql
// and with lib/credits.js (which re-exports from here).

export const PLANS = {
  free: {
    code: 'free',
    name: 'Free',
    priceNGN: 0,
    priceUSD: 0,
    daily: 10,
    monthly: 25,
    storageGB: 2,
    features: {
      deepResearch: false,
      imageOsint: false,
      voice: false,
      teamSeats: false,
      customDomain: false,
      priorityCompute: false,
    },
  },
  pro: {
    code: 'pro',
    name: 'Pro',
    priceNGN: 2500,
    priceUSD: 17, // $1.67 rounded for display
    daily: 15,
    monthly: 200,
    storageGB: 10,
    features: {
      deepResearch: true,
      imageOsint: false,
      voice: false,
      teamSeats: false,
      customDomain: false,
      priorityCompute: false,
    },
  },
  max: {
    code: 'max',
    name: 'Max',
    priceNGN: 7500,
    priceUSD: 500, // $5.00 in cents
    daily: 20,
    monthly: 600,
    storageGB: 50,
    features: {
      deepResearch: true,
      imageOsint: true,
      voice: true,
      teamSeats: false,
      customDomain: true,
      priorityCompute: true,
    },
  },
  team: {
    code: 'team',
    name: 'Team',
    priceNGN: 20000,
    priceUSD: 1333, // $13.33
    daily: 30,
    monthly: 1800,
    storageGB: 100,
    features: {
      deepResearch: true,
      imageOsint: true,
      voice: true,
      teamSeats: true,
      customDomain: true,
      priorityCompute: true,
    },
  },
}

export const PLAN_LIST = [PLANS.free, PLANS.pro, PLANS.max, PLANS.team]

export const CREDIT_COSTS = {
  chat: 1,
  chat_reasoning: 3,
  research_quick: 5,
  research_deep: 15,
  image_osint: 25,
  explore: 2,
  opportunities: 3,
  study: 2,
  devtools: 3,
  reelpen: 4,
  voice_tts: 2,
  voice_stt: 2,
}

// Pretty-print balance for UI
export function formatBalance(balance) {
  if (!balance) return { daily: 0, monthly: 0, bonus: 0, total: 0 }
  return {
    daily: balance.daily_credits ?? 0,
    monthly: (balance.monthly_credits ?? 0) + (balance.rolled_over_credits ?? 0),
    bonus: balance.bonus_credits ?? 0,
    total: (balance.daily_credits ?? 0) + (balance.monthly_credits ?? 0) + (balance.rolled_over_credits ?? 0) + (balance.bonus_credits ?? 0),
  }
}
