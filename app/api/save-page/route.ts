import { NextRequest } from 'next/server'
import { supabase } from '../../../lib/supabase'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import TurboPufferService from '../../../lib/turbopuffer'

export async function POST(request: NextRequest) {
  try {
    const { url, title, description, thumbnail_url } = await request.json()

    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 })
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

    // Extract domain from URL
    let domain = ''
    try {
      domain = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      // Invalid URL format, domain will remain empty
    }

    // Save the page using admin client
    const { data: savedPage, error: saveError } = await supabaseAdmin
      .from('saved_pages')
      .upsert({
        user_id: user.id,
        url: url,
        title: title || null,
        description: description || null,
        thumbnail_url: thumbnail_url || null,
        domain: domain || null,
        saved_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,url',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving page:', saveError)
      return Response.json({ error: 'Failed to save page' }, { status: 500 })
    }

    // Index the page content in TurboPuffer for AI search
    try {
      const pageContent = await TurboPufferService.extractPageContent(url)
      const searchableContent = `${title || ''} ${description || ''} ${pageContent}`.trim()

      if (searchableContent) {
        await TurboPufferService.indexSavedPage(
          savedPage.id,
          user.id,
          url,
          title || '',
          searchableContent,
          domain,
          savedPage.saved_at
        )
        console.log('Page indexed in TurboPuffer for AI search')
      }
    } catch (error) {
      console.error('Error indexing page in TurboPuffer:', error)
      // Don't fail the save operation if indexing fails
    }

    return Response.json({
      success: true,
      saved_page: savedPage,
      message: 'Page saved successfully'
    })

  } catch (error) {
    console.error('Save page error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 })
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

    // Remove the saved page using admin client
    const { error: deleteError } = await supabaseAdmin
      .from('saved_pages')
      .delete()
      .eq('user_id', user.id)
      .eq('url', url)

    if (deleteError) {
      console.error('Error unsaving page:', deleteError)
      return Response.json({ error: 'Failed to unsave page' }, { status: 500 })
    }

    return Response.json({
      success: true,
      message: 'Page unsaved successfully'
    })

  } catch (error) {
    console.error('Unsave page error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}