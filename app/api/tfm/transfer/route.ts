import { NextRequest } from 'next/server'
import { supabase } from '../../../../lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { amount, toUsername, toEmail } = await request.json()

    if (!amount || amount <= 0) {
      return Response.json({ error: 'Invalid transfer amount' }, { status: 400 })
    }

    if (!toUsername && !toEmail) {
      return Response.json({ error: 'Must specify recipient username or email' }, { status: 400 })
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

    // Find recipient user
    let recipientQuery = supabase.from('users').select('id, email, username')

    if (toEmail) {
      recipientQuery = recipientQuery.eq('email', toEmail)
    } else {
      recipientQuery = recipientQuery.eq('username', toUsername)
    }

    const { data: recipientData, error: recipientError } = await recipientQuery.single()

    if (recipientError || !recipientData) {
      return Response.json({ error: 'Recipient not found' }, { status: 404 })
    }

    if (recipientData.id === user.id) {
      return Response.json({ error: 'Cannot transfer to yourself' }, { status: 400 })
    }

    // Check sender's balance
    const { data: senderBalance } = await supabase.rpc('get_user_tfm_balance', {
      p_user_id: user.id
    })

    if (!senderBalance || senderBalance < amount) {
      return Response.json({ error: 'Insufficient TFM balance' }, { status: 400 })
    }

    // Process the transfer (this handles both debit and credit)
    const { data: transferOutId, error: transferError } = await supabase.rpc(
      'process_tfm_transaction',
      {
        p_transaction_type: 'transfer_out',
        p_amount: amount,
        p_from_user_id: user.id,
        p_to_user_id: recipientData.id,
        p_description: `Transferred ${amount} TFM to ${recipientData.username || recipientData.email}`,
        p_metadata: {
          recipient_username: recipientData.username,
          recipient_email: recipientData.email,
          transfer_method: 'web'
        }
      }
    )

    if (transferError) {
      throw transferError
    }

    // Create corresponding transfer_in transaction
    const { data: transferInId } = await supabase.rpc(
      'process_tfm_transaction',
      {
        p_transaction_type: 'transfer_in',
        p_amount: amount,
        p_from_user_id: user.id,
        p_to_user_id: recipientData.id,
        p_description: `Received ${amount} TFM from ${user.email}`,
        p_metadata: {
          sender_email: user.email,
          transfer_method: 'web'
        }
      }
    )

    // Get updated balance
    const { data: newBalance } = await supabase.rpc('get_user_tfm_balance', {
      p_user_id: user.id
    })

    return Response.json({
      success: true,
      transaction_id: transferOutId,
      amount_sent: amount,
      recipient: {
        username: recipientData.username,
        email: recipientData.email
      },
      new_balance: newBalance || 0,
      message: `Successfully sent ${amount} TFM to ${recipientData.username || recipientData.email}`
    })

  } catch (error) {
    console.error('TFM Transfer Error:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Transfer failed'
    }, { status: 500 })
  }
}