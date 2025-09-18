import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server-side Supabase client with service role privileges
// This bypasses RLS and can perform administrative operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
})

// Helper function to create a client with user context for RLS
export const createUserClient = (userToken: string) => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${userToken}`
      }
    }
  })
}