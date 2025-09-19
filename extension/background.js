chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-popsearch') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return
      await chrome.tabs.sendMessage(tab.id, { type: 'SIRCH_TOGGLE' })
    } catch (error) {
      console.error('Sirch PopSearch: failed to send toggle command', error)
    }
  }
})

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.tabs.sendMessage(tab.id, { type: 'SIRCH_TOGGLE' })
  }
})
