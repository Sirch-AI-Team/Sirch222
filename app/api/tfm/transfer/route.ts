import { NextRequest } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export async function POST(request: NextRequest) {
  try {
    const { amount, toUsername, toEmail, toHandle } = await request.json()

    if (!amount || amount <= 0) {
      return Response.json({ error: 'Invalid transfer amount' }, { status: 400 })
    }

    if (!toUsername && !toEmail && !toHandle) {
      return Response.json({ error: 'Must specify recipient username, email, or handle' }, { status: 400 })
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

    // Find recipient user using admin client
    let recipientQuery = supabaseAdmin.from('users').select('id, email, username, handle')

    if (toEmail) {
      recipientQuery = recipientQuery.eq('email', toEmail)
    } else if (toHandle) {
      recipientQuery = recipientQuery.eq('handle', toHandle)
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

    // Check sender's balance using admin client
    const { data: senderBalance } = await supabaseAdmin.rpc('get_user_tfm_balance', {
      p_user_id: user.id
    })

    if (!senderBalance || senderBalance < amount) {
      return Response.json({ error: 'Insufficient TFM balance' }, { status: 400 })
    }

    // Process the transfer using admin client (this handles both debit and credit)
    const { data: transferOutId, error: transferError } = await supabaseAdmin.rpc(
      'process_tfm_transaction',
      {
        p_transaction_type: 'transfer_out',
        p_amount: amount,
        p_from_user_id: user.id,
        p_to_user_id: recipientData.id,
        p_description: `Transferred ${amount} TFM to ${recipientData.handle || recipientData.username || recipientData.email}`,
        p_metadata: {
          recipient_username: recipientData.username,
          recipient_email: recipientData.email,
          recipient_handle: recipientData.handle,
          transfer_method: 'web'
        }
      }
    )

    if (transferError) {
      throw transferError
    }

    // Create corresponding transfer_in transaction using admin client
    const { data: transferInId } = await supabaseAdmin.rpc(
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

    // Get updated balance using admin client
    const { data: newBalance } = await supabaseAdmin.rpc('get_user_tfm_balance', {
      p_user_id: user.id
    })

    return Response.json({
      success: true,
      transaction_id: transferOutId,
      amount_sent: amount,
      recipient: {
        username: recipientData.username,
        email: recipientData.email,
        handle: recipientData.handle
      },
      new_balance: newBalance || 0,
      message: `Successfully sent ${amount} TFM to ${recipientData.handle || recipientData.username || recipientData.email}`
    })

  } catch (error) {
    console.error('TFM Transfer Error:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Transfer failed'
    }, { status: 500 })
  }
}