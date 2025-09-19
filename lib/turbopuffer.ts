import { Turbopuffer } from '@turbopuffer/turbopuffer'
import OpenAI from 'openai'
import * as cheerio from 'cheerio'

// Initialize clients
const turbopuffer = new Turbopuffer({
  apiKey: process.env.TURBOPUFFER_API_KEY || '',
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Namespace for user saved pages
const SAVED_PAGES_NAMESPACE = 'saved_pages'

export interface SavedPageVector {
  id: string
  user_id: string
  url: string
  title: string
  content: string
  domain: string
  saved_at: string
}

export class TurboPufferService {
  /**
   * Index a saved page for AI search
   */
  static async indexSavedPage(
    pageId: string,
    userId: string,
    url: string,
    title: string,
    content: string,
    domain: string,
    savedAt: string
  ) {
    try {
      const ns = turbopuffer.namespace(SAVED_PAGES_NAMESPACE)
      const embedding = await this.generateEmbedding(content)

      await ns.write({
        upsert_rows: [
          {
            id: pageId,
            vector: embedding,
            user_id: userId,
            url: url,
            title: title,
            content: content.substring(0, 1000), // Truncate for storage efficiency
            domain: domain,
            saved_at: savedAt,
          },
        ],
        distance_metric: 'cosine_distance',
      })

      return { success: true }
    } catch (error) {
      console.error('Error indexing saved page:', error)
      return { success: false, error }
    }
  }

  /**
   * Search saved pages using AI/vector search
   */
  static async searchSavedPages(userId: string, query: string, limit: number = 10) {
    try {
      const ns = turbopuffer.namespace(SAVED_PAGES_NAMESPACE)
      const queryVector = await this.generateEmbedding(query)

      const results = await ns.query({
        rank_by: ['vector', 'ANN', queryVector],
        top_k: limit,
        filters: ['user_id', 'Eq', userId], // Only search this user's saved pages
        include_attributes: true,
      })

      return {
        success: true,
        results: (results.rows || results).map((match: any) => ({
          id: match.id,
          score: match.$dist || match.dist,
          url: match.attributes?.url || match.url,
          title: match.attributes?.title || match.title,
          content: match.attributes?.content || match.content,
          domain: match.attributes?.domain || match.domain,
          saved_at: match.attributes?.saved_at || match.saved_at,
        })),
      }
    } catch (error) {
      console.error('Error searching saved pages:', error)
      return { success: false, error, results: [] }
    }
  }

  /**
   * Remove a saved page from the index
   */
  static async removeSavedPage(pageId: string) {
    try {
      const ns = turbopuffer.namespace(SAVED_PAGES_NAMESPACE)

      await ns.write({
        deletes: [pageId],
      })

      return { success: true }
    } catch (error) {
      console.error('Error removing saved page from index:', error)
      return { success: false, error }
    }
  }

  /**
   * Generate embedding for text content using OpenAI
   */
  private static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // Limit to ~8k characters for embedding
      })

      return response.data[0].embedding
    } catch (error) {
      console.error('Error generating embedding:', error)
      // Return a zero vector as fallback
      return new Array(1536).fill(0)
    }
  }

  /**
   * Extract text content from a webpage
   */
  static async extractPageContent(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Sirch-AI/1.0)',
        },
        timeout: 10000, // 10 second timeout
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      // Remove script and style elements
      $('script, style, nav, header, footer, aside').remove()

      // Extract text from main content areas
      let content = ''

      // Try to get main content first
      const mainSelectors = ['main', 'article', '.content', '#content', '.post', '.entry']
      for (const selector of mainSelectors) {
        const mainContent = $(selector).text().trim()
        if (mainContent.length > content.length) {
          content = mainContent
        }
      }

      // If no main content found, get body text
      if (!content) {
        content = $('body').text().trim()
      }

      // Clean up the text
      content = content
        .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
        .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
        .trim()

      return content.substring(0, 5000) // Limit content length
    } catch (error) {
      console.error('Error extracting page content:', error)
      return ''
    }
  }
}

export default TurboPufferService