// GET /api/push/key — expose the VAPID public key so the client can
// subscribe without a build-time inlined secret (works even for cached
// bundles after a key rotation). Returns { key: '' } when push is not
// configured — clients treat an empty key as "feature off".
import { getEnvVar } from '@/lib/cfEnv'

// Required for Cloudflare Pages edge runtime
export const runtime = 'edge'

export async function GET() {
  const key = (await getEnvVar('VAPID_PUBLIC_KEY')) || ''
  return Response.json(
    { key },
    { headers: { 'Cache-Control': 'public, max-age=300' } }
  )
}
