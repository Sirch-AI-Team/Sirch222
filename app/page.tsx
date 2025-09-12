"use client"

import { useState, useEffect } from "react"

interface Story {
  id: number
  title: string
  url?: string
  score: number
  author: string
  time: string | number
  descendants?: number
  summary?: string
  status?: string
}

export default function HackerNewsClient() {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [alignedStoryIndex, setAlignedStoryIndex] = useState<number | null>(null)
  const [cursorY, setCursorY] = useState(0)

  const formatTimeAgo = (timestamp: string | number) => {
    const time = typeof timestamp === "string" ? Number.parseInt(timestamp) : timestamp
    const now = Date.now() / 1000
    const diff = now - time
    const hours = Math.floor(diff / 3600)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d`
    if (hours > 0) return `${hours}h`
    return "now"
  }

  const getWebsiteName = (url?: string) => {
    if (!url) return "HN"

    try {
      const domain = new URL(url).hostname
      return domain
        .replace(/^www\./, "")
        .replace(/\.(com|org|net|io|co|ai|dev)$/, "")
        .split(".")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("")
    } catch {
      return "HN"
    }
  }

  const getDisplayText = () => {
    if (alignedStoryIndex !== null && stories[alignedStoryIndex]?.summary) {
      return stories[alignedStoryIndex].summary
    }

    return "Real-time HackerNews stories with AI-generated summaries. Updated every 10 minutes from the top 100 stories."
  }

  useEffect(() => {
    const fetchStories = async () => {
      try {
        console.log("[Sirch] Fetching stories from API...")
        const response = await fetch("/api/stories")

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        console.log("[Sirch] API response:", data)

        if (data.stories && data.stories.length > 0) {
          setStories(data.stories)
          console.log(`[Sirch] Loaded ${data.stories.length} stories`)
        } else {
          console.log("[Sirch] No stories available")
        }
        setLoading(false)
      } catch (error) {
        console.error("[Sirch] Error fetching stories:", error)
        setLoading(false)
      }
    }

    fetchStories()

    const interval = setInterval(fetchStories, 2 * 60 * 1000) // Refresh every 2 minutes
    return () => clearInterval(interval)
  }, [])

  // Mouse tracking for cursor line
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX > 400) { // Only track when mouse is in content area
        setCursorY(e.clientY)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-400">Loading stories...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Vertical line separator */}
      <div className="fixed left-0 w-px h-full bg-black" style={{ left: "400px" }} />
      
      {/* Cursor line */}
      <div className="fixed w-4 h-px bg-black" style={{ top: `${cursorY}px`, left: "400px" }} />

      {/* Sidebar */}
      <div className="fixed top-6 w-80 h-80 bg-white border border-gray-100 shadow-sm p-4" style={{ left: "24px" }}>
        <div className="text-sm text-gray-500 leading-tight overflow-hidden flex-1">
          {getDisplayText()}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            Sirch • AI-powered HackerNews
          </div>
        </div>
      </div>

      {/* Bottom left links */}
      <div className="fixed bottom-6 left-6 flex gap-3">
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-black hover:text-gray-600 transition-colors"
        >
          Refresh Stories
        </button>
        
        <button
          className="text-xs text-black hover:text-gray-600 transition-colors"
        >
          Sirch
        </button>
        
        <a 
          href="mailto:josh@sirch.org" 
          className="text-xs text-black hover:text-gray-600 transition-colors"
        >
          Contact
        </a>
      </div>

      {/* Main content */}
      <main className="py-6" style={{ paddingLeft: "432px" }}>
        {stories.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-sm">No stories available</p>
            <p className="text-xs mt-2">Fetching from HackerNews...</p>
          </div>
        ) : (
          stories.map((story, index) => (
            <div
              key={story.id}
              className="py-3 border-b border-gray-50 last:border-0"
              onMouseEnter={() => setAlignedStoryIndex(index)}
            >
              <div className="flex gap-3">
                <span
                  className={`text-sm w-6 flex-shrink-0 text-right ${
                    alignedStoryIndex === index ? "text-orange-500" : "text-gray-500"
                  }`}
                >
                  {index + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <h2 className={`leading-snug ${alignedStoryIndex === index ? "text-orange-500" : "text-black"}`}>
                    <a
                      href={story.url || `https://news.ycombinator.com/item?id=${story.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={alignedStoryIndex === index ? "hover:text-orange-600" : "hover:text-gray-600"}
                    >
                      {story.title}
                    </a>
                  </h2>

                  <div className={`text-xs mt-1 ${alignedStoryIndex === index ? "text-orange-400" : "text-gray-400"}`}>
                    {story.score} • {getWebsiteName(story.url)} • {formatTimeAgo(story.time)} •
                    <a
                      href={`https://news.ycombinator.com/item?id=${story.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={alignedStoryIndex === index ? "hover:text-orange-600 ml-1" : "hover:text-gray-600 transition-colors ml-1"}
                    >
                      {story.descendants || 0} comments
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}