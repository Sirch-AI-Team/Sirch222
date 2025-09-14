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
    
    // Check mappings
    for (const [key, values] of Object.entries(companyMappings)) {
      if (key.startsWith(searchTerm) || searchTerm.startsWith(key)) {
        values.forEach(v => searchTerms.add(v))
      }
    }
    
    // Also try partial matches on company names
    Object.keys(companyMappings).forEach(company => {
      if (company.includes(searchTerm) || searchTerm.includes(company)) {
        companyMappings[company]?.forEach(v => searchTerms.add(v))
      }
    })

    const logoPromises = Array.from(searchTerms).slice(0, 8).map(async (term) => {
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
          if (Array.isArray(data) && data.length > 0 && data[0].logo_url) {
            return { 
              name: term,
              logo_url: data[0].logo_url,
              domain: data[0].domain || term
            }
          }
        }
      } catch (error) {
        console.log(`[Logo Search] Failed to fetch logo for ${term}:`, error)
      }
      return null
    })

    const results = await Promise.all(logoPromises)
    const validResults = results.filter(result => result !== null)
    
    return Response.json(validResults.slice(0, 8))
    
  } catch (error) {
    console.error("[Logo Search] Error:", error)
    return Response.json([])
  }
}