# Sirch - AI-Powered HackerNews Aggregator

Real-time HackerNews stories with AI-generated summaries, updated every 10 minutes.

🏠 **Repository**: Now hosted under [Sirch-AI-Team](https://github.com/Sirch-AI-Team/Sirch222)

## Features

- 📊 Real-time sync with HackerNews top 100 stories
- 🤖 AI-powered summaries (500 characters) for each story
- 🔄 Automatic refresh every 10 minutes via cron job
- 📱 Clean, minimal interface
- ⚡ Fast loading with Supabase backend

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Backend**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-3.5-turbo for summaries
- **Deployment**: Vercel
- **Data Pipeline**: Python scripts with cron automation

## Architecture

1. **Data Collection**: Python script fetches top 100 HN stories every 10 minutes
2. **AI Summarization**: Automatically generates summaries for new stories
3. **Database**: Supabase stores stories with rankings and summaries
4. **Frontend**: Next.js displays stories with real-time updates

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

## Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Database Schema

```sql
CREATE TABLE hack (
  id bigint PRIMARY KEY,
  title text NOT NULL,
  url text,
  score integer DEFAULT 0,
  by text NOT NULL,
  time integer NOT NULL,
  descendants integer DEFAULT 0,
  type text NOT NULL,
  rank_position integer NOT NULL UNIQUE,
  summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```