export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { query } = await request.json()
    
    console.log("[AI] Generating suggestions for:", query)
    
    const inceptionKey = 'sk_05911f8f9595f2e2c76c271b83052c92'
    
    if (!inceptionKey) {
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
    
    const inceptionResponse = await fetch('https://api.inceptionlabs.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${inceptionKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mercury',
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
    
    if (!inceptionResponse.ok) {
      console.error("[AI] Inception Labs API error:", inceptionResponse.status)
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
    
    const aiData = await inceptionResponse.json()
    const aiResponse = aiData.choices?.[0]?.message?.content?.trim()
    
    if (!aiResponse) {
      console.error("[AI] No response from Inception Labs")
      return Response.json({ suggestions: ["AI developments", "React tips", "Startup advice", "Open source"] })
    }
    
    // Parse AI response into suggestions array
    const suggestions = aiResponse
      .split('\n')
      .map((s: string) => s.replace(/^\d+\.\s*/, '').trim()) // Remove numbering
      .filter((s: string) => s.length > 0)
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