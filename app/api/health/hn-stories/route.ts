export const dynamic = "force-dynamic"

const SUPABASE_PROJECT_URL = 'https://liobdrwdjkznvqigglxw.supabase.co'

export async function GET() {
  try {
    // Check stories table status
    const storiesResponse = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/stories?select=updated_at,rank_position&order=updated_at.desc&limit=1`, {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`
      }
    })

    const hackResponse = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/hack?select=updated_at,rank_position&order=updated_at.desc&limit=1`, {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`
      }
    })

    const countResponse = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/hack?select=count`, {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Prefer': 'count=exact',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`
      }
    })

    const stories = storiesResponse.ok ? await storiesResponse.json() : []
    const hack = hackResponse.ok ? await hackResponse.json() : []
    const countData = countResponse.ok ? await countResponse.json() : []

    const now = Date.now()
    const storiesLastUpdate = stories[0]?.updated_at
    const hackLastUpdate = hack[0]?.updated_at
    const totalStories = parseInt(countResponse.headers.get('content-range')?.split('/')[1] || '0')

    const storiesAge = storiesLastUpdate ? (now - new Date(storiesLastUpdate).getTime()) / (1000 * 60) : null
    const hackAge = hackLastUpdate ? (now - new Date(hackLastUpdate).getTime()) / (1000 * 60) : null

    // Health status determination
    const isHealthy = hackAge !== null && hackAge < 15 && totalStories >= 90
    const isStale = hackAge !== null && hackAge > 30
    const isDown = hackAge === null || hackAge > 120

    const status = isDown ? 'DOWN' : isStale ? 'STALE' : isHealthy ? 'HEALTHY' : 'WARNING'

    return Response.json({
      status,
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
      data: {
        hack: {
          lastUpdate: hackLastUpdate,
          minutesAgo: hackAge,
          totalStories
        },
        stories: {
          lastUpdate: storiesLastUpdate,
          minutesAgo: storiesAge
        }
      },
      checks: {
        recentUpdate: hackAge !== null && hackAge < 15,
        sufficientStories: totalStories >= 90,
        notDown: !isDown
      },
      thresholds: {
        healthy: "< 15 minutes + 90+ stories",
        stale: "> 30 minutes",
        down: "> 120 minutes or null"
      }
    })

  } catch (error) {
    console.error("[Health] Health check failed:", error)

    return Response.json({
      status: 'ERROR',
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}