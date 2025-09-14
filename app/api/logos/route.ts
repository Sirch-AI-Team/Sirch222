export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    console.log("[Logos] Fetching company logos from logo.dev API")
    
    const logoDevKey = process.env.LOGO_DEV_API_KEY
    
    if (!logoDevKey) {
      console.error("[Logos] Logo.dev API key not configured")
      return Response.json({ error: "Logo service not configured" }, { status: 503 })
    }
    
    const companies = [
      'github.com', 'google.com', 'microsoft.com', 'apple.com', 'amazon.com', 
      'facebook.com', 'meta.com', 'netflix.com', 'spotify.com', 'uber.com', 
      'airbnb.com', 'tesla.com', 'nvidia.com', 'intel.com', 'adobe.com', 
      'reddit.com', 'twitter.com', 'youtube.com', 'medium.com', 'stackoverflow.com', 
      'openai.com', 'nytimes.com', 'wsj.com', 'bloomberg.com', 'reuters.com', 
      'cnn.com', 'bbc.com', 'techcrunch.com', 'wired.com', 'theverge.com', 
      'ycombinator.com'
    ]
    
    const logoPromises = companies.map(async (domain) => {
      try {
        const companyName = domain.replace('.com', '').replace('the', '')
        const response = await fetch(`https://api.logo.dev/search?q=${companyName}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${logoDevKey}`,
            'Accept': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.length > 0 && data[0].logo_url) {
            return { 
              company: companyName === 'verge' ? 'verge' : companyName,
              logo_url: data[0].logo_url
            }
          }
        }
      } catch (error) {
        console.log(`[Logos] Failed to fetch logo for ${domain}:`, error)
      }
      return null
    })

    const results = await Promise.all(logoPromises)
    const logoMap: {[key: string]: string} = {}
    
    results.forEach(result => {
      if (result) {
        logoMap[result.company] = result.logo_url
      }
    })

    console.log(`[Logos] Successfully fetched ${Object.keys(logoMap).length} company logos`)
    
    const apiResponse = Response.json(logoMap)
    
    // Add cache headers
    apiResponse.headers.set('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
    apiResponse.headers.set('Pragma', 'cache')
    
    return apiResponse
    
  } catch (error) {
    console.error("[Logos] Error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}