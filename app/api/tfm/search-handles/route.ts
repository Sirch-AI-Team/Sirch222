import { NextRequest } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return Response.json({ handles: [] })
    }

    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return Response.json({ error: 'No authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Search for handles that match the query using admin client
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('handle, email')
      .neq('id', user.id) // Exclude current user
      .not('handle', 'is', null) // Only users with handles
      .ilike('handle', `%${query}%`)
      .limit(10)

    if (error) {
      console.error('Handle search error:', error)
      return Response.json({ error: 'Search failed' }, { status: 500 })
    }

    const handles = users?.map(u => ({
      handle: u.handle,
      email: u.email
    })) || []

    return Response.json({ handles })

  } catch (error) {
    console.error('Handle search error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}