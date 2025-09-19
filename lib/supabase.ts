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

export type UserProfile = {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  is_public: boolean
  created_at: string
}

export type SavedPage = {
  id: string
  url: string
  title: string | null
  description: string | null
  thumbnail_url: string | null
  domain: string | null
  saved_at: string
  metadata: Record<string, any>
}

export type UserSavedPagesResponse = {
  success: boolean
  profile: {
    username: string
    display_name: string | null
    bio: string | null
    avatar_url: string | null
    created_at: string
  }
  saved_pages: SavedPage[]
  total_count: number
  is_owner?: boolean
}
