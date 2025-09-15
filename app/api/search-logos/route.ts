export const dynamic = "force-dynamic"

interface LogoResult {
  name: string
  logo_url: string
  domain: string
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

    // Search directly with the user's query
    const searchTerm = query.toLowerCase().trim()

    try {
      const response = await fetch(`https://api.logo.dev/search?q=${encodeURIComponent(searchTerm)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${logoDevKey}`,
          'Accept': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data) && data.length > 0) {
          // Return only results that are actually relevant to the search term
          const relevantResults = data
            .filter(item => {
              if (!item.logo_url || !item.name) return false

              const searchLower = searchTerm.toLowerCase()
              const nameLower = item.name.toLowerCase()
              const domainLower = (item.domain || '').toLowerCase()

              // Only include results where name or domain contains the search term
              return nameLower.includes(searchLower) || domainLower.includes(searchLower)
            })
            .slice(0, 6)
            .map(item => ({
              name: item.name,
              logo_url: item.logo_url,
              domain: item.domain || `${item.name.toLowerCase().replace(/\s+/g, '')}.com`
            }))

          return Response.json(relevantResults)
        }
      }
    } catch (error) {
      console.error(`[Logo Search] Failed to fetch logos:`, error)
    }

    return Response.json([])

  } catch (error) {
    console.error("[Logo Search] Error:", error)
    return Response.json([])
  }
}