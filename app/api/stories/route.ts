export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") || "50"
    const offset = searchParams.get("offset") || "0"

    console.log("[v0] Fetching stories from Supabase API...")

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://liobdrwdjkznvqigglxw.supabase.co"
    const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpb2Jkcndkamt6bnZxaWdnbHh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzU1NjA3NSwiZXhwIjoyMDczMTMyMDc1fQ.jR1K1mUt-w2sCWYW1J5xnE-VmKjlHrsRWV9G1ThqcoM"

    let endpoint = `${supabaseUrl}/rest/v1/hack?limit=${limit}&offset=${offset}&order=rank_position.asc`

    const response = await fetch(endpoint, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Supabase API error:", response.status, errorText)
      throw new Error(`Supabase API error: ${response.status} - ${errorText}`)
    }

    const rawStories = await response.json()
    console.log(`[v0] Found ${rawStories?.length || 0} stories from Supabase`)

    // Transform the data to match the frontend's Story interface
    const stories = rawStories?.map((story: any) => ({
      id: story.id,
      title: story.title,
      url: story.url,
      score: story.score,
      author: story.by, // Map 'by' to 'author'
      time: story.time,
      descendants: story.descendants,
      summary: story.summary,
      status: 'active'
    })) || []

    return Response.json({ stories })
  } catch (error) {
    console.error("[v0] Stories API error:", error)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}