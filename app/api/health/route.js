// ── GET /api/health ──────────────────────────────────────────────────
// One-request deploy verification: reports which commit is serving,
// so "is my deployment live?" never requires inspecting chunk hashes.
// Response is intentionally tiny and leaks nothing sensitive.
//
// Example: {"ok":true,"commit":"5bc6375…","service":"kivora","time":"…"}

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  const commit = process.env.NEXT_PUBLIC_BUILD_COMMIT || 'dev'
  return new Response(
    JSON.stringify({
      ok: true,
      service: 'kivora',
      commit,
      time: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  )
}
