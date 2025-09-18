import { NextRequest } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

// Humorous two-word phrases for generating handles
const phrases = [
  'Pancake Detective', 'Sock Vampire', 'Burrito Wizard', 'Noodle Ninja', 'Pickle Prophet',
  'Waffle Warrior', 'Cheese Champion', 'Banana Bandit', 'Donut Dragon', 'Pizza Pirate',
  'Taco Tuesday', 'Muffin Monster', 'Cookie Crusader', 'Sandwich Samurai', 'Bagel Baron',
  'Pretzel Prince', 'Cereal Scientist', 'Soup Superhero', 'Salad Sheriff', 'Pasta Pilot',
  'Coffee Captain', 'Tea Titan', 'Juice Judge', 'Smoothie Sorcerer', 'Milk Magician',
  'Rubber Duck', 'Flying Toaster', 'Dancing Penguin', 'Singing Cactus', 'Sleepy Robot',
  'Grumpy Unicorn', 'Happy Platypus', 'Confused Llama', 'Excited Sloth', 'Nervous Hamster',
  'Brave Goldfish', 'Shy Elephant', 'Proud Chicken', 'Lazy Cheetah', 'Wise Turtle',
  'Disco Broccoli', 'Funky Mushroom', 'Groovy Carrot', 'Silly Celery', 'Crazy Cucumber',
  'Giggling Grape', 'Bouncing Blueberry', 'Winking Watermelon', 'Tickled Tomato', 'Sneezing Strawberry',
  'Midnight Snacker', 'Professional Procrastinator', 'Chief Hugger', 'Senior Sleeper', 'Master Napper',
  'Captain Couch', 'Admiral Blanket', 'General Pillow', 'Colonel Comfort', 'Major Mischief',
  'Space Cowboy', 'Time Traveler', 'Dream Catcher', 'Cloud Jumper', 'Star Whisperer',
  'Moon Walker', 'Sun Chaser', 'Rainbow Rider', 'Thunder Dancer', 'Lightning Bug',
  'Snack Hoarder', 'Meme Collector', 'Joke Keeper', 'Pun Master', 'Riddle Solver',
  'Mystery Eater', 'Secret Keeper', 'Truth Teller', 'Story Spinner', 'Song Hummer',
  'Button Pusher', 'Lever Puller', 'Knob Turner', 'Switch Flipper', 'Key Finder',
  'Lost Sock', 'Missing Remote', 'Vanishing Act', 'Invisible Ninja', 'Ghost Writer',
  'Shadow Boxer', 'Light Bender', 'Shape Shifter', 'Color Changer', 'Size Adjuster',
  'Error 404', 'Loading Screen', 'Pending Request', 'Buffer Overflow', 'Cache Miss',
  'Quantum Mechanic', 'Physics Defier', 'Gravity Fighter', 'Time Bender', 'Space Folder',
  'Wifi Whisperer', 'Password Keeper', 'Cookie Monster', 'Cache Cleaner', 'Bug Finder',
  'Feature Creator', 'Code Warrior', 'Logic Bender', 'Data Wrangler', 'Pixel Pusher',
  'Emoji Translator', 'GIF Master', 'Meme Lord', 'Reaction Collector', 'Screenshot Taker',
  'Tab Hoarder', 'Bookmark Keeper', 'History Cleaner', 'Incognito Mode', 'Private Browser'
]

function generateRandomHandle(): string {
  return phrases[Math.floor(Math.random() * phrases.length)]
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