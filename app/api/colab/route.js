export const runtime = 'edge' 

import { getEnvVar } from '@/lib/cfEnv'
import { rateLimit, getClientIP } from '@/lib/ratelimit'
import { resolveUserAndAdmin } from '@/lib/authUser'
import { requireFeatureAccess } from '@/lib/credits'
import { createClient } from '@supabase/supabase-js'
import {
  setColabAccessToken,
  isColabAvailable,
  createSession,
  executeCode,
  runGpuJob,
  stopSession,
  listSessions,
  getSessionStatus,
  installPackages,
  listFiles,
  downloadFile,
  uploadFile,
  mountDrive,
  getAcceleratorOptions,
  getOAuthUrl,
  cleanup,
} from '@/lib/colab'

// ── Colab API Route ──
// Handles all Colab CLI operations from the frontend
// Actions: auth-url, status, new, exec, run, stop, sessions, install, ls, download, upload, drivemount, accelerators

// Accelerator → plan tier. Mirrors lib/colab.js getAcceleratorOptions():
//   free    — CPU, T4
//   pro     — L4, G4, all TPUs  → requires the Pro plan ('deepResearch')
//   premium — A100, H100        → requires the Max plan ('priorityCompute')
function acceleratorTier(gpu, tpu) {
  if (tpu) return 'pro'
  const g = (gpu || '').toString().toLowerCase()
  if (!g || g === 'cpu' || g === 't4') return 'free'
  if (g === 'l4' || g === 'g4') return 'pro'
  return 'premium'
}

export async function POST(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Slow down and try again.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { action } = body

    // ── Actions that don't require an access token ──
    if (action === 'auth-url') {
      const clientId = await getEnvVar('GOOGLE_COLAB_CLIENT_ID')
      if (!clientId) {
        return Response.json({
          error: 'Google Colab OAuth not configured. Set GOOGLE_COLAB_CLIENT_ID env var.',
          configured: false,
        })
      }
      const siteUrl = await getEnvVar('NEXT_PUBLIC_SITE_URL') || 'https://kivora.pages.dev'
      const redirectUri = `${siteUrl}/api/colab`
      const state = `colab-${Date.now()}`
      const authUrl = getOAuthUrl(redirectUri, clientId, state)
      return Response.json({ authUrl, configured: true })
    }

    if (action === 'accelerators') {
      return Response.json({ accelerators: getAcceleratorOptions() })
    }

    // ── Actions that require an access token ──
    const { accessToken, sessionName, code, gpu, tpu, packages, path, content, format, userId } = body

    // ── Plan gate on accelerator tier FIRST (fail closed) ──
    // Pro-tier accelerators (L4, G4, TPUs) require the Pro plan; premium-tier
    // (A100, H100) require Max. Free tier (CPU, T4) is open to everyone.
    // Runs BEFORE the Google-auth check so locked tiers never leak session
    // availability information to users who can't use them anyway.
    if (action === 'new' || action === 'run') {
      const tier = acceleratorTier(gpu, tpu)
      const feature = tier === 'pro' ? 'deepResearch' : tier === 'premium' ? 'priorityCompute' : null
      if (feature) {
        const { user: colabUser, admin: colabAdmin } = await resolveUserAndAdmin(req)
        const planGate = await requireFeatureAccess(colabAdmin, colabUser, feature)
        if (planGate) return planGate.response
      }
    }

    if (accessToken) {
      setColabAccessToken(accessToken)
    } else {
      // Try server-side token (for agent-driven workflows)
      const serverToken = await getEnvVar('GOOGLE_COLAB_ACCESS_TOKEN')
      if (serverToken) {
        setColabAccessToken(serverToken)
      }
    }

    if (!isColabAvailable() && !['auth-url', 'accelerators'].includes(action)) {
      return Response.json({
        error: 'Google account not connected. Connect your Google account to use Colab GPU/TPU.',
        needsAuth: true,
      }, { status: 401 })
    }

    // ── Route to appropriate handler ──
    switch (action) {
      case 'status': {
        if (!sessionName) return Response.json({ error: 'sessionName required' }, { status: 400 })
        const result = await getSessionStatus(sessionName)
        return Response.json(result)
      }

      case 'new': {
        const result = await createSession({ name: sessionName, gpu, tpu })
        // Save session to Supabase if userId provided
        if (userId && result.sessionId) {
          try {
            const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
            const supaKey = await getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
            if (supaUrl && supaKey) {
              const admin = createClient(supaUrl, supaKey)
              await admin.from('colab_sessions').upsert({
                user_id: userId,
                session_name: result.name,
                session_id: result.sessionId,
                accelerator: result.accelerator,
                status: 'active',
                created_at: new Date().toISOString(),
              }, { onConflict: 'session_id' })
            }
          } catch {}
        }
        return Response.json(result)
      }

      case 'exec': {
        if (!sessionName || !code) {
          return Response.json({ error: 'sessionName and code required' }, { status: 400 })
        }
        const result = await executeCode(sessionName, code, { timeout: body.timeout })
        return Response.json(result)
      }

      case 'run': {
        // One-shot GPU job: provision → execute → stop
        if (!code) return Response.json({ error: 'code required' }, { status: 400 })
        const result = await runGpuJob(code, { gpu: gpu || 'T4', tpu, timeout: body.timeout })
        return Response.json(result)
      }

      case 'stop': {
        if (!sessionName) return Response.json({ error: 'sessionName required' }, { status: 400 })
        const result = await stopSession(sessionName)
        // Update Supabase status
        if (userId && result.success) {
          try {
            const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
            const supaKey = await getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
            if (supaUrl && supaKey) {
              const admin = createClient(supaUrl, supaKey)
              await admin.from('colab_sessions')
                .update({ status: 'stopped', stopped_at: new Date().toISOString() })
                .eq('session_name', sessionName)
                .eq('user_id', userId)
            }
          } catch {}
        }
        return Response.json(result)
      }

      case 'sessions': {
        const result = await listSessions()
        return Response.json(result)
      }

      case 'install': {
        if (!sessionName || !packages) {
          return Response.json({ error: 'sessionName and packages required' }, { status: 400 })
        }
        const result = await installPackages(sessionName, packages)
        return Response.json(result)
      }

      case 'ls': {
        if (!sessionName) return Response.json({ error: 'sessionName required' }, { status: 400 })
        const result = await listFiles(sessionName, path || '/content')
        return Response.json(result)
      }

      case 'download': {
        if (!sessionName || !path) {
          return Response.json({ error: 'sessionName and path required' }, { status: 400 })
        }
        const result = await downloadFile(sessionName, path)
        return Response.json(result)
      }

      case 'upload': {
        if (!sessionName || !path || !content) {
          return Response.json({ error: 'sessionName, path, and content required' }, { status: 400 })
        }
        const result = await uploadFile(sessionName, path, content)
        return Response.json(result)
      }

      case 'drivemount': {
        if (!sessionName) return Response.json({ error: 'sessionName required' }, { status: 400 })
        const result = await mountDrive(sessionName, path || '/content/drive')
        return Response.json(result)
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    console.error('[colab API]', err)
    return Response.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}

// ── GET handler for OAuth2 callback ──
export async function GET(req) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const state = url.searchParams.get('state')

  if (error) {
    return new Response(`
      <html><body>
        <h2>Authentication Failed</h2>
        <p>${error}</p>
        <script>window.close()</script>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } })
  }

  if (!code) {
    return new Response('Missing authorization code', { status: 400 })
  }

  try {
    const clientId = await getEnvVar('GOOGLE_COLAB_CLIENT_ID')
    const clientSecret = await getEnvVar('GOOGLE_COLAB_CLIENT_SECRET')
    const siteUrl = await getEnvVar('NEXT_PUBLIC_SITE_URL') || 'https://kivora.pages.dev'
    const redirectUri = `${siteUrl}/api/colab`

    if (!clientId || !clientSecret) {
      return new Response('OAuth not configured on server', { status: 500 })
    }

    const { exchangeOAuthCode } = await import('@/lib/colab')
    const tokens = await exchangeOAuthCode(code, redirectUri, clientId, clientSecret)

    // Return a page that sends the tokens to the parent window
    return new Response(`
      <html><body>
        <h2>Connected to Google Colab!</h2>
        <p>You can close this window.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'colab-auth-success',
              accessToken: ${JSON.stringify(tokens.access_token)},
              refreshToken: ${JSON.stringify(tokens.refresh_token || '')},
              expiresIn: ${tokens.expires_in || 3600},
            }, '*');
          }
          setTimeout(() => window.close(), 2000);
        </script>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } })
  } catch (err) {
    console.error('[colab OAuth callback]', err)
    return new Response(`
      <html><body>
        <h2>Authentication Error</h2>
        <p>${err.message}</p>
        <script>window.close()</script>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } })
  }
}
