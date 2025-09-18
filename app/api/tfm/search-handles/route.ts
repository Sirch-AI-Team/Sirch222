import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json({ handles: [] })
    }

    const supabase = createRouteHandlerClient({ cookies })

    // Get current user to exclude them from results
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Search for handles that match the query
    const { data: users, error } = await supabase
      .from('users')
      .select('handle, email')
      .neq('id', session.user.id) // Exclude current user
      .not('handle', 'is', null) // Only users with handles
      .ilike('handle', `%${query}%`)
      .limit(10)

    if (error) {
      console.error('Handle search error:', error)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    const handles = users?.map(user => ({
      handle: user.handle,
      email: user.email
    })) || []

    return NextResponse.json({ handles })

  } catch (error) {
    console.error('Handle search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}