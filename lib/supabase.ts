import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create client with explicit auth configuration to prevent hanging
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit'
  },
  global: {
    headers: {
      'x-application-name': 'sirch-tfm'
    }
  }
})

export type HackerNewsStory = {
  id: number
  title: string
  url: string | null
  score: number
  by: string
  time: number
  descendants: number
  type: string
  rank_position: number
  summary: string | null
  created_at: string
  updated_at: string
}

export type User = {
  id: string
  email: string
  username: string
  created_at: string
  updated_at: string
}