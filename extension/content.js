(() => {
  if (window.__sirchPopSearchInitialized) {
    return
  }
  window.__sirchPopSearchInitialized = true

  const API_BASE = 'https://sirch.ai'
  const DEFAULT_SUGGESTIONS = ['AI developments', 'React best practices', 'Startup funding', 'Open source projects']

  const state = {
    visible: false,
    suggestions: [...DEFAULT_SUGGESTIONS],
    highlightedSuggestion: -1,
    loadingSuggestions: false,
    logos: [],
    highlightedLogo: -1,
    searchQuery: '',
    searchResults: [],
    searchLoading: false,
    popboxLoading: false,
    popboxText: '',
    streamingInterval: null,
    currentInputValue: ''
  }

  const dom = {
    root: null,
    overlay: null,
    backdrop: null,
    modalInput: null,
    suggestions: null,
    domains: null,
    popbox: null,
    resultsWrapper: null,
    resultsList: null,
    resultsEmpty: null
  }

  const escapeHTML = (value) => (
    value == null
      ? ''
      : String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
  )

  const debounce = (fn, delay) => {
    let timer
    return (...args) => {
      clearTimeout(timer)
      timer = setTimeout(() => fn(...args), delay)
    }
  }

  const stopStreamingText = () => {
    if (state.streamingInterval) {
      clearInterval(state.streamingInterval)
      state.streamingInterval = null
    }
  }

  const startStreamingText = (text) => {
    stopStreamingText()
    if (!text) {
      state.popboxText = ''
      renderPopBox()
      return
    }

    let index = 0
    state.popboxLoading = false
    state.streamingInterval = setInterval(() => {
      if (index < text.length) {
        state.popboxText = text.slice(0, index + 1)
        renderPopBox()
        index += 1
      } else {
        stopStreamingText()
        state.popboxText = text
        renderPopBox()
      }
    }, 20)
  }

  const ensureContainer = () => {
    if (dom.root) return

    const container = document.createElement('div')
    container.className = 'sirch-ext-scope'
    container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center hidden" data-sirch-overlay>
        <div class="absolute inset-0 backdrop-blur-sm" data-sirch-backdrop></div>
        <div class="flex items-start" style="margin-left: calc((100vw - 640px) / 3)">
          <div class="relative bg-white rounded shadow-xl border border-gray-200 w-[640px] h-[480px] max-w-[90vw] overflow-hidden flex flex-col">
            <div class="absolute w-4 h-px bg-black z-10" style="top: 150px; right: 0;"></div>
            <div class="py-1.5 px-3 flex-1 flex flex-col overflow-hidden">
              <div class="relative mt-0.5 mb-2 h-8">
                <div class="absolute top-0 left-0 right-0 flex items-center gap-2 overflow-x-auto scrollbar-hide" data-sirch-domains></div>
              </div>
              <div class="mb-1 relative">
                <div class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Human centric search, powered by AI"
                  class="w-full pl-10 pr-4 py-3 text-sm bg-black text-white border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition-colors placeholder-gray-400"
                  data-sirch-input
                />
              </div>
              <div class="flex-1 flex flex-col overflow-hidden">
                <div class="flex-1 overflow-y-auto" data-sirch-suggestions></div>
                <div class="mt-4 pt-4 border-t border-gray-100 hidden" data-sirch-results-wrapper>
                  <div class="space-y-3" data-sirch-results></div>
                  <div class="text-xs text-gray-400 pt-2" data-sirch-results-empty hidden>No results yet. Type a query and press Enter.</div>
                </div>
              </div>
            </div>
          </div>
          <div class="relative bg-white border border-gray-100 shadow-sm w-80 h-80 p-4 flex flex-col ml-6">
            <div class="text-sm text-black leading-tight overflow-hidden flex-1" data-sirch-popbox></div>
            <div class="mt-4 pt-4 border-t border-gray-100">
              <div class="text-xs text-gray-400">hit Tab for this rabbit hole</div>
            </div>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(container)

    dom.root = container
    dom.overlay = container.querySelector('[data-sirch-overlay]')
    dom.backdrop = container.querySelector('[data-sirch-backdrop]')
    dom.modalInput = container.querySelector('[data-sirch-input]')
    dom.suggestions = container.querySelector('[data-sirch-suggestions]')
    dom.domains = container.querySelector('[data-sirch-domains]')
    dom.popbox = container.querySelector('[data-sirch-popbox]')
    dom.resultsWrapper = container.querySelector('[data-sirch-results-wrapper]')
    dom.resultsList = container.querySelector('[data-sirch-results]')
    dom.resultsEmpty = container.querySelector('[data-sirch-results-empty]')

    dom.backdrop.addEventListener('click', closeOverlay)
    dom.modalInput.addEventListener('input', handleInput)
    dom.modalInput.addEventListener('keydown', handleKeyDown)

    dom.domains.addEventListener('click', (event) => {
      const button = event.target.closest('[data-domain]')
      if (!button) return
      const url = button.dataset.domain
      if (url) {
        window.open(url.startsWith('http') ? url : `https://${url}`, '_blank', 'noopener,noreferrer')
        closeOverlay()
      }
    })

    dom.suggestions.addEventListener('mousemove', (event) => {
      const item = event.target.closest('[data-suggestion-index]')
      if (!item) return
      const index = Number.parseInt(item.dataset.suggestionIndex, 10)
      if (!Number.isNaN(index)) {
        state.highlightedSuggestion = index
        renderSuggestions()
        const suggestion = state.suggestions[index]
        if (suggestion) {
          debouncedFetchPopBox(suggestion)
        }
      }
    })

    dom.suggestions.addEventListener('click', (event) => {
      const item = event.target.closest('[data-suggestion-index]')
      if (!item) return
      const index = Number.parseInt(item.dataset.suggestionIndex, 10)
      if (Number.isNaN(index)) return
      const suggestion = state.suggestions[index]
      if (!suggestion) return
      performSearch(suggestion)
    })
  }

  const openOverlay = () => {
    ensureContainer()
    dom.overlay.classList.remove('hidden')
    state.visible = true

    if (!state.currentInputValue) {
      state.highlightedSuggestion = state.suggestions.length ? 0 : -1
      if (state.suggestions[0]) {
        debouncedFetchPopBox(state.suggestions[0])
      }
    }

    dom.modalInput.value = state.currentInputValue || ''
    requestAnimationFrame(() => {
      dom.modalInput.focus({ preventScroll: true })
      dom.modalInput.select()
    })

    renderDomains()
    renderSuggestions()
    renderPopBox()
    renderResults()
  }

  const closeOverlay = () => {
    if (!dom.overlay) return
    dom.overlay.classList.add('hidden')
    state.visible = false
    stopStreamingText()
  }

  const toggleOverlay = () => {
    if (state.visible) {
      closeOverlay()
    } else {
      openOverlay()
      if (!state.suggestions.length) {
        fetchSuggestions('')
      }
    }
  }

  const handleInput = (event) => {
    const value = event.target.value
    state.currentInputValue = value
    state.searchQuery = value
    state.highlightedSuggestion = -1
    state.highlightedLogo = -1

    renderSuggestions()
    renderDomains()
    renderResults()

    fetchSuggestions(value)
    fetchLogos(value)
  }

  const handleKeyDown = (event) => {
    const key = event.key

    if (key === 'Escape') {
      event.preventDefault()
      closeOverlay()
      return
    }

    if (key === 'Enter') {
      event.preventDefault()
      if (state.highlightedLogo >= 0 && state.logos[state.highlightedLogo]) {
        const selected = state.logos[state.highlightedLogo]
        const rawDest = selected.domain || selected.url || ''
        if (rawDest) {
          const dest = rawDest.startsWith('http') ? rawDest : `https://${rawDest}`
          window.open(dest, '_blank', 'noopener,noreferrer')
          closeOverlay()
          return
        }
      }

      const query = state.highlightedSuggestion >= 0 && state.suggestions[state.highlightedSuggestion]
        ? state.suggestions[state.highlightedSuggestion]
        : (event.target.value || '').trim()

      if (query) {
        performSearch(query)
      }
      return
    }

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      const direction = key === 'ArrowDown' ? 1 : -1
      const total = state.suggestions.length
      if (!total) return
      let next = state.highlightedSuggestion + direction
      if (next >= total) next = 0
      if (next < 0) next = total - 1
      state.highlightedSuggestion = next
      renderSuggestions()
      const suggestion = state.suggestions[next]
      if (suggestion) {
        debouncedFetchPopBox(suggestion)
      }
      return
    }

    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      const domains = state.logos
      if (!domains.length) return
      event.preventDefault()
      const direction = key === 'ArrowRight' ? 1 : -1
      let next = state.highlightedLogo + direction
      if (next >= domains.length) next = 0
      if (next < 0) next = domains.length - 1
      state.highlightedLogo = next
      renderDomains()
    }
  }

  const renderSuggestions = () => {
    if (!dom.suggestions) return
    dom.suggestions.innerHTML = ''

    if (state.loadingSuggestions) {
      const loading = document.createElement('div')
      loading.className = 'flex items-center justify-center py-8'
      loading.innerHTML = '<div class="text-gray-400 text-sm">Generating suggestions...</div>'
      dom.suggestions.appendChild(loading)
      return
    }

    state.suggestions.forEach((suggestion, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.suggestionIndex = String(index)
      button.className = `w-full flex items-center px-4 py-3 text-sm text-left rounded-lg transition-colors border-b border-gray-50 last:border-0 ${
        state.highlightedSuggestion === index ? 'text-orange-500' : 'text-black'
      }`
      button.innerHTML = `
        <span class="mr-3 w-4 text-right flex-shrink-0">${state.highlightedSuggestion === index ? '•' : '&nbsp;'}</span>
        <span class="truncate">${escapeHTML(suggestion)}</span>
      `
      dom.suggestions.appendChild(button)
    })
  }

  const renderDomains = () => {
    if (!dom.domains) return
    dom.domains.innerHTML = ''

    if (!state.logos.length) {
      dom.domains.classList.add('hidden')
      return
    }

    dom.domains.classList.remove('hidden')

    state.logos.forEach((logo, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      const rawDomain = logo.domain || ''
      if (rawDomain) {
        button.dataset.domain = rawDomain.startsWith('http') ? rawDomain : `https://${rawDomain}`
      } else {
        button.dataset.domain = ''
      }
      button.className = `flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition-colors flex-shrink-0 ${
        state.highlightedLogo === index
          ? 'bg-orange-50 border-orange-200 text-orange-600'
          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
      }`
      button.innerHTML = `
        ${logo.logo_url ? `<img src="${escapeHTML(logo.logo_url)}" alt="${escapeHTML(logo.name)}" class="w-4 h-4 rounded-sm object-contain bg-white" />` : '<span class="text-xs">•</span>'}
        <span class="capitalize">${escapeHTML(logo.name)}</span>
      `
      dom.domains.appendChild(button)
    })
  }

  const renderPopBox = () => {
    if (!dom.popbox) return

    if (state.popboxLoading) {
      dom.popbox.innerHTML = '<span class="text-xl" style="animation: blink 1s infinite">•</span>'
      return
    }

    const text = state.popboxText || 'Navigate through suggestions to see detailed information about each search query. Use arrow keys or hover to explore different options.'
    dom.popbox.textContent = text
  }

  const renderResults = () => {
    if (!dom.resultsWrapper || !dom.resultsList || !dom.resultsEmpty) return

    if (!state.searchQuery) {
      dom.resultsWrapper.classList.add('hidden')
      dom.resultsEmpty.textContent = 'No results yet. Type a query and press Enter.'
      dom.resultsEmpty.hidden = false
      dom.resultsList.innerHTML = ''
      return
    }

    dom.resultsWrapper.classList.remove('hidden')

    if (state.searchLoading) {
      dom.resultsList.innerHTML = '<div class="text-center text-gray-400"><p class="text-sm">Searching...</p><p class="text-xs mt-2">Finding results for "' + escapeHTML(state.searchQuery) + '"</p></div>'
      dom.resultsEmpty.hidden = true
      return
    }

    if (!state.searchResults.length) {
      dom.resultsList.innerHTML = ''
      dom.resultsEmpty.textContent = 'No results found. Try a different search term.'
      dom.resultsEmpty.hidden = false
      return
    }

    dom.resultsEmpty.hidden = true
    dom.resultsList.innerHTML = ''

    state.searchResults.forEach((result, index) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'py-3 border-b border-gray-50 last:border-0'
      const title = escapeHTML(result.title || 'Untitled result')
      const description = result.description ? escapeHTML(result.description.replace(/<[^>]*>/g, '')) : ''
      const url = escapeHTML(result.url || '#')

      wrapper.innerHTML = `
        <div class="flex gap-3">
          <span class="text-sm w-6 flex-shrink-0 text-right text-gray-500">${index + 1}</span>
          <div class="flex-1 min-w-0">
            <a href="${url || '#'}" target="_blank" rel="noopener noreferrer" class="text-base font-medium text-black hover:text-gray-600 truncate block">${title}</a>
            ${description ? `<div class="text-xs mt-1 text-gray-400">${description}</div>` : ''}
            ${result.url ? `<div class="text-xs mt-1 text-gray-300 break-words">${escapeHTML(result.url)}</div>` : ''}
          </div>
        </div>
      `
      dom.resultsList.appendChild(wrapper)
    })
  }

  const fetchSuggestions = debounce(async (query) => {
    state.loadingSuggestions = true
    renderSuggestions()
    try {
      const response = await fetch(`${API_BASE}/api/ai-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data.suggestions) && data.suggestions.length) {
          state.suggestions = data.suggestions
        } else if (!query) {
          state.suggestions = [...DEFAULT_SUGGESTIONS]
        }
      }
    } catch (error) {
      console.error('Sirch PopSearch: failed to fetch suggestions', error)
      if (!query) {
        state.suggestions = [...DEFAULT_SUGGESTIONS]
      }
    } finally {
      state.loadingSuggestions = false
      renderSuggestions()
    }
  }, 250)

  const fetchLogos = debounce(async (query) => {
    if (!query || query.trim().length < 1) {
      state.logos = []
      renderDomains()
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/search-logos?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          state.logos = data.map((item) => ({
            name: item.name || item.domain || 'Link',
            logo_url: item.logo_url || '',
            domain: item.domain || item.url || ''
          }))
          state.highlightedLogo = state.logos.length > 0 ? 0 : -1
        }
      }
    } catch (error) {
      console.error('Sirch PopSearch: failed to fetch logos', error)
    } finally {
      renderDomains()
    }
  }, 300)

  const fetchPopBoxAnswer = async (query) => {
    stopStreamingText()
    if (!query || !query.trim()) {
      state.popboxText = ''
      renderPopBox()
      return
    }

    state.popboxLoading = true
    renderPopBox()

    try {
      const response = await fetch(`${API_BASE}/api/popbox-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      if (response.ok) {
        const data = await response.json()
        if (data?.answer) {
          startStreamingText(data.answer)
        } else {
          state.popboxText = ''
          renderPopBox()
        }
      } else {
        state.popboxText = ''
        renderPopBox()
      }
    } catch (error) {
      console.error('Sirch PopSearch: failed to fetch PopBox answer', error)
      state.popboxText = ''
      renderPopBox()
    } finally {
      state.popboxLoading = false
    }
  }

  const debouncedFetchPopBox = debounce(fetchPopBoxAnswer, 200)

  const performSearch = async (query) => {
    if (!query || !query.trim()) return

    state.searchQuery = query
    state.searchLoading = true
    state.searchResults = []
    renderResults()

    try {
      const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data.results)) {
          state.searchResults = data.results
        } else {
          state.searchResults = []
        }
      }
    } catch (error) {
      console.error('Sirch PopSearch: search failed', error)
      state.searchResults = []
    } finally {
      state.searchLoading = false
      renderResults()
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'SIRCH_TOGGLE') return
    toggleOverlay()
  })

  document.addEventListener('keydown', (event) => {
    if (!state.visible) return
    if (event.key === 'Escape') {
      closeOverlay()
    }
  })
})()
