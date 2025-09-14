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
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1)
  const [highlightedDomainIndex, setHighlightedDomainIndex] = useState(-1)
  const [suggestionCursorY, setSuggestionCursorY] = useState(0)
  const [modalCursorY, setModalCursorY] = useState(0)
  const [suggestions, setSuggestions] = useState<string[]>(['AI developments', 'React best practices', 'Startup funding', 'Open source projects'])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [popBoxAnswer, setPopBoxAnswer] = useState("")
  const [loadingPopBoxAnswer, setLoadingPopBoxAnswer] = useState(false)
  const [keyboardMode, setKeyboardMode] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [alignedSearchIndex, setAlignedSearchIndex] = useState<number | null>(null)

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
    if (searchQuery && alignedSearchIndex !== null && searchResults[alignedSearchIndex]?.description) {
      // Strip HTML tags from search result descriptions
      const description = searchResults[alignedSearchIndex].description
      return description.replace(/<[^>]*>/g, '')
    }

    if (searchQuery && searchResults.length > 0) {
      return `Search results for "${searchQuery}": Found ${searchResults.length} results from across the web.`
    }

    if (searchQuery && searchLoading) {
      return `Searching for "${searchQuery}"...`
    }

    if (searchQuery && !searchLoading && searchResults.length === 0) {
      return `No results found for "${searchQuery}". Try a different search term.`
    }

    if (alignedStoryIndex !== null && stories[alignedStoryIndex]?.summary) {
      const summary = stories[alignedStoryIndex].summary
      // Clean up the summary text - remove extra whitespace and ensure proper formatting
      const cleanedSummary = summary.trim().replace(/\s+/g, ' ')
      
      // If summary ends with incomplete sentence and "...", clean it up
      if (cleanedSummary.endsWith('...')) {
        // Find the last complete sentence
        const lastPeriod = cleanedSummary.lastIndexOf('.', cleanedSummary.length - 4)
        const lastExclamation = cleanedSummary.lastIndexOf('!', cleanedSummary.length - 4)
        const lastQuestion = cleanedSummary.lastIndexOf('?', cleanedSummary.length - 4)
        
        const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion)
        
        if (lastSentenceEnd > cleanedSummary.length * 0.5) {
          // If we found a sentence ending in the latter half, use up to that point
          return cleanedSummary.substring(0, lastSentenceEnd + 1)
        }
      }
      
      return cleanedSummary
    }

    return "Real-time HackerNews stories with AI-generated summaries. Updated every 10 minutes from the top 100 stories."
  }

  const [domainLogos, setDomainLogos] = useState<{[key: string]: string}>({})

  const getDynamicDomains = (query: string) => {
    // If query is short or empty, show default domains
    if (!query || query.length < 2) {
      return [
        { name: "github", logo_url: domainLogos["github"] },
        { name: "reddit", logo_url: domainLogos["reddit"] },
        { name: "twitter", logo_url: domainLogos["twitter"] },
        { name: "medium", logo_url: domainLogos["medium"] },
        { name: "youtube", logo_url: domainLogos["youtube"] },
        { name: "stackoverflow", logo_url: domainLogos["stackoverflow"] },
        { name: "netflix", logo_url: domainLogos["netflix"] },
        { name: "google", logo_url: domainLogos["google"] }
      ]
    }

    // Search for companies based on the query
    const searchTerm = query.toLowerCase().trim()
    const allCompanies = ['github', 'google', 'microsoft', 'apple', 'amazon', 'facebook', 'meta', 'netflix', 'spotify', 'uber', 'airbnb', 'tesla', 'nvidia', 'intel', 'adobe', 'salesforce', 'oracle', 'ibm', 'twitter', 'linkedin', 'reddit', 'youtube', 'instagram', 'tiktok', 'discord', 'slack', 'zoom', 'dropbox', 'notion', 'figma', 'canva', 'shopify', 'stripe', 'paypal', 'openai']
    
    // Find matches
    const matches = allCompanies.filter(company => 
      company.includes(searchTerm) || searchTerm.includes(company)
    ).slice(0, 8)

    // If no matches, return defaults
    if (matches.length === 0) {
      return [
        { name: "github", logo_url: domainLogos["github"] },
        { name: "reddit", logo_url: domainLogos["reddit"] },
        { name: "twitter", logo_url: domainLogos["twitter"] },
        { name: "google", logo_url: domainLogos["google"] }
      ]
    }

    return matches.map(company => ({
      name: company,
      logo_url: domainLogos[company]
    }))
  }

  // Fetch logos when component mounts
  useEffect(() => {
    const fetchAllLogos = async () => {
      const companies = ['github', 'google', 'microsoft', 'apple', 'amazon', 'facebook', 'meta', 'netflix', 'spotify', 'uber', 'airbnb', 'tesla', 'nvidia', 'intel', 'adobe', 'reddit', 'twitter', 'youtube', 'medium', 'stackoverflow', 'openai']
      
      const logoPromises = companies.map(async (company) => {
        try {
          const response = await fetch(`https://api.logo.dev/search?q=${company}`, {
            headers: {
              "Authorization": `Bearer pk_FjC0a9pEQ3mtM--cES0gLg`
            }
          })
          
          if (response.ok) {
            const data = await response.json()
            if (data.length > 0 && data[0].logo_url) {
              return { company, logo_url: data[0].logo_url }
            }
          }
        } catch (error) {
          console.log(`Failed to fetch logo for ${company}`)
        }
        return null
      })

      const results = await Promise.all(logoPromises)
      const logoMap: {[key: string]: string} = {}
      
      results.forEach(result => {
        if (result) {
          logoMap[result.company] = result.logo_url
        }
      })

      setDomainLogos(logoMap)
    }

    fetchAllLogos()
  }, [])

  const fetchAISuggestions = async (query: string = "") => {
    setLoadingSuggestions(true)
    try {
      const response = await fetch("/api/ai-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions)
        }
      }
    } catch (error) {
      console.error("Failed to fetch AI suggestions:", error)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const fetchPopBoxAnswer = async (query: string) => {
    if (!query || query.trim() === "") {
      setPopBoxAnswer("Navigate through suggestions to see detailed information about each search query. Use arrow keys or hover to explore different options.")
      return
    }

    setLoadingPopBoxAnswer(true)
    try {
      const response = await fetch("/api/popbox-answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.answer) {
          setPopBoxAnswer(data.answer)
        }
      }
    } catch (error) {
      console.error("Failed to fetch PopBox answer:", error)
      setPopBoxAnswer(`Search for "${query}" across multiple sources to find the latest articles, discussions, and insights on this topic.`)
    } finally {
      setLoadingPopBoxAnswer(false)
    }
  }

  const performSearch = async (query: string) => {
    if (!query || query.trim() === "") return

    setSearchLoading(true)
    setSearchQuery(query)
    setSearchResults([])

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.results || [])
      } else {
        console.error("Search API error:", response.status)
        setSearchResults([])
      }
    } catch (error) {
      console.error("Search error:", error)
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const getPopBoxText = () => {
    if (highlightedSuggestionIndex === -1) {
      return "Navigate through suggestions to see detailed information about each search query. Use arrow keys or hover to explore different options."
    }
    return loadingPopBoxAnswer ? "Generating answer..." : popBoxAnswer || "Loading information about this topic..."
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
      if (showCommandModal) {
        // Switch to cursor mode when mouse moves
        setKeyboardMode(false)
        
        // Track cursor in modal, but limit to suggestions area
        const modalElement = document.querySelector('.w-\\[640px\\].h-\\[480px\\]') as HTMLElement
        if (modalElement) {
          const modalRect = modalElement.getBoundingClientRect()
          const relativeY = e.clientY - modalRect.top
          const searchInputBottom = 150 // Bottom of search input area
          if (relativeY > searchInputBottom) {
            setModalCursorY(relativeY)
          } else {
            setModalCursorY(searchInputBottom + 10) // Default position just below search
          }
        }
      } else if (e.clientX > 400) { // Only track when mouse is in content area
        setCursorY(e.clientY)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [showCommandModal])


  // Fetch AI suggestions when modal opens or search query changes
  useEffect(() => {
    if (showCommandModal) {
      // Reset keyboard mode and highlighted index when modal opens
      setKeyboardMode(false)
      setHighlightedSuggestionIndex(-1)
      
      const timeoutId = setTimeout(() => {
        fetchAISuggestions(commandSearchQuery)
      }, 300) // Debounce for 300ms

      return () => clearTimeout(timeoutId)
    }
  }, [showCommandModal, commandSearchQuery])

  // Fetch PopBox answer when suggestion is highlighted
  useEffect(() => {
    if (showCommandModal && highlightedSuggestionIndex >= 0 && suggestions[highlightedSuggestionIndex]) {
      const timeoutId = setTimeout(() => {
        fetchPopBoxAnswer(suggestions[highlightedSuggestionIndex])
      }, 200) // Debounce for 200ms

      return () => clearTimeout(timeoutId)
    } else if (highlightedSuggestionIndex === -1) {
      setPopBoxAnswer("")
    }
  }, [highlightedSuggestionIndex, suggestions, showCommandModal])

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
            {/* PopSearch modal */}
            <div className="relative bg-white rounded shadow-xl border border-gray-200 w-[640px] h-[480px] max-w-[90vw] overflow-hidden flex flex-col">
              {showCommandModal && (
                <div
                  className="absolute w-4 h-px bg-black z-10"
                  style={{
                    top: `${modalCursorY}px`,
                    right: "0px",
                  }}
                />
              )}
              <div className="p-6 flex-1 flex flex-col">
                {/* Domain buttons */}
                <div className="mb-4">
                  <div
                    className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    {getDynamicDomains(commandSearchQuery).map((domain, index) => (
                      <button
                        key={domain.name}
                        className={`flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition-colors flex-shrink-0 ${
                          highlightedDomainIndex === index
                            ? "bg-orange-50 border-orange-200 text-orange-600"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                        onMouseEnter={() => setHighlightedDomainIndex(index)}
                        onClick={() => {
                          setCommandSearchQuery(`site:${domain.name}.com `)
                          setHighlightedDomainIndex(-1)
                        }}
                      >
                        {domain.logo_url ? (
                          <img 
                            src={domain.logo_url} 
                            alt={`${domain.name} logo`}
                            className="w-4 h-4 rounded-sm object-contain bg-white"
                            onError={(e) => {
                              // Replace with emoji fallback if logo fails to load
                              const fallbackEmojis: { [key: string]: string } = {
                                'github': '🐙', 'reddit': '🤖', 'twitter': '🐦', 'medium': '📝',
                                'youtube': '📺', 'stackoverflow': '💬', 'netflix': '🎬', 'google': '🌐',
                                'microsoft': '💻', 'apple': '🍎', 'amazon': '📦', 'facebook': '👥', 
                                'meta': '🌐', 'spotify': '🎵', 'openai': '🤖'
                              };
                              const img = e.target as HTMLImageElement;
                              const fallback = document.createElement('span');
                              fallback.textContent = fallbackEmojis[domain.name] || domain.name.charAt(0).toUpperCase();
                              fallback.className = 'text-xs';
                              img.parentNode?.replaceChild(fallback, img);
                            }}
                          />
                        ) : (
                          <span className="text-xs">
                            {(() => {
                              const fallbackEmojis: { [key: string]: string } = {
                                'github': '🐙', 'reddit': '🤖', 'twitter': '🐦', 'medium': '📝',
                                'youtube': '📺', 'stackoverflow': '💬', 'netflix': '🎬', 'google': '🌐',
                                'microsoft': '💻', 'apple': '🍎', 'amazon': '📦', 'facebook': '👥',
                                'meta': '🌐', 'spotify': '🎵', 'openai': '🤖'
                              };
                              return fallbackEmojis[domain.name] || domain.name.charAt(0).toUpperCase();
                            })()}
                          </span>
                        )}
                        <span className="capitalize">{domain.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search input */}
                <div className="mb-6 relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Type a command or search..."
                    value={commandSearchQuery}
                    onChange={(e) => setCommandSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm bg-black text-white border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition-colors placeholder-gray-400"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        // Check if a domain button is highlighted
                        if (highlightedDomainIndex >= 0) {
                          const domains = getDynamicDomains(commandSearchQuery)
                          const selectedDomain = domains[highlightedDomainIndex]
                          if (selectedDomain) {
                            setCommandSearchQuery(`site:${selectedDomain.name}.com `)
                            setHighlightedDomainIndex(-1)
                            return
                          }
                        }
                        
                        const queryToSearch = highlightedSuggestionIndex >= 0 && suggestions[highlightedSuggestionIndex] 
                          ? suggestions[highlightedSuggestionIndex] 
                          : commandSearchQuery.trim()
                        
                        if (queryToSearch) {
                          setShowCommandModal(false)
                          setCommandSearchQuery("")
                          performSearch(queryToSearch)
                        }
                      }
                      if (e.key === "Escape") {
                        setShowCommandModal(false)
                        setCommandSearchQuery("")
                      }
                      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault()
                        setKeyboardMode(true)
                        
                        if (e.key === 'ArrowDown') {
                          setHighlightedSuggestionIndex(prev => {
                            if (prev === -1) return 0 // First press starts at first item
                            const nextIndex = prev < suggestions.length - 1 ? prev + 1 : 0
                            return nextIndex
                          })
                        } else if (e.key === 'ArrowUp') {
                          setHighlightedSuggestionIndex(prev => {
                            if (prev === -1) return suggestions.length - 1 // First press starts at last item
                            const nextIndex = prev > 0 ? prev - 1 : suggestions.length - 1
                            return nextIndex
                          })
                        }
                      }
                      if (e.key === 'ArrowRight') {
                        e.preventDefault()
                        const domains = getDynamicDomains(commandSearchQuery)
                        setHighlightedDomainIndex(prev => {
                          if (prev === -1) return 0 // First press starts at first domain
                          const nextIndex = prev < domains.length - 1 ? prev + 1 : 0
                          return nextIndex
                        })
                      }
                      if (e.key === 'ArrowLeft') {
                        e.preventDefault()
                        const domains = getDynamicDomains(commandSearchQuery)
                        setHighlightedDomainIndex(prev => {
                          if (prev === -1) return domains.length - 1 // First press starts at last domain
                          const nextIndex = prev > 0 ? prev - 1 : domains.length - 1
                          return nextIndex
                        })
                      }
                    }}
                  />
                </div>

                {/* Suggestions area */}
                <div className="flex-1">
                  {loadingSuggestions ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-gray-400 text-sm">Generating suggestions...</div>
                    </div>
                  ) : (
                    suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setShowCommandModal(false)
                          setCommandSearchQuery("")
                          performSearch(suggestion)
                        }}
                        onMouseEnter={() => {
                          if (!keyboardMode) {
                            setHighlightedSuggestionIndex(index)
                          }
                        }}
                        className={`w-full flex items-center px-4 py-3 text-sm text-left hover:text-orange-500 rounded-lg transition-colors border-b border-gray-50 last:border-0 ${
                          highlightedSuggestionIndex === index ? "text-orange-500" : "text-black"
                        }`}
                      >
                        <span className="text-gray-400 mr-3 w-4 text-right flex-shrink-0">{index + 1}</span>
                        <span className="truncate">{suggestion}</span>
                      </button>
                    ))
                  )}
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

            {/* PopBox - matches main page sidebar styling */}
            <div className="relative bg-white border border-gray-100 shadow-sm w-80 h-80 p-4 flex flex-col ml-6">
              <div className="text-sm text-gray-500 leading-tight overflow-hidden flex-1">
                {getPopBoxText()}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-400">PopBox</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Vertical line separator */}
      <div className="fixed left-0 w-px h-full bg-black" style={{ left: "400px" }} />
      
      {/* Cursor line */}
      <div className="fixed w-4 h-px bg-black" style={{ top: `${cursorY}px`, left: "400px" }} />

      {/* MainBox */}
      <div className="fixed top-6 w-80 h-96 bg-white border border-gray-100 shadow-sm p-4" style={{ left: "24px" }}>
        <div className="text-sm text-gray-500 leading-relaxed overflow-y-auto h-full break-words">
          {getDisplayText()}
        </div>
      </div>

      {/* Bottom left links */}
      <div className="fixed bottom-6 left-6 flex gap-3">
        {searchQuery ? (
          <button
            onClick={() => {
              setSearchQuery("")
              setSearchResults([])
              setAlignedSearchIndex(null)
            }}
            className="text-xs text-black hover:text-gray-600 transition-colors"
          >
            Back to HackerNews
          </button>
        ) : (
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-black hover:text-gray-600 transition-colors"
          >
            Refresh Stories
          </button>
        )}
        
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
        {searchQuery ? (
          // Search Results
          searchLoading ? (
            <div className="text-center text-gray-400 mt-20">
              <p className="text-sm">Searching...</p>
              <p className="text-xs mt-2">Finding results for "{searchQuery}"</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center text-gray-400 mt-20">
              <p className="text-sm">No results found</p>
              <p className="text-xs mt-2">Try a different search term</p>
            </div>
          ) : (
            searchResults.map((result, index) => (
              <div
                key={index}
                className="py-3 border-b border-gray-50 last:border-0"
                onMouseEnter={() => setAlignedSearchIndex(index)}
              >
                <div className="flex gap-3">
                  <span
                    className={`text-sm w-6 flex-shrink-0 text-right ${
                      alignedSearchIndex === index ? "text-orange-500" : "text-gray-500"
                    }`}
                  >
                    {index + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <h2 className={`leading-snug ${alignedSearchIndex === index ? "text-orange-500" : "text-black"}`}>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={alignedSearchIndex === index ? "hover:text-orange-600" : "hover:text-gray-600"}
                      >
                        {result.title}
                      </a>
                    </h2>

                    <div className={`text-xs mt-1 ${alignedSearchIndex === index ? "text-orange-400" : "text-gray-400"}`}>
                      {new URL(result.url).hostname}
                      {result.age && ` • ${result.age}`}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )
        ) : stories.length === 0 ? (
          // HackerNews Loading
          <div className="text-center text-gray-400 mt-20">
            <p className="text-sm">No stories available</p>
            <p className="text-xs mt-2">Fetching from HackerNews...</p>
          </div>
        ) : (
          // HackerNews Stories
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