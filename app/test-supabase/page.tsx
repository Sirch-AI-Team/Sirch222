'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function TestSupabasePage() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const testConnection = async () => {
    setLoading(true)
    setResult('Step 1: Testing basic connectivity...')

    try {
      // Step 1: Test basic fetch to Supabase
      setResult('Step 1: Testing fetch to Supabase API...')
      const basicResponse = await fetch('https://liobdrwdjkznvqigglxw.supabase.co/rest/v1/', {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpb2Jkcndkamt6bnZxaWdnbHh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NTYwNzUsImV4cCI6MjA3MzEzMjA3NX0.RghbXl5KZA2hVFCjUcH-gSaQg6Wc_ykVIRbJVkDYsLM'
        }
      })

      if (!basicResponse.ok) {
        setResult(`❌ Step 1 failed: HTTP ${basicResponse.status}`)
        return
      }

      // Step 2: Test Supabase client creation
      setResult('Step 2: Creating Supabase client...')
      console.log('Creating Supabase client...')

      const supabase = createClient(
        'https://liobdrwdjkznvqigglxw.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpb2Jkcndkamt6bnZxaWdnbHh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1NTYwNzUsImV4cCI6MjA3MzEzMjA3NX0.RghbXl5KZA2hVFCjUcH-gSaQg6Wc_ykVIRbJVkDYsLM',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
          }
        }
      )

      console.log('Client created successfully')

      // Step 3: Test simple query
      setResult('Step 3: Testing simple database query...')
      console.log('Testing simple query...')

      const queryPromise = supabase.from('hack').select('count(*)').limit(1)
      const queryTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000)
      )

      const { data: testData, error: testError } = await Promise.race([queryPromise, queryTimeoutPromise]) as any

      if (testError) {
        setResult(`❌ Step 3 failed: ${testError.message}`)
        return
      }

      console.log('Query successful')
      setResult(`✅ All tests passed! Database accessible, client working.`)

    } catch (error) {
      console.error('Test failed:', error)
      setResult(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Supabase Connection Test</h1>

        <button
          onClick={testConnection}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors mb-4"
        >
          {loading ? 'Testing...' : 'Test Connection'}
        </button>

        {result && (
          <div className={`p-3 rounded-md text-sm ${
            result.includes('✅') ? 'bg-green-100 text-green-700' :
            result.includes('❌') ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {result}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500">
          <p>This page tests:</p>
          <ul className="list-disc list-inside mt-1">
            <li>Supabase client creation</li>
            <li>Basic database query</li>
            <li>Auth session with timeout</li>
          </ul>
        </div>
      </div>
    </div>
  )
}