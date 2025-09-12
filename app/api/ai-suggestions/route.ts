export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { query } = await request.json()
    
    console.log("[AI] Generating suggestions for:", query)
    
    const openaiKey = process.env.OPENAI_API_KEY
    
    if (!openaiKey) {
      // Fallback to static suggestions if no OpenAI key
      const fallbackSuggestions = [
        "AI developments 2024",
        "React best practices", 
        "Startup funding news",
        "Open source projects",
        "Tech industry trends",
        "Web development tools",
        "Machine learning basics",
        "Software engineering tips"
      ]
      
      return Response.json({ suggestions: fallbackSuggestions })
    }
    
    // Generate AI suggestions based on user query
    const prompt = query.trim() 
      ? `Based on the search query "${query}", generate 8 relevant, specific search suggestions for finding articles, tutorials, or discussions. Make each suggestion 2-5 words, focused on actionable topics someone might want to research. Return only the suggestions, one per line.`
      : `Generate 8 popular tech and startup search suggestions that would be interesting to research. Make each suggestion 2-5 words, focused on current trends and actionable topics. Return only the suggestions, one per line.`
    
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
        temperature: 0.7
      })
    })
    
    if (!openaiResponse.ok) {
      console.error("[AI] OpenAI API error:", openaiResponse.status)
      // Fallback to contextual static suggestions
      const contextualSuggestions = query.trim() 
        ? [
            `${query} best practices`,
            `${query} tutorial`,
            `${query} vs alternatives`, 
            `${query} getting started`,
            `${query} advanced tips`,
            `${query} use cases`,
            `${query} examples`,
            `${query} troubleshooting`
          ]
        : [
            "AI developments 2024",
            "React best practices",
            "Startup funding news", 
            "Open source projects"
          ]
      
      return Response.json({ suggestions: contextualSuggestions })
    }
    
    const aiData = await openaiResponse.json()
    const aiResponse = aiData.choices?.[0]?.message?.content?.trim()
    
    if (!aiResponse) {
      console.error("[AI] No response from OpenAI")
      return Response.json({ suggestions: ["AI developments", "React tips", "Startup advice", "Open source"] })
    }
    
    // Parse AI response into suggestions array
    const suggestions = aiResponse
      .split('\n')
      .map(s => s.replace(/^\d+\.\s*/, '').trim()) // Remove numbering
      .filter(s => s.length > 0)
      .slice(0, 8) // Limit to 8 suggestions
    
    console.log("[AI] Generated suggestions:", suggestions)
    
    const apiResponse = Response.json({ suggestions })
    
    // Add cache busting headers
    apiResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    apiResponse.headers.set('Pragma', 'no-cache')
    apiResponse.headers.set('Expires', '0')
    
    return apiResponse
    
  } catch (error) {
    console.error("[AI] Error generating suggestions:", error)
    
    // Final fallback
    return Response.json({ 
      suggestions: [
        "AI developments", 
        "React best practices",
        "Startup funding",
        "Open source projects"
      ]
    })
  }
}