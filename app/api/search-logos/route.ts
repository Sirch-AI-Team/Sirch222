export const dynamic = "force-dynamic"

interface LogoResult {
  name: string
  logo_url: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    if (!query || query.length < 1) {
      return Response.json([])
    }

    const logoDevKey = process.env.LOGO_DEV_API_KEY
    
    if (!logoDevKey) {
      console.error("[Logo Search] Logo.dev API key not configured")
      return Response.json([])
    }

    // Search for companies matching the query
    const searchTerm = query.toLowerCase().trim()
    
    // Smart company mapping for abbreviations and partial matches
    const companyMappings: { [key: string]: string[] } = {
      'nyt': ['new york times', 'nytimes'],
      'ny': ['new york times', 'nytimes'],
      'wsj': ['wall street journal', 'wsj'],  
      'wall': ['wall street journal', 'wsj'],
      'hacker': ['y combinator', 'ycombinator'],
      'yc': ['y combinator', 'ycombinator'],
      'fb': ['facebook', 'meta'],
      'ig': ['instagram'],
      'yt': ['youtube'],
      'gh': ['github'],
      'ms': ['microsoft'],
      'goog': ['google'],
      'amzn': ['amazon'],
      'nflx': ['netflix'],
      'twtr': ['twitter', 'x'],
      'spot': ['spotify'],
      'uber': ['uber'],
      'abnb': ['airbnb'],
      'tsla': ['tesla'],
      'nvda': ['nvidia'],
      'intc': ['intel'],
      'adbe': ['adobe'],
      'ai': ['openai'],
      'cnn': ['cnn'],
      'bbc': ['bbc'],
      'tc': ['techcrunch'],
      'reddit': ['reddit'],
      'medium': ['medium'],
      'so': ['stackoverflow', 'stack overflow'],
      'apple': ['apple'],
      'amazon': ['amazon'],
      'google': ['google'],
      'microsoft': ['microsoft'],
      'meta': ['meta', 'facebook'],
      'netflix': ['netflix'],
      'spotify': ['spotify'],
      'github': ['github'],
      'twitter': ['twitter', 'x'],
      'youtube': ['youtube'],
      'tesla': ['tesla'],
      'nvidia': ['nvidia'],
      'intel': ['intel'],
      'adobe': ['adobe'],
      'openai': ['openai'],
      'bloomberg': ['bloomberg'],
      'reuters': ['reuters'],
      'wired': ['wired'],
      'verge': ['the verge', 'verge']
    }

    // Get potential company names to search
    const searchTerms = new Set<string>()
    
    // Direct search term
    searchTerms.add(searchTerm)
    console.log(`[Logo Search API] Starting with direct term: "${searchTerm}"`)
    
    // Check mappings
    for (const [key, values] of Object.entries(companyMappings)) {
      if (key.startsWith(searchTerm) || searchTerm.startsWith(key)) {
        console.log(`[Logo Search API] startsWith match: "${searchTerm}" <-> "${key}", adding:`, values)
        values.forEach(v => searchTerms.add(v))
      }
    }
    
    // Also try partial matches on company names
    Object.keys(companyMappings).forEach(company => {
      if (company.includes(searchTerm) || searchTerm.includes(company)) {
        console.log(`[Logo Search API] includes match: "${searchTerm}" <-> "${company}", adding:`, companyMappings[company])
        companyMappings[company]?.forEach(v => searchTerms.add(v))
      }
    })
    
    console.log(`[Logo Search API] Final search terms:`, Array.from(searchTerms))

    const logoPromises = Array.from(searchTerms).slice(0, 3).map(async (term) => {
      try {
        const response = await fetch(`https://api.logo.dev/search?q=${encodeURIComponent(term)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${logoDevKey}`,
            'Accept': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (Array.isArray(data) && data.length > 0) {
            // Return multiple results from this search term, up to 5
            return data.slice(0, 5).map(item => ({
              name: item.name || term,
              logo_url: item.logo_url,
              domain: item.domain || term
            })).filter(item => item.logo_url) // Only include items with logos
          }
        }
      } catch (error) {
        console.log(`[Logo Search] Failed to fetch logo for ${term}:`, error)
      }
      return null
    })

    const results = await Promise.all(logoPromises)
    const allResults = results.filter(result => result !== null).flat() // Flatten arrays from multiple terms
    
    // Remove duplicates based on domain and limit to 10
    const seen = new Set()
    const uniqueResults = allResults.filter(result => {
      const key = result.domain.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    
    return Response.json(uniqueResults.slice(0, 10))
    
  } catch (error) {
    console.error("[Logo Search] Error:", error)
    return Response.json([])
  }
}