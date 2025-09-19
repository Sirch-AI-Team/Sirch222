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

    let viewerUserId: string | null = null

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim()
      if (token) {
        const { data: viewerData, error: viewerError } = await supabaseAdmin.auth.getUser(token)
        if (viewerError) {
          console.error('Viewer token validation error:', viewerError)
        } else if (viewerData?.user) {
          viewerUserId = viewerData.user.id
        }
      }
    }

    // Fetch profile (including private ones)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url, is_public, created_at')
      .eq('username', username)
      .maybeSingle()

    if (profileError) {
      console.error('Profile lookup error:', profileError)
      return Response.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    if (!profile) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const isOwner = viewerUserId === profile.id

    if (!profile.is_public && !isOwner) {
      return Response.json({ error: 'User not found or profile is private' }, { status: 404 })
    }

    const { data: savedPages, error: savedPagesError } = await supabaseAdmin
      .from('saved_pages')
      .select('id, url, title, description, thumbnail_url, domain, saved_at, metadata')
      .eq('user_id', profile.id)
      .order('saved_at', { ascending: false })
      .limit(100)

    if (savedPagesError) {
      console.error('Saved pages lookup error:', savedPagesError)
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
      is_owner: isOwner
    })

  } catch (error) {
    console.error('API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
