// ── Paystack Integration ──────────────────────────────────────────
// Wraps the Paystack REST API for Kivora.
// Docs: https://paystack.com/docs/api/
//
// Required env vars (set in Cloudflare Pages → Settings → Environment Variables):
//   PAYSTACK_SECRET_KEY  — sk_test_... or sk_live_...
//   NEXT_PUBLIC_APP_URL  — https://kivora.pages.dev (or custom domain)
//
// Flow:
//   1. User clicks "Upgrade to Pro" on /pricing
//   2. /api/billing/checkout calls initializeTransaction() → Paystack returns auth_url
//   3. User is redirected to Paystack's hosted checkout, pays, then Paystack
//      redirects back to /api/billing/verify?reference=...
//   4. /api/billing/verify calls verifyTransaction() to confirm payment
//   5. On success, we call upgrade_user_plan() to upgrade the user's plan
//   6. Paystack also fires a webhook to /api/billing/webhook as a backup

import { getEnvVar } from '@/lib/cfEnv'

const PAYSTACK_BASE = 'https://api.paystack.co'

// ── Get Secret Key ────────────────────────────────────────────────
async function getSecretKey() {
  const key = await getEnvVar('PAYSTACK_SECRET_KEY')
  if (!key) {
    console.error('[paystack] PAYSTACK_SECRET_KEY env var not set')
    throw new Error('Paystack not configured')
  }
  return key
}

// ── Initialize Transaction ────────────────────────────────────────
// Creates a Paystack checkout session. Returns { authorization_url, reference, access_code }.
//
// amountKobo: amount in kobo (1 NGN = 100 kobo). E.g., ₦2,500 → 250000
// email: user's email (required by Paystack)
// metadata: arbitrary JSON (we attach user_id, plan_code, billing_cycle)
export async function initializeTransaction({
  amountKobo,
  email,
  reference,
  metadata = {},
  currency = 'NGN',
  callbackUrl,
}) {
  const key = await getSecretKey()
  const appUrl = await getEnvVar('NEXT_PUBLIC_APP_URL') || 'https://kivora.pages.dev'

  const body = {
    email,
    amount: amountKobo,
    currency,
    reference,
    callback_url: callbackUrl || `${appUrl}/api/billing/verify?reference=${reference}`,
    metadata: {
      ...metadata,
      source: 'kivora',
      app_url: appUrl,
    },
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })

  const data = await res.json()
  if (!data.status) {
    console.error('[paystack] initialize failed:', data.message)
    throw new Error(data.message || 'Paystack initialization failed')
  }

  return data.data // { authorization_url, access_code, reference }
}

// ── Verify Transaction ────────────────────────────────────────────
// Confirms a payment with Paystack after the user returns from checkout.
// Returns the full transaction object or throws on failure.
export async function verifyTransaction(reference) {
  const key = await getSecretKey()

  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  })

  const data = await res.json()
  if (!data.status) {
    console.error('[paystack] verify failed:', data.message)
    throw new Error(data.message || 'Paystack verification failed')
  }

  return data.data // { id, status, amount, currency, reference, customer, metadata, ... }
}

// ── Verify Webhook Signature ──────────────────────────────────────
// Paystack signs every webhook payload with HMAC-SHA512 using your secret key.
// Returns true if the signature matches.
export async function verifyWebhookSignature(payload, signature) {
  if (!signature) return false
  const key = await getEnvVar('PAYSTACK_SECRET_KEY')
  if (!key) return false

  // Use Web Crypto API (available in edge runtime)
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const payloadData = encoder.encode(payload)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, payloadData)
  const expected = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return expected === signature
}

// ── Create Customer (optional — for subscriptions) ────────────────
export async function createCustomer({ email, firstName, lastName, phone }) {
  const key = await getSecretKey()
  const res = await fetch(`${PAYSTACK_BASE}/customer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
    }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json()
  if (!data.status) throw new Error(data.message)
  return data.data
}

// ── Create Plan (one-time setup, then save the plan code) ─────────
// Paystack "Plans" are reusable subscription templates. Run this once per
// Kivora plan to register them with Paystack, then store the returned
// plan_code in the `plans` table (paystack_plan_code column — TODO: add).
export async function createPaystackPlan({ name, amountKobo, interval = 'monthly', description }) {
  const key = await getSecretKey()
  const res = await fetch(`${PAYSTACK_BASE}/plan`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      amount: amountKobo,
      interval,
      currency: 'NGN',
      description,
    }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json()
  if (!data.status) throw new Error(data.message)
  return data.data // { plan_code, name, amount, interval, ... }
}

// ── Subscribe Customer to a Plan ──────────────────────────────────
// For recurring subscriptions. Requires a previously-tokenized card
// (via Paystack's inline checkout) — pass the authorization_code.
export async function subscribeToPlan({ customerCode, planCode, authorizationCode }) {
  const key = await getSecretKey()
  const res = await fetch(`${PAYSTACK_BASE}/subscription`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer: customerCode,
      plan: planCode,
      authorization: authorizationCode,
    }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json()
  if (!data.status) throw new Error(data.message)
  return data.data
}

// ── Disable Subscription (cancel plan) ────────────────────────────
export async function disableSubscription(subscriptionCode) {
  const key = await getSecretKey()
  const res = await fetch(`${PAYSTACK_BASE}/subscription/disable`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code: subscriptionCode, token: 'cancel' }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json()
  return data.status === true
}

// ── List Banks (for bank transfer checkout) ───────────────────────
export async function listBanks() {
  const key = await getSecretKey()
  const res = await fetch(`${PAYSTACK_BASE}/bank?country=nigeria`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json()
  if (!data.status) throw new Error(data.message)
  return data.data // [{ name, slug, code, ... }]
}
