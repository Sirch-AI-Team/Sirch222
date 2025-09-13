export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")
    
    if (!query) {
      return Response.json({ error: "Query parameter 'q' is required" }, { status: 400 })
    }

    console.log("[Search] Brave Search API request for:", query)
    
    // Use a generic API key for Brave Search - in production you'd want to use environment variables
    const braveApiKey = "BSA8H7BJ_QOYEojvhXf7cUb1KhVaBjVYTvE"
    
    const braveResponse = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': braveApiKey
      }
    })
    
    if (!braveResponse.ok) {
      console.error("[Search] Brave API error:", braveResponse.status)
      return Response.json({ error: "Search API unavailable" }, { status: 503 })
    }
    
    const searchData = await braveResponse.json()
    console.log("[Search] Brave API response received")
    
    // Transform Brave results to a cleaner format
    const results = searchData.web?.results?.map((result: any) => ({
      title: result.title,
      url: result.url,
      description: result.description,
      age: result.age,
      extra_snippets: result.extra_snippets
    })) || []
    
    const apiResponse = Response.json({ 
      query, 
      results,
      total: results.length 
    })
    
    // Add cache busting headers
    apiResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    apiResponse.headers.set('Pragma', 'no-cache')
    apiResponse.headers.set('Expires', '0')
    
    return apiResponse
    
  } catch (error) {
    console.error("[Search] Error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}