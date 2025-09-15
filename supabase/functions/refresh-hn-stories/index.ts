import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    console.log('🚀 Starting HackerNews refresh...');

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch current top 100 from HackerNews
    console.log('📡 Fetching top 100 stories from HackerNews...');
    const topStoriesResponse = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!topStoriesResponse.ok) {
      throw new Error(`Failed to fetch top stories: ${topStoriesResponse.status}`);
    }

    const allTopStoryIds = await topStoriesResponse.json();
    const top100Ids = allTopStoryIds.slice(0, 100);
    console.log(`✓ Got top 100 story IDs from HackerNews`);

    // 2. Get existing stories (to preserve summaries)
    const { data: existingStories } = await supabase
      .from('hack')
      .select('id, summary');

    const existingSummaries = new Map();
    if (existingStories) {
      existingStories.forEach(story => {
        if (story.summary) {
          existingSummaries.set(story.id, story.summary);
        }
      });
    }
    console.log(`💾 Found ${existingSummaries.size} existing summaries to preserve`);

    // 3. Clear existing data (we'll rebuild from scratch)
    console.log('🧹 Clearing existing stories...');
    await supabase.from('hack').delete().neq('id', 0); // Delete all

    // 4. Fetch and insert all top 100 stories with correct ranks
    console.log('📚 Fetching and inserting top 100 stories...');
    const storiesToInsert = [];

    for (let i = 0; i < top100Ids.length; i++) {
      const storyId = top100Ids[i];
      const rank = i + 1;

      try {
        // Fetch story details from HackerNews
        const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
        if (!storyResponse.ok) continue;

        const story = await storyResponse.json();
        if (!story || story.type !== 'story' || !story.title) continue;

        // Prepare story data
        const storyData = {
          id: story.id,
          title: story.title,
          url: story.url || null,
          score: story.score || 0,
          by: story.by || '',
          time: story.time || 0,
          descendants: story.descendants || 0,
          type: story.type,
          rank_position: rank,
          summary: existingSummaries.get(story.id) || null, // Preserve existing summary
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        storiesToInsert.push(storyData);

        if (rank <= 5) {
          console.log(`  ${rank}. ${story.title} (${story.score} points)`);
        }

        // Small delay to be respectful to HN API
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        console.error(`❌ Error fetching story ${storyId}:`, error.message);
      }
    }

    // 5. Insert all stories in batch
    console.log(`💽 Inserting ${storiesToInsert.length} stories...`);
    const { data: insertedStories, error: insertError } = await supabase
      .from('hack')
      .insert(storiesToInsert)
      .select('id, title, rank_position');

    if (insertError) {
      throw new Error(`Insert error: ${insertError.message}`);
    }

    // 6. Summary of what happened
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      totalStoriesInserted: storiesToInsert.length,
      preservedSummaries: existingSummaries.size,
      topStory: storiesToInsert[0]?.title || 'Unknown',
      topStoryScore: storiesToInsert[0]?.score || 0
    };

    console.log('✅ HackerNews refresh completed successfully!');
    console.log(`📊 Results: ${result.totalStoriesInserted} stories, ${result.preservedSummaries} summaries preserved`);
    console.log(`🏆 Current #1: "${result.topStory}" (${result.topStoryScore} points)`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 HackerNews refresh failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});