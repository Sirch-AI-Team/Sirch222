export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { selectedQuery, highlightedResult, searchResults } = await request.json()

    console.log("[ResultSummary] Generating summary for result:", highlightedResult?.title || 'No title')

    const openaiKey = process.env.OPENAI_API_KEY

    if (!openaiKey) {
      return Response.json({
        summary: `${highlightedResult?.title || 'This search result'} provides relevant information about "${selectedQuery}". Navigate through other results to explore different perspectives and sources on this topic.`
      })
    }

    // Extract result information
    const resultTitle = highlightedResult?.title || 'Search result'
    const resultDescription = highlightedResult?.description || 'No description available'
    const resultUrl = highlightedResult?.url || ''

    // Create context from other search results for comparison
    const otherResults = searchResults && searchResults.length > 1
      ? searchResults.slice(0, 3).filter((r: any) => r.url !== resultUrl).map((r: any) =>
          `- ${r.title}`
        ).join('\n')
      : ''

    const contextualInfo = otherResults ? `\n\nOther related results for comparison:\n${otherResults}` : ''

    const prompt = `Summarize this specific search result as it relates to the query "${selectedQuery}":

Title: ${resultTitle}
Description: ${resultDescription}
Source: ${resultUrl}${contextualInfo}

Provide a 2-3 sentence summary that explains:
1. What specific information this source offers about "${selectedQuery}"
2. What makes this particular result unique or valuable compared to other sources
3. Key insights or perspective this source provides

Focus on being concise and highlighting what's distinctive about THIS specific result.`

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.5
      })
    })

    if (!openaiResponse.ok) {
      console.error("[ResultSummary] OpenAI API error:", openaiResponse.status)
      return Response.json({
        summary: `${resultTitle} offers specific insights about "${selectedQuery}". This source provides a unique perspective that complements other available information on this topic.`
      })
    }

    const aiData = await openaiResponse.json()
    const aiResponse = aiData.choices?.[0]?.message?.content?.trim()

    if (!aiResponse) {
      console.error("[ResultSummary] No response from OpenAI")
      return Response.json({
        summary: `${resultTitle} contains relevant information about "${selectedQuery}". This result provides valuable context and details for your research on this topic.`
      })
    }

    console.log("[ResultSummary] Generated summary:", aiResponse.slice(0, 80) + "...")

    const apiResponse = Response.json({ summary: aiResponse })

    apiResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    apiResponse.headers.set('Pragma', 'no-cache')
    apiResponse.headers.set('Expires', '0')

    return apiResponse

  } catch (error) {
    console.error("[ResultSummary] Error generating summary:", error)

    return Response.json({
      summary: "This search result provides relevant information for your query. Use arrow keys to navigate through different results and see their contextual summaries."
    })
  }
}