import { NextRequest } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

// Lists of words for generating handles
const adjectives = [
  'Happy', 'Clever', 'Brave', 'Swift', 'Quiet', 'Bright', 'Noble', 'Wise',
  'Bold', 'Kind', 'Fierce', 'Gentle', 'Sharp', 'Quick', 'Calm', 'Strong',
  'Silver', 'Golden', 'Crystal', 'Emerald', 'Ruby', 'Diamond', 'Mystic', 'Ancient',
  'Royal', 'Epic', 'Stellar', 'Cosmic', 'Radiant', 'Shining', 'Glowing', 'Blazing',
  'Cool', 'Fresh', 'Wild', 'Free', 'Pure', 'True', 'Deep', 'High',
  'Lucky', 'Magic', 'Super', 'Ultra', 'Mega', 'Grand', 'Prime', 'Elite',
  'Silly', 'Funny', 'Quirky', 'Witty', 'Spunky', 'Bouncy', 'Zippy', 'Peppy'
]

const nouns = [
  'Tiger', 'Eagle', 'Wolf', 'Bear', 'Lion', 'Fox', 'Hawk', 'Owl',
  'Dragon', 'Phoenix', 'Falcon', 'Panther', 'Leopard', 'Cheetah', 'Jaguar', 'Lynx',
  'Star', 'Moon', 'Sun', 'Comet', 'Nova', 'Galaxy', 'Planet', 'Nebula',
  'Mountain', 'Ocean', 'River', 'Forest', 'Valley', 'Canyon', 'Summit', 'Horizon',
  'Thunder', 'Lightning', 'Storm', 'Breeze', 'Flame', 'Spark', 'Blaze', 'Ember',
  'Knight', 'Warrior', 'Guardian', 'Champion', 'Hero', 'Legend', 'Master', 'Sage',
  'Rabbit', 'Panda', 'Koala', 'Dolphin', 'Penguin', 'Turtle', 'Butterfly', 'Hummingbird',
  'Wizard', 'Ninja', 'Pirate', 'Explorer', 'Voyager', 'Traveler', 'Wanderer', 'Pioneer'
]

function generateRandomHandle(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adjective} ${noun}`
}

async function generateUniqueHandle(): Promise<string> {
  let attempts = 0
  const maxAttempts = 100

  while (attempts < maxAttempts) {
    const handle = generateRandomHandle()

    // Check if handle already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('handle', handle)
      .single()

    if (!existingUser) {
      return handle
    }

    attempts++
  }

  // If we can't find a unique handle, add a number
  const baseHandle = generateRandomHandle()
  let counter = 1

  while (counter < 1000) {
    const numberedHandle = `${baseHandle} ${counter}`

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('handle', numberedHandle)
      .single()

    if (!existingUser) {
      return numberedHandle
    }

    counter++
  }

  throw new Error('Unable to generate unique handle')
}

export async function POST(request: NextRequest) {
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

    // Generate new unique handle
    const newHandle = await generateUniqueHandle()

    // Update user's handle using admin client
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ handle: newHandle, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating handle:', updateError)
      return Response.json({ error: 'Failed to update handle' }, { status: 500 })
    }

    return Response.json({
      success: true,
      handle: newHandle,
      message: `Your new handle is "${newHandle}"`
    })

  } catch (error) {
    console.error('Generate handle error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}