import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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

async function generateUniqueHandle(supabase: any): Promise<string> {
  let attempts = 0
  const maxAttempts = 100

  while (attempts < maxAttempts) {
    const handle = generateRandomHandle()

    // Check if handle already exists
    const { data: existingUser } = await supabase
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

    const { data: existingUser } = await supabase
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

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Get current user
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Generate new unique handle
    const newHandle = await generateUniqueHandle(supabase)

    // Update user's handle
    const { error: updateError } = await supabase
      .from('users')
      .update({ handle: newHandle, updated_at: new Date().toISOString() })
      .eq('id', session.user.id)

    if (updateError) {
      console.error('Error updating handle:', updateError)
      return NextResponse.json({ error: 'Failed to update handle' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      handle: newHandle,
      message: `Your new handle is "${newHandle}"`
    })

  } catch (error) {
    console.error('Generate handle error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}