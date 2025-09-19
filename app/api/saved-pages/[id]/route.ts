import { NextRequest } from 'next/server'
import { supabase } from '../../../../lib/supabase'

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

    const token = authHeader.substring(7)

    // Set the auth token for this request
    await supabase.auth.setSession({
      access_token: token,
      refresh_token: '' // Not needed for this operation
    })

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Delete the saved page (RLS will ensure user can only delete their own pages)
    const { error: deleteError } = await supabase
      .from('saved_pages')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Extra security check

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