export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { query } = await request.json()
    
    console.log("[PopBox] Generating answer for:", query)
    
    const openaiKey = process.env.OPENAI_API_KEY
    
    if (!openaiKey) {
      // Fallback to informational text if no OpenAI key
      return Response.json({ 
        answer: `Search for "${query}" across multiple sources to find the latest articles, discussions, and insights on this topic.` 
      })
    }
    
    // Generate AI answer about the search query
    const prompt = `Provide a brief, informative answer about "${query}". The answer should be 2-3 sentences, completely self-contained without pronouns (avoid "it", "this", "they", etc.), and understandable without seeing the original query. Focus on explaining what ${query} is, why ${query} matters, or what someone would find when researching ${query}.`
    
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
        temperature: 0.4
      })
    })
    
    if (!openaiResponse.ok) {
      console.error("[PopBox] OpenAI API error:", openaiResponse.status)
      // Fallback to generic informational text
      return Response.json({ 
        answer: `Search for "${query}" across multiple sources to find the latest articles, discussions, and insights on this topic.` 
      })
    }
    
    const aiData = await openaiResponse.json()
    const aiResponse = aiData.choices?.[0]?.message?.content?.trim()
    
    if (!aiResponse) {
      console.error("[PopBox] No response from OpenAI")
      return Response.json({ 
        answer: `Search for "${query}" to discover relevant articles, tutorials, and discussions about this topic.` 
      })
    }
    
    console.log("[PopBox] Generated answer:", aiResponse.slice(0, 100) + "...")
    
    const apiResponse = Response.json({ answer: aiResponse })
    
    // Add cache busting headers
    apiResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    apiResponse.headers.set('Pragma', 'no-cache')
    apiResponse.headers.set('Expires', '0')
    
    return apiResponse
    
  } catch (error) {
    console.error("[PopBox] Error generating answer:", error)
    
    // Final fallback
    return Response.json({ 
      answer: "Navigate through suggestions to see detailed information about each search query. Use arrow keys or hover to explore different options."
    })
  }
}