import { NextRequest } from 'next/server'
import { supabase } from '../../../../lib/supabase'

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

    // Get query parameters
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Get user's transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select(`
        id,
        transaction_type,
        amount,
        usd_amount,
        exchange_rate,
        status,
        description,
        created_at,
        processed_at,
        from_user:from_user_id(email, username),
        to_user:to_user_id(email, username)
      `)
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (transactionsError) {
      throw transactionsError
    }

    // Format transactions for response
    const formattedTransactions = transactions?.map(tx => ({
      id: tx.id,
      type: tx.transaction_type,
      amount: parseFloat(tx.amount),
      usd_amount: tx.usd_amount ? parseFloat(tx.usd_amount) : null,
      exchange_rate: tx.exchange_rate ? parseFloat(tx.exchange_rate) : null,
      status: tx.status,
      description: tx.description,
      created_at: tx.created_at,
      processed_at: tx.processed_at,
      direction: tx.from_user?.email === user.email ? 'outgoing' : 'incoming',
      counterparty: tx.from_user?.email === user.email
        ? tx.to_user
        : tx.from_user,
      display_type: tx.transaction_type === 'purchase' ? 'purchased' :
                   tx.transaction_type === 'transfer_out' ? 'sent' :
                   tx.transaction_type === 'transfer_in' ? 'received' :
                   tx.transaction_type === 'ad_payment' ? 'ad_spend' :
                   tx.transaction_type
    })) || []

    return Response.json({
      success: true,
      transactions: formattedTransactions,
      count: formattedTransactions.length,
      has_more: formattedTransactions.length === limit
    })

  } catch (error) {
    console.error('TFM Transactions Error:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch transactions'
    }, { status: 500 })
  }
}