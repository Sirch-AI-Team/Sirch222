'use client'

import { useState, useEffect } from 'react'
import { supabase, User } from '../../lib/supabase'

export default function TFMLandingPage() {
  console.log('TFM Landing Page component mounted')

  const [activeTab, setActiveTab] = useState('buy');
  const [buyAmount, setBuyAmount] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [balance, setBalance] = useState(0);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  // Auth and loading states
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyLoading, setBuyLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  // Auth effect
  useEffect(() => {
    console.log('TFM useEffect started')
    const getSession = async () => {
      console.log('Getting session...')
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('Session received:', session)

        if (session?.user) {
          console.log('User found in session, fetching user data...')
          // Fetch our custom user data from the users table
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()

          console.log('User data:', userData, 'Error:', error)

          if (userData && !error) {
            console.log('Setting user and loading data...')
            setUser(userData)
            await loadUserData(userData)
          } else {
            console.error('Error fetching user data:', error)
            setLoading(false)
          }
        } else {
          console.log('No user in session, setting loading false')
          setUser(null)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error in getSession:', error)
        setLoading(false)
      }
    }
    // Add timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      console.error('Session timeout after 10 seconds')
      setLoading(false)
    }, 10000)

    getSession().finally(() => {
      clearTimeout(timeoutId)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        // Fetch our custom user data from the users table
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (userData && !error) {
          setUser(userData)
          await loadUserData(userData)
        } else {
          console.error('Error fetching user data:', error)
          setUser(null)
          setBalance(0)
          setTransactions([])
          setLoading(false)
        }
      } else {
        setUser(null)
        setBalance(0)
        setTransactions([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserData = async (user: User) => {
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
      window.location.href = '/auth'
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
      window.location.href = '/auth'
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
          toUsername: sendTo.includes('@') ? null : sendTo,
          toEmail: sendTo.includes('@') ? sendTo : null
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
            href="/auth"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send to
                </label>
                <input
                  type="text"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder="username or email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
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