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

    // First, check if the user profile exists and is public
    console.log('[DEBUG] Checking profile for username:', username)
    const { data: profile, error: profileError } = await supabaseAdmin
      .rpc('get_profile_by_username', { username_param: username })

    console.log('[DEBUG] Profile result:', {
      profileData: profile,
      profileError: profileError?.message,
      profileCount: profile?.length
    })

    if (profileError) {
      console.error('Profile lookup error:', profileError)
      return Response.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    if (!profile || profile.length === 0) {
      return Response.json({ error: 'User not found or profile is private' }, { status: 404 })
    }

    const userProfile = profile[0]

    // Get the user's saved pages (newest 100)
    const { data: savedPages, error: savedPagesError } = await supabaseAdmin
      .rpc('get_saved_pages', { username_param: username })

    if (savedPagesError) {
      console.error('Saved pages lookup error:', savedPagesError)
      return Response.json({ error: 'Failed to fetch saved pages' }, { status: 500 })
    }

    return Response.json({
      success: true,
      profile: {
        username: userProfile.username,
        display_name: userProfile.display_name,
        bio: userProfile.bio,
        avatar_url: userProfile.avatar_url,
        created_at: userProfile.created_at
      },
      saved_pages: savedPages || [],
      total_count: savedPages?.length || 0
    })

  } catch (error) {
    console.error('API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}