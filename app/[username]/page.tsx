"use client"

import { useState, useEffect } from "react"
import { UserSavedPagesResponse, SavedPage } from "../../lib/supabase"

interface UserProfilePageProps {
  params: { username: string }
}

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const [data, setData] = useState<UserSavedPagesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { username } = params

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
        {/* Profile Header - minimal like main page */}
        <div className="mb-6 pb-4 border-b border-gray-100">
          <h1 className="text-2xl font-semibold text-gray-800 mb-1">@{username}</h1>
          {data.profile.display_name && (
            <p className="text-gray-600 mb-1">{data.profile.display_name}</p>
          )}
          <div className="text-sm text-gray-400">
            {data.total_count} saved page{data.total_count !== 1 ? 's' : ''}
          </div>
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

              {/* Heart icon placeholder (no functionality) */}
              <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                <svg className="w-3 h-3 text-red-500" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>

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