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

      {/* Profile Header */}
      <div className="pt-20 pb-8 px-6 text-center border-b border-gray-100">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">@{username}</h1>
        {data.profile.display_name && (
          <p className="text-lg text-gray-600 mb-2">{data.profile.display_name}</p>
        )}
        {data.profile.bio && (
          <p className="text-gray-500 max-w-2xl mx-auto">{data.profile.bio}</p>
        )}
        <div className="mt-4 text-sm text-gray-400">
          {data.total_count} saved page{data.total_count !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Saved Pages List */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="space-y-4">
          {data.saved_pages.map((page: SavedPage, index: number) => (
            <div
              key={page.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-gray-400">
                      #{index + 1}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded font-mono">
                      {getWebsiteName(page.url)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTimeAgo(page.saved_at)}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                    {page.title || 'Untitled Page'}
                  </h3>

                  {page.description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                      {page.description}
                    </p>
                  )}

                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 hover:text-orange-700 text-sm font-medium transition-colors inline-flex items-center gap-1"
                  >
                    Visit page
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                {page.thumbnail_url && (
                  <div className="flex-shrink-0">
                    <img
                      src={page.thumbnail_url}
                      alt="Page thumbnail"
                      className="w-16 h-16 object-cover rounded border border-gray-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {data.total_count >= 100 && (
          <div className="mt-8 text-center text-gray-500 text-sm">
            Showing the most recent 100 saved pages
          </div>
        )}
      </div>
    </div>
  )
}