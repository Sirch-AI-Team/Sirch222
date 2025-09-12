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
  const [showCommandModal, setShowCommandModal] = useState(false)
  const [commandSearchQuery, setCommandSearchQuery] = useState("")

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
      {/* PopSearch Modal */}
      {showCommandModal && (
        <div className="fixed inset-0 z-50 flex items-center">
          <div className="absolute inset-0 backdrop-blur-sm" onClick={() => setShowCommandModal(false)} />
          
          <div className="flex items-start" style={{ marginLeft: "calc((100vw - 640px) / 3)" }}>
            <div className="relative bg-white rounded shadow-xl border border-gray-200 w-[640px] h-[480px] max-w-[90vw] overflow-hidden flex flex-col">
              <div className="p-6 flex-1 flex flex-col">
                {/* Search input */}
                <div className="mb-6 relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Type a command or search..."
                    value={commandSearchQuery}
                    onChange={(e) => setCommandSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm bg-transparent border border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors placeholder-gray-400"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && commandSearchQuery.trim()) {
                        // Handle search
                        console.log("Search:", commandSearchQuery)
                        setShowCommandModal(false)
                        setCommandSearchQuery("")
                      }
                      if (e.key === "Escape") {
                        setShowCommandModal(false)
                        setCommandSearchQuery("")
                      }
                    }}
                  />
                </div>

                {/* Suggestions area */}
                <div className="flex-1">
                  <div className="text-sm text-gray-500 mb-4">
                    Popular searches:
                  </div>
                  {['AI developments', 'React best practices', 'Startup funding', 'Open source projects'].map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCommandSearchQuery(suggestion)
                        console.log("Search:", suggestion)
                        setShowCommandModal(false)
                        setCommandSearchQuery("")
                      }}
                      className="w-full flex items-center px-4 py-3 text-sm text-left hover:text-orange-500 rounded-lg transition-colors border-b border-gray-50 last:border-0"
                    >
                      <span className="text-gray-400 mr-3 w-4 text-right flex-shrink-0">{index + 1}</span>
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                  <div className="text-xs text-gray-400">PopSearch</div>
                  <div className="text-xs text-gray-400">
                    <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600">↵</kbd> to search •{" "}
                    <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-600">esc</kbd> to close
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
          onClick={() => setShowCommandModal(true)}
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