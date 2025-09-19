"use client"

import { useState, useEffect } from "react"
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
  const { username } = params

  // Auth effect
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        // Get current user's username
        const { data: profile } = await supabase
          .from('users')
          .select('username')
          .eq('id', currentUser.id)
          .single()

        if (profile?.username) {
          setCurrentUserUsername(profile.username)
          setIsOwnProfile(profile.username === username)
        }
      }
    }
    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        const { data: profile } = await supabase
          .from('users')
          .select('username')
          .eq('id', currentUser.id)
          .single()

        if (profile?.username) {
          setCurrentUserUsername(profile.username)
          setIsOwnProfile(profile.username === username)
        }
      } else {
        setCurrentUserUsername(null)
        setIsOwnProfile(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [username])

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/users/${username}/saved`)

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
    if (!user || !isOwnProfile) return

    setDeletingPages(prev => new Set(prev).add(pageId))

    try {
      const response = await fetch(`/api/saved-pages/${pageId}`, {
        method: 'DELETE',
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
    if (!user || isOwnProfile) return

    setSavingPages(prev => new Set(prev).add(url))

    try {
      const response = await fetch('/api/saved-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          title,
          description,
        }),
      })

      if (response.ok) {
        console.log('Page saved successfully')
      } else {
        console.error('Failed to save page')
      }
    } catch (error) {
      console.error('Error saving page:', error)
    } finally {
      setSavingPages(prev => {
        const newSet = new Set(prev)
        newSet.delete(url)
        return newSet
      })
    }
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

      {/* Main content container matching main page */}
      <main className="max-w-2xl mx-auto pt-16 pb-8 px-6">
        {/* Profile Header - conditional based on ownership */}
        <div className="mb-6 pb-4 border-b border-gray-100">
          {isOwnProfile ? (
            <>
              <h1 className="text-2xl font-semibold text-gray-800 mb-1">My Profile</h1>
              <button className="text-sm text-blue-600 hover:text-blue-700 transition-colors mb-2">
                📋 share a link with friends
              </button>
              <div className="text-sm text-gray-400">
                {data.total_count} saved page{data.total_count !== 1 ? 's' : ''}
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-gray-800 mb-1">@{username}</h1>
              {data.profile.display_name && (
                <p className="text-gray-600 mb-1">{data.profile.display_name}</p>
              )}
              <button className="text-sm text-blue-600 hover:text-blue-700 transition-colors mb-2 px-3 py-1 border border-blue-200 rounded-md">
                Subscribe
              </button>
              <div className="text-sm text-gray-400">
                {data.total_count} saved page{data.total_count !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </div>

        {/* Saved Pages List - exactly like main page stories */}
        {data.saved_pages.map((page: SavedPage, index: number) => (
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
                  if (isOwnProfile) {
                    handleDeletePage(page.id, page.url)
                  } else {
                    handleSavePage(page.url, page.title || undefined, page.description || undefined)
                  }
                }}
                disabled={deletingPages.has(page.id) || savingPages.has(page.url)}
                className={`flex-shrink-0 w-4 h-4 flex items-center justify-center transition-colors ${
                  deletingPages.has(page.id) || savingPages.has(page.url)
                    ? "text-gray-400"
                    : isOwnProfile
                      ? "text-gray-400 hover:text-red-500"
                      : "text-gray-400 hover:text-red-500"
                }`}
                title={isOwnProfile ? "Delete page" : "Save page to my profile"}
              >
                {deletingPages.has(page.id) || savingPages.has(page.url) ? (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                ) : isOwnProfile ? (
                  // Garbage can icon for own profile
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ) : (
                  // Empty heart icon for other profiles
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <h2 className="leading-snug text-black">
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gray-600"
                  >
                    {page.title || 'Untitled Page'}
                  </a>
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