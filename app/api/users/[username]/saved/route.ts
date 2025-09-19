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

    // Debug environment variables
    console.log('[DEBUG] Environment check:', {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20)
    })

    // First, check if the user exists in users table and get their profile
    console.log('[DEBUG] Checking profile for username:', username)
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username, created_at')
      .eq('username', username)
      .single()

    if (userError) {
      console.error('User lookup error:', userError)
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Get profile info (all profiles are public)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('display_name, bio, avatar_url')
      .eq('id', user.id)
      .single()

    console.log('[DEBUG] Profile result:', {
      user: user,
      profile: profile,
      profileError: profileError?.message
    })

    // Get the user's saved pages (newest 100) - direct query
    const { data: savedPages, error: savedPagesError } = await supabaseAdmin
      .from('saved_pages')
      .select('id, url, title, description, thumbnail_url, domain, saved_at, metadata')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .limit(100)

    if (savedPagesError) {
      console.error('Saved pages lookup error:', savedPagesError)
      return Response.json({ error: 'Failed to fetch saved pages' }, { status: 500 })
    }

    return Response.json({
      success: true,
      profile: {
        username: user.username,
        display_name: profile?.display_name || null,
        bio: profile?.bio || null,
        avatar_url: profile?.avatar_url || null,
        created_at: user.created_at
      },
      saved_pages: savedPages || [],
      total_count: savedPages?.length || 0
    })

  } catch (error) {
    console.error('API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}