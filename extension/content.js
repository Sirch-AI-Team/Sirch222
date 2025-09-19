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

  let dom = {
    container: null,
    backdrop: null,
    shell: null,
    input: null,
    suggestions: null,
    domains: null,
    popbox: null,
    results: null,
    resultsEmpty: null
  }

  const debounce = (fn, delay) => {
    let timer
    return (...args) => {
      clearTimeout(timer)
      timer = setTimeout(() => fn(...args), delay)
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

  const stopStreamingText = () => {
    if (state.streamingInterval) {
      clearInterval(state.streamingInterval)
      state.streamingInterval = null
    }
  }

  const ensureContainer = () => {
    if (dom.container) return

    const container = document.createElement('div')
    container.className = 'sirch-popsearch-overlay'
    container.innerHTML = `
      <div class="sirch-popsearch-backdrop"></div>
      <div class="sirch-popsearch-shell" role="dialog" aria-modal="true">
        <div class="sirch-popsearch-panel">
          <div class="sirch-input-wrapper">
            <input type="text" class="sirch-input" placeholder="Search Sirch..." autocomplete="off" />
          </div>
          <div class="sirch-domain-row"></div>
          <div class="sirch-suggestions"></div>
          <div class="sirch-results" hidden>
            <div class="sirch-results-empty" hidden>No results yet. Type a query and press Enter.</div>
            <div class="sirch-results-list"></div>
          </div>
        </div>
        <div class="sirch-popbox-panel">
          <div class="sirch-popbox-title">PopBox</div>
          <div class="sirch-popbox-content"></div>
        </div>
      </div>
    `

    document.body.appendChild(container)

    dom.container = container
    dom.backdrop = container.querySelector('.sirch-popsearch-backdrop')
    dom.shell = container.querySelector('.sirch-popsearch-shell')
    dom.input = container.querySelector('.sirch-input')
    dom.suggestions = container.querySelector('.sirch-suggestions')
    dom.domains = container.querySelector('.sirch-domain-row')
    dom.popbox = container.querySelector('.sirch-popbox-content')
    dom.results = container.querySelector('.sirch-results')
    dom.resultsEmpty = container.querySelector('.sirch-results-empty')
    dom.resultsList = container.querySelector('.sirch-results-list')

    dom.backdrop.addEventListener('click', closeOverlay)
    dom.input.addEventListener('input', handleInput)
    dom.input.addEventListener('keydown', handleKeyDown)

    dom.suggestions.addEventListener('mousemove', (event) => {
      const item = event.target.closest('[data-suggestion-index]')
      if (!item) return
      const index = Number.parseInt(item.dataset.suggestionIndex, 10)
      if (!Number.isNaN(index)) {
        state.highlightedSuggestion = index
        renderSuggestions()
        if (state.suggestions[index]) {
          debouncedFetchPopBox(state.suggestions[index])
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
      closeOverlay()
    })

    dom.domains.addEventListener('click', (event) => {
      const item = event.target.closest('[data-domain-url]')
      if (!item) return
      const url = item.dataset.domainUrl
      if (url) {
        window.open(url.startsWith('http') ? url : `https://${url}`, '_blank', 'noopener,noreferrer')
        closeOverlay()
      }
    })
  }

 const openOverlay = () => {
   ensureContainer()
   dom.container.classList.add('sirch-visible')
   state.visible = true
    if (!state.currentInputValue) {
      state.highlightedSuggestion = state.suggestions.length ? 0 : -1
      if (state.suggestions[0]) {
        debouncedFetchPopBox(state.suggestions[0])
      }
    }
    dom.input.value = state.currentInputValue || ''
    requestAnimationFrame(() => {
      dom.input.focus({ preventScroll: true })
      dom.input.select()
    })
    renderSuggestions()
    renderPopBox()
    renderDomains()
    renderResults()
  }

  const closeOverlay = () => {
    if (!dom.container) return
    dom.container.classList.remove('sirch-visible')
    state.visible = false
    stopStreamingText()
  }

  const toggleOverlay = () => {
    if (state.visible) {
      closeOverlay()
    } else {
      openOverlay()
      if (!state.currentInputValue) {
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
      const value = dom.input.value.trim()
      if (value) {
        performSearch(value)
      }
      return
    }

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      const direction = key === 'ArrowDown' ? 1 : -1
      const total = state.suggestions.length
      if (total === 0) return
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
      return
    }
  }

  const renderSuggestions = () => {
    if (!dom.suggestions) return
    dom.suggestions.innerHTML = ''

    const list = state.suggestions
    if (state.loadingSuggestions) {
      dom.suggestions.innerHTML = '<div class="sirch-loading">Generating suggestions...</div>'
      return
    }

    list.forEach((suggestion, index) => {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = `sirch-suggestion ${state.highlightedSuggestion === index ? 'sirch-suggestion-active' : ''}`
      item.dataset.suggestionIndex = String(index)
      item.innerHTML = `
        <span class="sirch-suggestion-bullet">${state.highlightedSuggestion === index ? '•' : ''}</span>
        <span class="sirch-suggestion-text">${suggestion}</span>
      `
      dom.suggestions.appendChild(item)
    })
  }

  const renderDomains = () => {
    if (!dom.domains) return
    dom.domains.innerHTML = ''

    if (!state.logos.length) {
      dom.domains.classList.remove('sirch-domain-row-visible')
      return
    }

    dom.domains.classList.add('sirch-domain-row-visible')

    state.logos.forEach((logo, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `sirch-domain ${state.highlightedLogo === index ? 'sirch-domain-active' : ''}`
      button.dataset.domainUrl = logo.domain.startsWith('http') ? logo.domain : `https://${logo.domain}`
      button.innerHTML = `
        ${logo.logo_url ? `<img src="${logo.logo_url}" alt="${logo.name} logo" />` : ''}
        <span>${logo.name}</span>
      `
      dom.domains.appendChild(button)
    })
  }

  const renderPopBox = () => {
    if (!dom.popbox) return
    if (state.popboxLoading) {
      dom.popbox.innerHTML = '<div class="sirch-popbox-loading">●</div>'
      return
    }

    const text = state.popboxText || 'Navigate through suggestions to see detailed information about each search query. Use arrow keys or hover to explore different options.'
    dom.popbox.textContent = text
  }

  const renderResults = () => {
    if (!dom.results || !dom.resultsList || !dom.resultsEmpty) return

    if (!state.searchQuery) {
      dom.results.hidden = true
      return
    }

    dom.results.hidden = false

    if (state.searchLoading) {
      dom.resultsList.innerHTML = '<div class="sirch-loading">Searching...</div>'
      dom.resultsEmpty.hidden = true
      return
    }

    if (!state.searchResults.length) {
      dom.resultsList.innerHTML = ''
      dom.resultsEmpty.hidden = false
      return
    }

    dom.resultsEmpty.hidden = true
    dom.resultsList.innerHTML = ''

    state.searchResults.forEach((result) => {
      const item = document.createElement('a')
      item.className = 'sirch-result'
      item.href = result.url || '#'
      item.target = '_blank'
      item.rel = 'noopener noreferrer'
      item.innerHTML = `
        <div class="sirch-result-title">${result.title || 'Untitled result'}</div>
        ${result.description ? `<div class="sirch-result-description">${result.description.replace(/<[^>]*>/g, '')}</div>` : ''}
        ${result.url ? `<div class="sirch-result-url">${result.url}</div>` : ''}
      `
      dom.resultsList.appendChild(item)
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
      await new Promise((resolve) => setTimeout(resolve, 300))
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
