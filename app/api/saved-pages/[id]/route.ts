import { NextRequest } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return Response.json({ error: 'Page ID is required' }, { status: 400 })
    }

    // Get the authorization header
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

    // Delete the saved page
    const { error: deleteError } = await supabaseAdmin
      .from('saved_pages')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting saved page:', deleteError)
      return Response.json({ error: 'Failed to delete page' }, { status: 500 })
    }

    return Response.json({ success: true })

  } catch (error) {
    console.error('API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}