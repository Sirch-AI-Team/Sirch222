import { NextRequest } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params

    if (!username) {
      return Response.json({ error: 'Username is required' }, { status: 400 })
    }

    // Get viewer ID from auth token
    let viewerUserId: string | null = null
    const authHeader = request.headers.get('authorization')

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim()
      try {
        const { data: userData } = await supabaseAdmin.auth.getUser(token)
        viewerUserId = userData?.user?.id || null
      } catch {
        // Ignore token validation errors
      }
    }

    // Get profile (all profiles are public now)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url, created_at')
      .eq('username', username)
      .single()

    if (profileError || !profile) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Get saved pages
    const { data: savedPages, error: savedPagesError } = await supabaseAdmin
      .from('saved_pages')
      .select('id, url, title, description, thumbnail_url, domain, saved_at, metadata')
      .eq('user_id', profile.id)
      .order('saved_at', { ascending: false })
      .limit(100)

    if (savedPagesError) {
      return Response.json({ error: 'Failed to fetch saved pages' }, { status: 500 })
    }

    return Response.json({
      success: true,
      profile: {
        username: profile.username,
        display_name: profile.display_name,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at
      },
      saved_pages: savedPages || [],
      total_count: savedPages?.length || 0,
      is_owner: viewerUserId === profile.id
    })

  } catch (error) {
    console.error('API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
