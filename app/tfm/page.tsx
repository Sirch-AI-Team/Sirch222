'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchUser, fetchTfmBalance, fetchTransactions } from '../../lib/supabaseFetch'

// Extended user type that includes handle
interface TfmUser {
  id: string
  email: string
  username?: string
  handle?: string
  created_at?: string
  updated_at?: string
}

export default function TFMLandingPage() {
  console.log('TFM Landing Page component mounted')

  const [activeTab, setActiveTab] = useState('buy');
  const [buyAmount, setBuyAmount] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [balance, setBalance] = useState(0);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  // Auth and loading states
  const [user, setUser] = useState<TfmUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyLoading, setBuyLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [message, setMessage] = useState('')
  const [refreshingHandle, setRefreshingHandle] = useState(false)
  const [handleSuggestions, setHandleSuggestions] = useState<{handle: string, email: string}[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Auth effect - simplified approach using direct fetch
  useEffect(() => {
    console.log('TFM useEffect started')

    const loadTfmData = async () => {
      try {
        console.log('Attempting to load TFM data...')

        // Try to get current auth user without hanging session calls
        const authUser = await supabase.auth.getUser()
        console.log('Auth user check:', authUser)

        if (authUser.data.user && !authUser.error) {
          console.log('Found authenticated user, fetching data...')

          // Get session for access token
          const { data: { session } } = await supabase.auth.getSession()
          const accessToken = session?.access_token

          // Fetch user data using Supabase client for proper RLS context
          const { data: userDataArray, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.data.user.id)

          if (userError) {
            console.error('User data error:', userError)
            setLoading(false)
          } else if (userDataArray && userDataArray.length > 0) {
            const userData = userDataArray[0]
            console.log('User data loaded:', userData)
            setUser(userData)
            await loadUserDataDirect(userData)
          } else {
            console.log('No user data found')
            setLoading(false)
          }
        } else {
          console.log('No authenticated user found')
          setUser(null)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error loading TFM data:', error)
        setLoading(false)
      }
    }

    loadTfmData()

    // Still listen for auth state changes but handle them more simply
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state changed:', _event, session?.user?.id)
      if (session?.user) {
        loadTfmData()
      } else {
        setUser(null)
        setBalance(0)
        setTransactions([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Direct data loading using Supabase client for proper RLS context
  const loadUserDataDirect = async (user: TfmUser) => {
    try {
      console.log('Loading TFM data for user:', user.email)

      // Load balance using Supabase client
      const { data: balanceData, error: balanceError } = await supabase
        .from('tfm_balances')
        .select('*')
        .eq('user_id', user.id)

      console.log('Balance data:', balanceData)

      if (balanceError) {
        console.error('Balance error:', balanceError)
        setBalance(0)
      } else if (balanceData && balanceData.length > 0) {
        setBalance(parseFloat(balanceData[0].balance || 0))
      } else {
        setBalance(0)
      }

      // Load transactions using Supabase client
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          *,
          from_user:from_user_id(email,username),
          to_user:to_user_id(email,username)
        `)
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(10)
      console.log('Transactions data:', transactionsData)
      console.log('Transactions error:', transactionsError)

      if (transactionsError) {
        console.error('Transactions error:', transactionsError)
        setTransactions([])
        return
      }

      // Format transactions for display
      const formattedTransactions = transactionsData?.map((tx: any) => ({
        id: tx.id,
        type: tx.transaction_type,
        amount: parseFloat(tx.amount),
        usd_amount: tx.usd_amount ? parseFloat(tx.usd_amount) : null,
        exchange_rate: tx.exchange_rate ? parseFloat(tx.exchange_rate) : null,
        status: tx.status,
        description: tx.description,
        created_at: tx.created_at,
        processed_at: tx.processed_at,
        direction: tx.from_user?.email === user.email ? 'outgoing' : 'incoming',
        counterparty: tx.from_user?.email === user.email ? tx.to_user : tx.from_user,
        display_type: tx.transaction_type === 'purchase' ? 'purchased' :
                     tx.transaction_type === 'transfer_out' ? 'sent' :
                     tx.transaction_type === 'transfer_in' ? 'received' :
                     tx.transaction_type === 'ad_payment' ? 'ad_spend' :
                     tx.transaction_type
      })) || []

      setTransactions(formattedTransactions)

    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Keep original function for API calls that still work
  const loadUserData = async (user: TfmUser) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('No session or access token available')
        return
      }

      console.log('Loading TFM data for user:', user.email)

      // Load balance
      const balanceResponse = await fetch('/api/tfm/balance', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      console.log('Balance response status:', balanceResponse.status)

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json()
        console.log('Balance data:', balanceData)
        setBalance(parseFloat(balanceData.balance?.balance || 0))
      } else {
        const errorData = await balanceResponse.json()
        console.error('Balance API error:', errorData)
      }

      // Load transactions
      const transactionsResponse = await fetch('/api/tfm/transactions?limit=10', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      console.log('Transactions response status:', transactionsResponse.status)

      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json()
        console.log('Transactions data:', transactionsData)
        setTransactions(transactionsData.transactions || [])
      } else {
        const errorData = await transactionsResponse.json()
        console.error('Transactions API error:', errorData)
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBuy = async () => {
    if (!user) {
      window.location.href = '/auth?redirectTo=/tfm'
      return
    }

    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      setMessage('Please enter a valid amount')
      return
    }

    setBuyLoading(true)
    setMessage('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const response = await fetch('/api/tfm/purchase', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          usdAmount: parseFloat(buyAmount)
        })
      })

      const data = await response.json()

      if (data.success) {
        setBalance(data.new_balance)
        setBuyAmount('')
        setMessage(data.message)
        await loadUserData(user) // Refresh transactions
      } else {
        setMessage(data.error || 'Purchase failed')
      }
    } catch (error) {
      setMessage('Purchase failed. Please try again.')
      console.error('Purchase error:', error)
    } finally {
      setBuyLoading(false)
    }
  }

  const handleSend = async () => {
    if (!user) {
      window.location.href = '/auth?redirectTo=/tfm'
      return
    }

    if (!sendAmount || parseFloat(sendAmount) <= 0) {
      setMessage('Please enter a valid amount to send')
      return
    }

    if (!sendTo.trim()) {
      setMessage('Please enter recipient username or email')
      return
    }

    if (parseFloat(sendAmount) > balance) {
      setMessage('Insufficient balance')
      return
    }

    setSendLoading(true)
    setMessage('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const response = await fetch('/api/tfm/transfer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: parseFloat(sendAmount),
          toUsername: !sendTo.includes('@') && !sendTo.includes(' ') ? sendTo : null,
          toEmail: sendTo.includes('@') ? sendTo : null,
          toHandle: sendTo.includes(' ') ? sendTo : null
        })
      })

      const data = await response.json()

      if (data.success) {
        setBalance(data.new_balance)
        setSendAmount('')
        setSendTo('')
        setMessage(data.message)
        await loadUserData(user) // Refresh transactions
      } else {
        setMessage(data.error || 'Transfer failed')
      }
    } catch (error) {
      setMessage('Transfer failed. Please try again.')
      console.error('Transfer error:', error)
    } finally {
      setSendLoading(false)
    }
  }

  const handleRefreshHandle = async () => {
    if (!user) return

    setRefreshingHandle(true)
    setMessage('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const response = await fetch('/api/tfm/generate-handle', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (data.success) {
        setUser({ ...user, handle: data.handle })
        setMessage(`Your new handle is "${data.handle}"`)
      } else {
        setMessage(data.error || 'Failed to generate new handle')
      }
    } catch (error) {
      setMessage('Failed to generate new handle. Please try again.')
      console.error('Handle refresh error:', error)
    } finally {
      setRefreshingHandle(false)
    }
  }

  // Handle autocomplete search
  const searchHandles = async (query: string) => {
    if (!query || query.length < 1) {
      setHandleSuggestions([])
      setShowSuggestions(false)
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(`/api/tfm/search-handles?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setHandleSuggestions(data.handles || [])
        setShowSuggestions(data.handles?.length > 0)
      }
    } catch (error) {
      console.error('Handle search error:', error)
    }
  }

  // Debounced handle search
  useEffect(() => {
    if (sendTo.includes(' ') && sendTo.length >= 1) {
      const timeoutId = setTimeout(() => {
        searchHandles(sendTo)
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setHandleSuggestions([])
      setShowSuggestions(false)
    }
  }, [sendTo])

  const tabs = [
    { id: 'buy', label: 'Buy', icon: '💰' },
    { id: 'send', label: 'Send', icon: '📤' },
    { id: 'history', label: 'History', icon: '📋' },
    { id: 'about', label: 'About', icon: '❓' }
  ];

  const faqs = [
    {
      question: "What is TFM?",
      answer: "TFM stands for Totally Fake Money. It's a digital currency that embraces its artificial nature while providing real utility. Unlike other cryptocurrencies that pretend to be revolutionary, we're honest about being fake."
    },
    {
      question: "Is this real money?",
      answer: "No, it's totally fake money. But then again, most money these days is just numbers in computers anyway. At least we're honest about it."
    },
    {
      question: "How do I get TFM?",
      answer: "You can buy TFM at a 1:1 ratio with USD because why complicate things? Just enter an amount in the Buy tab and click purchase. It's that simple."
    },
    {
      question: "Can I send TFM to others?",
      answer: "Absolutely! Use the Send tab to transfer TFM to other users. Just enter their username or email and the amount. Your fake money will be fake-transferred instantly."
    },
    {
      question: "What can I do with TFM?",
      answer: "You can buy coffee, pizza, groceries, or anything else that accepts totally fake money. Which is surprisingly more places than you'd think."
    },
    {
      question: "Is TFM secure?",
      answer: "It's as secure as any other fake digital currency. We use cutting-edge fake encryption and fake blockchain technology to ensure your fake money stays fake-safe."
    },
    {
      question: "Why should I use TFM?",
      answer: "Because it's honest. No promises of getting rich, no complex white papers, no environmental damage. Just simple, fake money that works."
    },
    {
      question: "How does TFM gain value?",
      answer: "TFM is the only currency accepted for purchasing ads on this search engine. As our search engine grows and more businesses want to advertise, demand for TFM increases, securing its value. It's fake money with real utility."
    },
    {
      question: "Is there a discount available?",
      answer: "Yes! During our inception phase, you can purchase TFM for 90% off the regular price. This early adopter discount won't last forever, so get your totally fake money while it's cheap."
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading TFM data...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-center mb-8">
          <h1 className="text-6xl md:text-8xl font-bold font-mono tracking-tight text-gray-800 mb-4">
            TFM
          </h1>
          <p className="text-gray-600 mb-6">Please sign in to access your TFM account</p>
          <a
            href="/auth?redirectTo=/tfm"
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            Sign In / Sign Up
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 font-sans pt-20 pb-20">
      {/* Back to main button */}
      <div className="fixed top-6 left-6">
        <a
          href="/"
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          ← Back to Sirch
        </a>
      </div>

      {/* Handle Display - Top Right */}
      <div className="fixed top-6 right-6">
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <p className="text-lg font-mono font-semibold text-gray-800">
              {user?.handle || 'Loading...'}
            </p>
            <button
              onClick={handleRefreshHandle}
              disabled={refreshingHandle}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              title="Generate new handle"
            >
              {refreshingHandle ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="14 14" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                  <path d="M3 21v-5h5"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-6xl md:text-8xl font-bold font-mono tracking-tight text-gray-800">
          TFM
        </h1>
      </div>

      {/* Balance Display */}
      <div className="text-center mb-6">
        <p className="text-sm text-gray-500 mb-1">Your Balance</p>
        <p className="text-3xl font-mono font-semibold text-gray-800">
          {balance.toFixed(2)} <span className="text-orange-600">TFM</span>
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-md">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center space-x-1">
                <span className="text-xs">{tab.icon}</span>
                <span>{tab.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-md text-sm ${
            message.includes('Success') || message.includes('purchased') || message.includes('sent')
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'buy' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount to Buy
                </label>
                <input
                  type="number"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  1 USD = 10 TFM (90% off inception discount!)
                </p>
              </div>
              <button
                onClick={handleBuy}
                disabled={!buyAmount || parseFloat(buyAmount) <= 0 || buyLoading}
                className="w-full bg-orange-600 text-white py-2 px-4 rounded-md font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {buyLoading ? 'Processing...' : 'Purchase TFM'}
              </button>
            </div>
          )}

          {activeTab === 'send' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount to Send
                </label>
                <input
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available: {balance.toFixed(2)} TFM
                </p>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send to
                </label>
                <input
                  type="text"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  onFocus={() => {
                    if (handleSuggestions.length > 0) {
                      setShowSuggestions(true)
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding suggestions to allow clicks
                    setTimeout(() => setShowSuggestions(false), 200)
                  }}
                  placeholder="email or handle"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />

                {/* Autocomplete Suggestions */}
                {showSuggestions && handleSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {handleSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setSendTo(suggestion.handle)
                          setShowSuggestions(false)
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                      >
                        <div className="font-medium text-gray-900">{suggestion.handle}</div>
                        <div className="text-sm text-gray-500">{suggestion.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleSend}
                disabled={!sendAmount || parseFloat(sendAmount) <= 0 || !sendTo.trim() || sendLoading}
                className="w-full bg-orange-600 text-white py-2 px-4 rounded-md font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {sendLoading ? 'Sending...' : 'Send TFM'}
              </button>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Transactions</h3>
              {transactions.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No transactions yet</p>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded font-mono ${
                          tx.display_type === 'received' ? 'bg-green-100 text-green-700' :
                          tx.display_type === 'sent' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {tx.display_type}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 font-mono mt-1">
                        {tx.counterparty?.username || tx.counterparty?.email || tx.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-medium ${
                        tx.direction === 'incoming' ? 'text-green-600' : 'text-gray-800'
                      }`}>
                        {tx.direction === 'incoming' ? '+' : '-'}{tx.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">{tx.status}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Frequently Asked Questions</h3>
              {faqs.map((faq, index) => (
                <div key={index} className="border-b border-gray-100 last:border-b-0">
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                    className="w-full text-left py-3 hover:text-orange-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{faq.question}</span>
                      <span className="text-gray-400 ml-2">
                        {expandedFAQ === index ? '−' : '+'}
                      </span>
                    </div>
                  </button>
                  {expandedFAQ === index && (
                    <div className="pb-3 -mt-1">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}