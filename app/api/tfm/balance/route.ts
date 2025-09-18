import { NextRequest } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  try {
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

    // Get user's TFM balance using admin client
    const { data: balanceData, error: balanceError } = await supabaseAdmin
      .from('tfm_balances')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (balanceError && balanceError.code !== 'PGRST116') { // Not found is ok
      throw balanceError
    }

    // If no balance exists, create one
    if (!balanceData) {
      const { data: newBalance, error: createError } = await supabaseAdmin
        .from('tfm_balances')
        .insert({
          user_id: user.id,
          balance: 0,
          frozen_balance: 0,
          lifetime_earned: 0,
          lifetime_spent: 0
        })
        .select()
        .single()

      if (createError) {
        throw createError
      }

      return Response.json({
        success: true,
        balance: newBalance
      })
    }

    return Response.json({
      success: true,
      balance: balanceData
    })

  } catch (error) {
    console.error('TFM Balance Error:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}