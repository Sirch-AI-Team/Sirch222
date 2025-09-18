import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    console.log('Starting HackerNews refresh (FIXED VERSION)...');

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch top 100 stories from HackerNews API
    console.log('Fetching top stories from HackerNews API...');
    const topStoriesResponse = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!topStoriesResponse.ok) {
      throw new Error(`Failed to fetch top stories: ${topStoriesResponse.status}`);
    }

    const topStoryIds = await topStoriesResponse.json();
    const top100Ids = topStoryIds.slice(0, 100);
    console.log(`Got ${top100Ids.length} story IDs from HN`);

    // Get ALL existing stories from database
    const { data: allExistingStories, error: fetchAllError } = await supabase
      .from('hack')
      .select('id, summary, rank_position');

    if (fetchAllError) {
      throw new Error(`Database fetch error: ${fetchAllError.message}`);
    }

    const allExistingIds = new Set(allExistingStories?.map(s => s.id) || []);
    const existingSummaries = new Map(allExistingStories?.map(s => [s.id, s.summary]) || []);

    // Stories that are in current top 100
    const currentTop100Set = new Set(top100Ids);

    // Stories that need to be removed (existing but not in current top 100)
    const storiesToRemove = Array.from(allExistingIds).filter(id => !currentTop100Set.has(id));

    // Stories that need to be added (in current top 100 but not existing)
    const storiesToAdd = top100Ids.filter(id => !allExistingIds.has(id));

    // Stories that need rank updates (in both current top 100 and existing)
    const storiesToUpdate = top100Ids.filter(id => allExistingIds.has(id));

    console.log(`Stories to remove: ${storiesToRemove.length}`);
    console.log(`Stories to add: ${storiesToAdd.length}`);
    console.log(`Stories to update ranks: ${storiesToUpdate.length}`);

    const errorDetails: string[] = [];

    // Step 1: Remove old stories that are no longer in top 100
    let removedCount = 0;
    if (storiesToRemove.length > 0) {
      console.log('Removing old stories...');
      const { error: deleteError } = await supabase
        .from('hack')
        .delete()
        .in('id', storiesToRemove);

      if (deleteError) {
        const errorMsg = `Error removing old stories: ${deleteError.message}`;
        console.error(errorMsg);
        errorDetails.push(errorMsg);
      } else {
        removedCount = storiesToRemove.length;
        console.log(`✓ Removed ${removedCount} old stories`);
      }
    }

    // Step 2: **CRITICAL FIX** - Clear rank positions first to avoid conflicts
    if (storiesToUpdate.length > 0) {
      console.log('Temporarily clearing rank positions to avoid conflicts...');
      const { error: clearRanksError } = await supabase
        .from('hack')
        .update({ rank_position: -1 })  // Use negative value as temporary
        .in('id', storiesToUpdate);

      if (clearRanksError) {
        const errorMsg = `Error clearing ranks: ${clearRanksError.message}`;
        console.error(errorMsg);
        errorDetails.push(errorMsg);
      } else {
        console.log('✓ Cleared rank positions for existing stories');
      }
    }

    // Step 3: Add new stories
    let addedCount = 0;
    if (storiesToAdd.length > 0) {
      console.log('Adding new stories...');
      const batchSize = 10;

      for (let i = 0; i < storiesToAdd.length; i += batchSize) {
        const batch = storiesToAdd.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: stories ${i + 1}-${Math.min(i + batchSize, storiesToAdd.length)}`);

        for (const storyId of batch) {
          try {
            console.log(`Fetching story ${storyId}...`);
            const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SupabaseBot/1.0)' }
            });

            if (!storyResponse.ok) {
              const errorMsg = `HTTP ${storyResponse.status} for story ${storyId}`;
              console.error(errorMsg);
              errorDetails.push(errorMsg);
              continue;
            }

            const storyData = await storyResponse.json();
            if (!storyData) {
              console.log(`Story ${storyId} was deleted or doesn't exist`);
              continue;
            }

            if (storyData.type === 'story' && storyData.title) {
              const { error: insertError } = await supabase
                .from('hack')
                .insert({
                  id: storyData.id,
                  title: storyData.title || '',
                  url: storyData.url || null,
                  score: storyData.score || 0,
                  by: storyData.by || '',
                  time: storyData.time || 0,
                  descendants: storyData.descendants || 0,
                  type: storyData.type,
                  rank_position: top100Ids.indexOf(storyData.id) + 1,
                  summary: null // Will be filled by summarization
                });

              if (insertError) {
                const errorMsg = `Insert error for story ${storyId}: ${insertError.message}`;
                console.error(errorMsg);
                errorDetails.push(errorMsg);
              } else {
                addedCount++;
                console.log(`✓ Inserted story ${storyId}: "${storyData.title}"`);
              }
            } else {
              const skipReason = !storyData.type ? 'no type' :
                               storyData.type !== 'story' ? `type is ${storyData.type}` : 'no title';
              console.log(`Skipped story ${storyId} - ${skipReason}`);
            }
          } catch (error) {
            const errorMsg = `Processing error for story ${storyId}: ${error.message}`;
            console.error(errorMsg);
            errorDetails.push(errorMsg);
          }

          // Delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Longer delay between batches
        if (i + batchSize < storiesToAdd.length) {
          console.log('Pausing between batches...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // Step 4: Update rank positions and scores for existing stories
    console.log('Updating rank positions for existing stories...');
    let rankUpdates = 0;
    let rankUpdateErrors = 0;

    for (let i = 0; i < top100Ids.length; i++) {
      const storyId = top100Ids[i];
      const newRank = i + 1;

      if (allExistingIds.has(storyId)) {
        try {
          // Fetch current score from HN API for existing stories
          const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
          if (storyResponse.ok) {
            const storyData = await storyResponse.json();
            const { error: updateError } = await supabase
              .from('hack')
              .update({
                rank_position: newRank,
                score: storyData?.score || 0
              })
              .eq('id', storyId);

            if (updateError) {
              const errorMsg = `Failed to update rank for story ${storyId}: ${updateError.message}`;
              console.error(errorMsg);
              errorDetails.push(errorMsg);
              rankUpdateErrors++;
            } else {
              rankUpdates++;
              console.log(`✓ Updated rank ${newRank} for story ${storyId}`);
            }
          } else {
            const errorMsg = `Failed to fetch story ${storyId} for rank update: HTTP ${storyResponse.status}`;
            console.error(errorMsg);
            errorDetails.push(errorMsg);
            rankUpdateErrors++;
          }
        } catch (error) {
          const errorMsg = `Error updating story ${storyId}: ${error.message}`;
          console.error(errorMsg);
          errorDetails.push(errorMsg);
          rankUpdateErrors++;
        }

        // Small delay between updates
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Final verification - ensure we have exactly 100 stories
    const { data: finalStories, error: finalCountError } = await supabase
      .from('hack')
      .select('count', { count: 'exact' });

    const finalCount = finalCountError ? 'unknown' : finalStories?.[0]?.count || 0;

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      removedOldStories: removedCount,
      addedNewStories: addedCount,
      updatedRanks: rankUpdates,
      rankUpdateErrors: rankUpdateErrors,
      totalErrors: errorDetails.length,
      totalStoriesInDb: finalCount,
      errorSample: errorDetails.slice(0, 5)
    };

    console.log('HackerNews refresh completed:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('HackerNews refresh error:', error);
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