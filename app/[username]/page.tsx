"use client"

import { useState, useEffect, useCallback } from "react"
import { UserSavedPagesResponse, SavedPage } from "../../lib/supabase"
import { supabase } from "../../lib/supabase"
import { User } from "@supabase/supabase-js"

interface UserProfilePageProps {
  params: { username: string }
}

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const [data, setData] = useState<UserSavedPagesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [currentUserUsername, setCurrentUserUsername] = useState<string | null>(null)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [deletingPages, setDeletingPages] = useState<Set<string>>(new Set())
  const [savingPages, setSavingPages] = useState<Set<string>>(new Set())
  const [savedPages, setSavedPages] = useState<Set<string>>(new Set())

  // AI Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SavedPage[]>([])
  const [searching, setSearching] = useState(false)
  const [showingSearchResults, setShowingSearchResults] = useState(false)

  const { username } = params

  const isViewingOwnProfile = isOwnProfile || (currentUserUsername !== null && currentUserUsername === username)

  // Initialize auth
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', currentUser.id)
          .single()

        if (profile?.username) {
          setCurrentUserUsername(profile.username)
          setIsOwnProfile(profile.username === username)
        }
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      initAuth()
    })

    return () => subscription.unsubscribe()
  }, [username])

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: { session } } = await supabase.auth.getSession()
        const headers: HeadersInit = {}
        const token = session?.access_token
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(`/api/users/${username}/saved`, { headers })

        if (!response.ok) {
          if (response.status === 404) {
            setError('User not found or profile is private')
          } else {
            setError('Failed to load user profile')
          }
          return
        }

        const result = await response.json()
        setData(result)

        // Trust the server's ownership determination
        if (typeof result.is_owner === 'boolean') {
          setIsOwnProfile(result.is_owner)
        }
      } catch (err) {
        setError('Failed to load user profile')
        console.error('Error fetching user data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [username])

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const savedTime = new Date(timestamp)
    const diffInSeconds = Math.floor((now.getTime() - savedTime.getTime()) / 1000)

    if (diffInSeconds < 60) return 'just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }

  const getWebsiteName = (url: string) => {
    try {
      const domain = new URL(url).hostname
      return domain
        .replace(/^www\./, "")
        .replace(/\.(com|org|net|io|co|ai|dev)$/, "")
        .split(".")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("")
    } catch {
      return "Web"
    }
  }

  const handleDeletePage = async (pageId: string, url: string) => {
    if (!user || !isViewingOwnProfile) return

    setDeletingPages(prev => new Set(prev).add(pageId))

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('No auth token available')
        return
      }

      const response = await fetch(`/api/saved-pages/${pageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        // Remove from local state
        setData(prev => prev ? {
          ...prev,
          saved_pages: prev.saved_pages.filter(page => page.id !== pageId),
          total_count: prev.total_count - 1
        } : null)
      } else {
        console.error('Failed to delete page')
      }
    } catch (error) {
      console.error('Error deleting page:', error)
    } finally {
      setDeletingPages(prev => {
        const newSet = new Set(prev)
        newSet.delete(pageId)
        return newSet
      })
    }
  }

  const handleSavePage = async (url: string, title?: string, description?: string) => {
    if (!user || isViewingOwnProfile) return

    // Optimistically add to saved pages immediately
    setSavedPages(prev => new Set(prev).add(url))

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('No auth token available')
        // Remove from optimistic state on auth failure
        setSavedPages(prev => {
          const newSet = new Set(prev)
          newSet.delete(url)
          return newSet
        })
        return
      }

      // Make API call in background
      const response = await fetch('/api/save-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          url,
          title,
          description,
        }),
      })

      if (!response.ok) {
        console.error('Failed to save page')
        // Remove from optimistic state on failure
        setSavedPages(prev => {
          const newSet = new Set(prev)
          newSet.delete(url)
          return newSet
        })
      }
    } catch (error) {
      console.error('Error saving page:', error)
      // Remove from optimistic state on error
      setSavedPages(prev => {
        const newSet = new Set(prev)
        newSet.delete(url)
        return newSet
      })
    }
  }

  const handleAISearch = useCallback(async (query: string) => {
    if (!query.trim() || !user) {
      setSearchResults([])
      setShowingSearchResults(false)
      return
    }

    setSearching(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('No session available for search')
        return
      }

      const response = await fetch('/api/search-saved-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          query: query.trim(),
          limit: 20,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setSearchResults(result.results || [])
        setShowingSearchResults(true)
      } else {
        console.error('Search failed:', response.status)
      }
    } catch (error) {
      console.error('Error searching:', error)
    } finally {
      setSearching(false)
    }
  }, [user])

  // Debounced search effect
  useEffect(() => {
    if (!isViewingOwnProfile) return

    const timeoutId = setTimeout(() => {
      handleAISearch(searchQuery)
    }, 30) // 30ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery, isViewingOwnProfile, handleAISearch])

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setShowingSearchResults(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400">Loading {username}'s saved pages...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="text-gray-600 text-lg mb-4">{error}</div>
        <a
          href="/"
          className="text-orange-600 hover:text-orange-700 transition-colors"
        >
          ← Back to Sirch
        </a>
      </div>
    )
  }

  if (!data || data.saved_pages.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">@{username}</h1>
          <div className="text-gray-600 text-lg mb-8">No saved pages yet</div>
          <a
            href="/"
            className="text-orange-600 hover:text-orange-700 transition-colors"
          >
            ← Back to Sirch
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Back to main button */}
      <div className="fixed top-6 left-6 z-40">
        <a
          href="/"
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          ← Back to Sirch
        </a>
      </div>

      {/* Share indicator for own profile */}
      {isViewingOwnProfile && (
        <div className="fixed top-6 right-6 z-40">
          <div className="px-4 py-2 text-sm text-gray-800 font-semibold bg-gray-100 rounded-md">
            Share with my closest friends
          </div>
        </div>
      )}

      {/* Main content container matching main page */}
      <main className="max-w-2xl mx-auto pt-16 pb-8 px-6">
        {/* Profile Header */}
        {isViewingOwnProfile ? (
          // Own Profile: AI Search Interface
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-lg text-gray-800 mb-4">Search my stuff with AI</h2>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask AI about your saved content..."
                  className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:border-gray-400 text-gray-800 text-sm"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  </div>
                )}
              </div>

              {showingSearchResults && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm text-gray-500">
                      Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
                    </div>
                    <button
                      onClick={clearSearch}
                      className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Show all pages
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="border-b border-gray-100 mb-6"></div>
          </div>
        ) : (
          // Other Profile: Traditional View
          <div className="mb-8">
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">@{username}</h1>
              {data.profile.display_name && (
                <p className="text-gray-600 mb-3 text-lg">{data.profile.display_name}</p>
              )}
              <button className="text-sm text-blue-600 hover:text-blue-700 transition-colors mb-3 px-4 py-2 border border-blue-200 rounded-md font-medium">
                Subscribe
              </button>
              <div className="text-sm text-gray-500">
                {data.total_count} saved page{data.total_count !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}

        {/* Saved Pages List - show search results or all pages */}
        {(showingSearchResults ? searchResults : data.saved_pages).map((page: SavedPage, index: number) => (
          <div
            key={page.id}
            className="py-3 border-b border-gray-50 last:border-0"
          >
            <div className="flex gap-3">
              <span className="text-sm w-6 flex-shrink-0 text-right text-gray-500">
                {index + 1}
              </span>

              {/* Action button - garbage can for own profile, heart for others */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (isViewingOwnProfile) {
                    handleDeletePage(page.id, page.url)
                  } else {
                    handleSavePage(page.url, page.title || undefined, page.description || undefined)
                  }
                }}
                disabled={deletingPages.has(page.id)}
                className={`flex-shrink-0 w-4 h-4 flex items-center justify-center transition-colors ${
                  deletingPages.has(page.id)
                    ? "text-gray-400"
                    : isViewingOwnProfile
                      ? "text-gray-400 hover:text-red-500"
                      : savedPages.has(page.url)
                        ? "text-red-500"
                        : "text-gray-400 hover:text-red-500"
                }`}
                title={isViewingOwnProfile ? "Delete page" : "Save page to my profile"}
              >
                {deletingPages.has(page.id) ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                ) : isViewingOwnProfile ? (
                  // Garbage can icon for own profile
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ) : savedPages.has(page.url) ? (
                  // Filled heart icon for saved pages
                  <svg className="w-3 h-3" fill="currentColor" stroke="none" viewBox="0 0 24 24">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                ) : (
                  // Empty heart icon for unsaved pages
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <h2 className="leading-snug text-black">
                  <button
                    onClick={() => {
                      console.log('Opening URL:', page.url)
                      window.open(page.url, '_blank', 'noopener,noreferrer')
                    }}
                    className="text-left hover:text-gray-600 transition-colors"
                  >
                    {page.title || 'Untitled Page'}
                  </button>
                </h2>

                <div className="text-xs mt-1 text-gray-400">
                  {getWebsiteName(page.url)} • {formatTimeAgo(page.saved_at)}
                </div>
              </div>
            </div>
          </div>
        ))}

        {data.total_count >= 100 && (
          <div className="mt-8 text-center text-gray-500 text-sm">
            Showing the most recent 100 saved pages
          </div>
        )}
      </main>
    </div>
  )
}
