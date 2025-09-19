import { NextRequest } from 'next/server'
import TurboPufferService from '../../../lib/turbopuffer'

export async function POST(request: NextRequest) {
  try {
    console.log('Testing TurboPuffer connection...')
    console.log('TURBOPUFFER_API_KEY exists:', !!process.env.TURBOPUFFER_API_KEY)
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY)

    // Try to index a test document
    const result = await TurboPufferService.indexSavedPage(
      'test-id-123',
      'test-user-456',
      'https://example.com',
      'Test Article About AI',
      'This is a test article about artificial intelligence and machine learning.',
      'example.com',
      new Date().toISOString()
    )

    console.log('TurboPuffer test result:', result)

    if (result.success) {
      return Response.json({
        success: true,
        message: 'TurboPuffer namespace created and test document indexed successfully!',
        result
      })
    } else {
      return Response.json({
        success: false,
        message: 'TurboPuffer indexing failed',
        error: result.error
      }, { status: 500 })
    }

  } catch (error) {
    console.error('TurboPuffer test error:', error)
    return Response.json({
      success: false,
      message: 'TurboPuffer test failed',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}