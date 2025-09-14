import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  console.log("[Edge Function] Starting HackerNews stories refresh...");
  
  try {
    // Fetch top 100 stories from HackerNews
    const topStoriesResponse = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!topStoriesResponse.ok) {
      throw new Error(`Failed to fetch top stories: ${topStoriesResponse.status}`);
    }
    
    const allTopStories = await topStoriesResponse.json();
    const top100Stories = allTopStories.slice(0, 100);
    
    console.log(`[Edge Function] Fetched ${top100Stories.length} top story IDs`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://liobdrwdjkznvqigglxw.supabase.co';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpb2Jkcndkamt6bnZxaWdnbHh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzU1NjA3NSwiZXhwIjoyMDczMTMyMDc1fQ.jR1K1mUt-w2sCWYW1J5xnE-VmKjlHrsRWV9G1ThqcoM';
    
    // Get existing stories from database
    const existingStoriesResponse = await fetch(
      `${supabaseUrl}/rest/v1/hack?select=id`,
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const existingStories = await existingStoriesResponse.json();
    const existingIds = new Set(existingStories.map((story: any) => story.id));
    
    // Calculate changes
    const currentTopSet = new Set(top100Stories);
    const storiesToRemove = [...existingIds].filter(id => !currentTopSet.has(id));
    const storiesToAdd = top100Stories.filter(id => !existingIds.has(id));
    const storiesToUpdate = top100Stories.filter(id => existingIds.has(id));
    
    console.log(`[Edge Function] Remove: ${storiesToRemove.length}, Add: ${storiesToAdd.length}, Update: ${storiesToUpdate.length}`);
    
    // Remove old stories
    if (storiesToRemove.length > 0) {
      const deleteResponse = await fetch(
        `${supabaseUrl}/rest/v1/hack?id=in.(${storiesToRemove.join(',')})`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (deleteResponse.ok) {
        console.log(`[Edge Function] ✓ Removed ${storiesToRemove.length} old stories`);
      }
    }
    
    // Add new stories and generate summaries
    let addedCount = 0;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    
    for (const storyId of storiesToAdd) {
      try {
        // Fetch story details
        const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
        const story = await storyResponse.json();
        
        if (story && story.type === 'story' && story.title) {
          const rankPosition = top100Stories.indexOf(storyId) + 1;
          
          // Insert story into database
          const insertResponse = await fetch(
            `${supabaseUrl}/rest/v1/hack`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                id: story.id,
                title: story.title,
                url: story.url || null,
                score: story.score || 0,
                by: story.by || '',
                time: story.time || 0,
                descendants: story.descendants || 0,
                type: story.type,
                rank_position: rankPosition
              })
            }
          );
          
          if (insertResponse.ok) {
            addedCount++;
            console.log(`[Edge Function] ✓ Added story ${storyId}`);
            
            // Generate summary if story has URL and we have OpenAI key
            if (story.url && openaiKey) {
              try {
                const summary = await generateSummary(story.url, openaiKey);
                if (summary) {
                  // Update story with summary
                  await fetch(
                    `${supabaseUrl}/rest/v1/hack?id=eq.${storyId}`,
                    {
                      method: 'PATCH',
                      headers: {
                        'apikey': supabaseServiceKey,
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ summary })
                    }
                  );
                  console.log(`[Edge Function] ✓ Generated summary for story ${storyId}`);
                }
              } catch (summaryError) {
                console.log(`[Edge Function] ⚠ Summary generation failed for story ${storyId}: ${summaryError}`);
              }
            }
          }
        }
      } catch (storyError) {
        console.log(`[Edge Function] Error adding story ${storyId}: ${storyError}`);
      }
    }
    
    // Update ranks and scores for existing stories
    let updatedCount = 0;
    for (let i = 0; i < top100Stories.length; i++) {
      const storyId = top100Stories[i];
      const rankPosition = i + 1;
      
      try {
        // Fetch updated story data
        const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
        const story = await storyResponse.json();
        
        if (story) {
          const updateResponse = await fetch(
            `${supabaseUrl}/rest/v1/hack?id=eq.${storyId}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                rank_position: rankPosition,
                score: story.score || 0
              })
            }
          );
          
          if (updateResponse.ok) {
            updatedCount++;
          }
        }
      } catch (updateError) {
        console.log(`[Edge Function] Error updating story ${storyId}: ${updateError}`);
      }
    }
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      removedOldStories: storiesToRemove.length,
      addedNewStories: addedCount,
      updatedRanks: updatedCount,
      totalStoriesInDb: top100Stories.length
    };
    
    console.log(`[Edge Function] ✓ Refresh completed: ${JSON.stringify(result)}`);
    
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      }
    });
    
  } catch (error) {
    console.error(`[Edge Function] ✗ Error: ${error}`);
    return new Response(
      JSON.stringify({ success: false, error: error.message }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

async function generateSummary(url: string, openaiKey: string): Promise<string | null> {
  try {
    // Fetch webpage content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HackNewsBot/1.0)'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      return null;
    }
    
    let text = await response.text();
    
    // Simple HTML tag removal and text extraction
    text = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit content for API
    const content = text.slice(0, 8000);
    
    if (content.length < 100) {
      return null;
    }
    
    // Generate summary using OpenAI
    const openaiResponse = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
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
              content: `Please provide a 300-character summary of the following content. Make sure that the summary is complete and in full sentences:\n\n${content}`
            }
          ],
          max_tokens: 200,
          temperature: 0.3
        })
      }
    );
    
    if (!openaiResponse.ok) {
      return null;
    }
    
    const openaiData = await openaiResponse.json();
    const summary = openaiData?.choices?.[0]?.message?.content?.trim();
    
    if (!summary) {
      return null;
    }
    
    // Ensure summary is within 300 characters
    return summary.length > 300 ? summary.slice(0, 297) + '...' : summary;
    
  } catch (error) {
    console.log(`Summary generation error: ${error}`);
    return null;
  }
}