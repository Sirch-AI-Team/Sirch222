import { NextRequest } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export async function POST(request: NextRequest) {
  try {
    const { usdAmount } = await request.json()

    if (!usdAmount || usdAmount <= 0) {
      return Response.json({ error: 'Invalid USD amount' }, { status: 400 })
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

    // Get current exchange rate using admin client
    const { data: exchangeRate } = await supabaseAdmin.rpc('get_current_tfm_rate')
    const currentRate = exchangeRate || 10.0 // Default to inception rate

    // Calculate TFM amount
    const tfmAmount = usdAmount * currentRate

    // Process the transaction using our database function with admin client
    const { data: transactionId, error: transactionError } = await supabaseAdmin.rpc(
      'process_tfm_transaction',
      {
        p_transaction_type: 'purchase',
        p_amount: tfmAmount,
        p_to_user_id: user.id,
        p_usd_amount: usdAmount,
        p_exchange_rate: currentRate,
        p_description: `Purchased ${tfmAmount} TFM for $${usdAmount}`,
        p_metadata: {
          purchase_method: 'web',
          user_agent: request.headers.get('user-agent'),
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        }
      }
    )

    if (transactionError) {
      throw transactionError
    }

    // Get updated balance using admin client
    const { data: balanceData } = await supabaseAdmin
      .from('tfm_balances')
      .select('*')
      .eq('user_id', user.id)
      .single()

    return Response.json({
      success: true,
      transaction_id: transactionId,
      tfm_received: tfmAmount,
      usd_spent: usdAmount,
      exchange_rate: currentRate,
      new_balance: balanceData?.balance || 0,
      message: `Successfully purchased ${tfmAmount} TFM for $${usdAmount}!`
    })

  } catch (error) {
    console.error('TFM Purchase Error:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Purchase failed'
    }, { status: 500 })
  }
}