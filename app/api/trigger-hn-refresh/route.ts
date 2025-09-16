export const dynamic = "force-dynamic"

const SUPABASE_PROJECT_URL = 'https://liobdrwdjkznvqigglxw.supabase.co'
const MAX_RETRIES = 3
const RETRY_DELAY = 5000

async function checkLastUpdate() {
  try {
    const response = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/hack?select=updated_at&order=updated_at.desc&limit=1`, {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      const lastUpdate = data[0]?.updated_at
      if (lastUpdate) {
        const minutesAgo = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60)
        return { lastUpdate, minutesAgo }
      }
    }
  } catch (error) {
    console.warn("[Health Check] Failed to check last update:", error)
  }
  return null
}

async function callEdgeFunction(retryCount = 0): Promise<any> {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseServiceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
  }

  console.log(`[Cron] Attempting Edge Function call (attempt ${retryCount + 1}/${MAX_RETRIES})`)

  const response = await fetch(`${SUPABASE_PROJECT_URL}/functions/v1/refresh-hn-stories`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(120000) // 2 minute timeout
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Edge function failed: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return await response.json()
}

export async function GET() {
  const startTime = Date.now()

  try {
    console.log("[Cron] 🚀 Starting HackerNews refresh pipeline...")

    // 1. Pre-flight health check
    const healthCheck = await checkLastUpdate()
    if (healthCheck) {
      console.log(`[Health] Last update: ${healthCheck.lastUpdate} (${healthCheck.minutesAgo.toFixed(1)} minutes ago)`)

      // Skip if updated within last 8 minutes (buffer for processing time)
      if (healthCheck.minutesAgo < 8) {
        console.log("[Health] ✅ Stories recently updated, skipping refresh")
        return Response.json({
          success: true,
          skipped: true,
          reason: "Recently updated",
          lastUpdate: healthCheck.lastUpdate,
          minutesAgo: healthCheck.minutesAgo,
          timestamp: new Date().toISOString()
        })
      }

      // Alert if very stale (>30 minutes)
      if (healthCheck.minutesAgo > 30) {
        console.warn(`[Alert] ⚠️ Stories are very stale: ${healthCheck.minutesAgo.toFixed(1)} minutes old`)
      }
    }

    // 2. Call Edge Function with retries
    let result = null
    let lastError = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        result = await callEdgeFunction(attempt)
        break
      } catch (error) {
        lastError = error
        console.error(`[Cron] Attempt ${attempt + 1} failed:`, error)

        if (attempt < MAX_RETRIES - 1) {
          console.log(`[Cron] Retrying in ${RETRY_DELAY}ms...`)
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        }
      }
    }

    if (!result) {
      throw lastError || new Error("All retry attempts failed")
    }

    const duration = Date.now() - startTime
    console.log(`[Cron] ✅ HackerNews refresh completed in ${duration}ms:`, result)

    // 3. Post-flight verification
    const postCheck = await checkLastUpdate()
    const actuallyUpdated = postCheck && postCheck.minutesAgo < 2

    return Response.json({
      success: true,
      result,
      preflightCheck: healthCheck,
      postflightCheck: postCheck,
      actuallyUpdated,
      duration,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Cron] ❌ HackerNews refresh failed after ${duration}ms:`, error)

    const errorMessage = error instanceof Error ? error.message : String(error)

    // Log detailed error for debugging
    console.error("[Debug] Error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      projectUrl: SUPABASE_PROJECT_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      duration
    })

    return Response.json({
      success: false,
      error: errorMessage,
      duration,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}