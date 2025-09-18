// Custom fetch-based Supabase API calls to bypass hanging JS client

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Helper function to make direct API calls to Supabase
async function supabaseFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Supabase API error: ${response.status} ${errorText}`)
  }

  return response.json()
}

// Get user by ID
export async function fetchUser(userId: string) {
  return supabaseFetch(`/users?id=eq.${userId}&select=*`, {
    method: 'GET'
  })
}

// Get TFM balance
export async function fetchTfmBalance(userId: string) {
  return supabaseFetch(`/tfm_balances?user_id=eq.${userId}&select=*`, {
    method: 'GET'
  })
}

// Get transactions
export async function fetchTransactions(userId: string, limit = 10) {
  return supabaseFetch(
    `/transactions?or=(from_user_id.eq.${userId},to_user_id.eq.${userId})&select=*,from_user:from_user_id(email,username),to_user:to_user_id(email,username)&order=created_at.desc&limit=${limit}`,
    {
      method: 'GET'
    }
  )
}

// Auth session check using direct auth API
export async function checkAuthSession() {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    })

    if (response.ok) {
      return await response.json()
    }
    return null
  } catch (error) {
    console.error('Auth session check failed:', error)
    return null
  }
}