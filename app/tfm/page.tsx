'use client'

import { useState } from 'react';

export default function TFMLandingPage() {
  const [activeTab, setActiveTab] = useState('buy');
  const [buyAmount, setBuyAmount] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [balance, setBalance] = useState(1247.50);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const transactions = [
    { id: 1, type: 'received', amount: 150.00, from: 'coffee-shop-downtown', time: '2h ago', status: 'confirmed' },
    { id: 2, type: 'sent', amount: 25.50, to: 'pizza-place-main-st', time: '5h ago', status: 'confirmed' },
    { id: 3, type: 'received', amount: 500.00, from: 'friend-sarah', time: '1d ago', status: 'confirmed' },
    { id: 4, type: 'sent', amount: 75.25, to: 'grocery-store-elm', time: '2d ago', status: 'confirmed' },
    { id: 5, type: 'purchased', amount: 1000.00, from: 'bank-transfer', time: '3d ago', status: 'confirmed' },
  ];

  const handleBuy = () => {
    if (buyAmount && parseFloat(buyAmount) > 0) {
      setBalance(prev => prev + parseFloat(buyAmount));
      setBuyAmount('');
      alert(`Successfully purchased ${buyAmount} TFM`);
    }
  };

  const handleSend = () => {
    if (sendAmount && parseFloat(sendAmount) > 0 && parseFloat(sendAmount) <= balance) {
      setBalance(prev => prev - parseFloat(sendAmount));
      setSendAmount('');
      alert(`Successfully sent ${sendAmount} TFM`);
    } else if (parseFloat(sendAmount) > balance) {
      alert('Insufficient balance');
    }
  };

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
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
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
                  1 USD = 1 TFM (because why complicate things?)
                </p>
              </div>
              <button
                onClick={handleBuy}
                disabled={!buyAmount || parseFloat(buyAmount) <= 0}
                className="w-full bg-orange-600 text-white py-2 px-4 rounded-md font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Purchase TFM
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
                  placeholder="username or email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!sendAmount || parseFloat(sendAmount) <= 0}
                className="w-full bg-orange-600 text-white py-2 px-4 rounded-md font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Send TFM
              </button>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Transactions</h3>
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded font-mono ${
                        tx.type === 'received' ? 'bg-green-100 text-green-700' :
                        tx.type === 'sent' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {tx.type}
                      </span>
                      <span className="text-xs text-gray-500">{tx.time}</span>
                    </div>
                    <p className="text-sm text-gray-700 font-mono mt-1">
                      {tx.from || tx.to}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-medium ${
                      tx.type === 'received' ? 'text-green-600' : 'text-gray-800'
                    }`}>
                      {tx.type === 'received' ? '+' : '-'}{tx.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">{tx.status}</p>
                  </div>
                </div>
              ))}
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