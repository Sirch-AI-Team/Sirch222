import { NextRequest } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import TurboPufferService from '../../../lib/turbopuffer'

export async function POST(request: NextRequest) {
  try {
    // Check if TurboPuffer is configured
    if (!process.env.TURBOPUFFER_API_KEY || !process.env.OPENAI_API_KEY) {
      console.error('Missing required environment variables for search')
      return Response.json({
        error: 'Search service not configured',
        results: []
      }, { status: 200 }) // Return empty results instead of error
    }

    const { query, limit = 10 } = await request.json()

    if (!query || query.trim().length === 0) {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Authorization required' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '').trim()

    // Validate token and get user ID
    let userId: string | null = null
    try {
      const { data: userData } = await supabaseAdmin.auth.getUser(token)
      userId = userData?.user?.id || null
    } catch {
      return Response.json({ error: 'Invalid token' }, { status: 401 })
    }

    if (!userId) {
      return Response.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Search saved pages using TurboPuffer
    const searchResult = await TurboPufferService.searchSavedPages(
      userId,
      query.trim(),
      Math.min(limit, 50) // Cap at 50 results
    )

    if (!searchResult.success) {
      console.error('TurboPuffer search error:', searchResult.error)
      // Fallback to simple database search
      const { data: fallbackResults } = await supabaseAdmin
        .from('saved_pages')
        .select('id, url, title, description, thumbnail_url, domain, saved_at')
        .eq('user_id', userId)
        .or(`title.ilike.%${query.trim()}%,description.ilike.%${query.trim()}%`)
        .order('saved_at', { ascending: false })
        .limit(Math.min(limit, 50))

      return Response.json({
        success: true,
        query: query.trim(),
        results: fallbackResults || [],
        total_count: fallbackResults?.length || 0,
        error: 'Using basic search (AI search temporarily unavailable)'
      }, { status: 200 })
    }

    // Get full saved page details from database for the results
    const resultIds = searchResult.results.map((r: any) => r.id).filter(Boolean)

    let fullResults: any[] = []
    if (resultIds.length > 0) {
      const { data: savedPages } = await supabaseAdmin
        .from('saved_pages')
        .select('id, url, title, description, thumbnail_url, domain, saved_at')
        .in('id', resultIds)
        .eq('user_id', userId)

      if (savedPages) {
        // Merge search results with full page data
        fullResults = searchResult.results.map((searchRes: any) => {
          const fullPage = savedPages.find((page: any) => page.id === searchRes.id)
          return {
            ...searchRes,
            ...fullPage,
            relevance_score: 1 - searchRes.score, // Convert distance to relevance score
          }
        }).filter(Boolean)
      }
    }

    return Response.json({
      success: true,
      query: query.trim(),
      results: fullResults,
      total_count: fullResults.length,
    })

  } catch (error) {
    console.error('Search API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}