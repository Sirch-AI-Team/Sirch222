import { NextRequest } from 'next/server'
import TurboPufferService from '../../../lib/turbopuffer'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing TurboPuffer search...')
    console.log('TURBOPUFFER_API_KEY exists:', !!process.env.TURBOPUFFER_API_KEY)
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY)

    // Test search with a known user ID from the database
    const testUserId = 'c7657359-4008-4591-a2b0-b70fdaf447a9' // shleiby@gmail.com
    const testQuery = 'AI'

    console.log('Searching for:', testQuery)
    console.log('User ID:', testUserId)

    const searchResult = await TurboPufferService.searchSavedPages(
      testUserId,
      testQuery,
      10
    )

    console.log('TurboPuffer search result:', searchResult)

    return Response.json({
      success: true,
      query: testQuery,
      userId: testUserId,
      turbopufferResult: searchResult,
      message: 'TurboPuffer search test completed'
    })

  } catch (error) {
    console.error('Search test error:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}