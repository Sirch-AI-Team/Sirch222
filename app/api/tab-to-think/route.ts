export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { query } = await request.json()

    console.log("[TabToThink] Generating deep analysis for:", query)

    const openaiKey = process.env.OPENAI_API_KEY

    if (!openaiKey) {
      return Response.json({
        answer: `Deep dive analysis for "${query}" - examining patterns, trends, and insights across multiple sources to provide comprehensive understanding.`
      })
    }

    const prompt = `You are an expert analyst providing a deep dive on "${query}".

Provide a comprehensive, analytical response that goes beyond surface-level information. Focus on:
- Key insights and trends
- Practical implications
- Important considerations or challenges
- Current state and future outlook
- Actionable recommendations

Make this a thoughtful, well-structured analysis in 3-4 sentences that someone deeply researching "${query}" would find valuable.`

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
        max_tokens: 250,
        temperature: 0.6
      })
    })

    if (!openaiResponse.ok) {
      console.error("[TabToThink] OpenAI API error:", openaiResponse.status)
      return Response.json({
        answer: `Deep analysis for "${query}" involves examining current trends, practical applications, and key considerations. This topic requires understanding multiple perspectives and staying current with latest developments.`
      })
    }

    const aiData = await openaiResponse.json()
    const aiResponse = aiData.choices?.[0]?.message?.content?.trim()

    if (!aiResponse) {
      console.error("[TabToThink] No response from OpenAI")
      return Response.json({
        answer: `In-depth analysis of "${query}" requires examining current landscape, key challenges, and emerging opportunities in this domain.`
      })
    }

    console.log("[TabToThink] Generated deep analysis:", aiResponse.slice(0, 100) + "...")

    const apiResponse = Response.json({ answer: aiResponse })

    apiResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    apiResponse.headers.set('Pragma', 'no-cache')
    apiResponse.headers.set('Expires', '0')

    return apiResponse

  } catch (error) {
    console.error("[TabToThink] Error generating deep analysis:", error)

    return Response.json({
      answer: "Deep analysis mode activated. Navigate through search results using arrow keys to see contextual summaries of each result."
    })
  }
}