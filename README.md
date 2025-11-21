# OneMetrik Command Center

A performance marketing dashboard that connects to Google Ads accounts, monitors performance, detects anomalies, and generates AI-powered insights.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **AI**: Claude API (Anthropic)
- **Styling**: Tailwind CSS + shadcn/ui

## Getting Started

### Prerequisites

1. **Node.js**: Version 18 or higher
2. **Supabase Account**: Create a project at [supabase.com](https://supabase.com)
3. **Google Cloud**: OAuth credentials with Google Ads API enabled
4. **Anthropic API Key**: From [console.anthropic.com](https://console.anthropic.com)

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env.local` and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```

3. **Set up Supabase database**:
   - Copy the SQL from `supabase/migrations/001_initial_schema.sql`
   - Run it in your Supabase SQL Editor
   - This creates all necessary tables and Row Level Security policies

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
/app
  /(auth)          - Login and signup pages
  /dashboard       - Main dashboard (protected)
    /accounts/[id] - Single account detail view
    /reports       - Report history
  /api             - API routes
    /auth          - Auth endpoints
    /google-ads    - Google Ads integration
    /reports       - Report generation
    /cron          - Scheduled jobs

/components
  /ui              - shadcn/ui components
  /dashboard       - Dashboard-specific components
  /charts          - Chart components

/lib
  /supabase        - Supabase client setup
  /google-ads      - Google Ads API wrapper (to be implemented)
  anomaly-detection.ts
  ai-insights.ts
  report-generator.ts
  email.ts

/types             - TypeScript type definitions
/supabase          - Database migrations
```

## Features Checklist

### Phase 1 (Current)
- [x] Project initialization
- [x] Authentication (login/signup)
- [x] Protected dashboard routes
- [x] Database schema with RLS
- [ ] Google Ads OAuth connection
- [ ] Data ingestion
- [ ] Dashboard UI with real data
- [ ] Anomaly detection
- [ ] AI-powered insights
- [ ] Report generation
- [ ] Cron jobs
- [ ] Email alerts

## Development Status

See [PLAN.md](./PLAN.md) for detailed implementation roadmap and architecture decisions.

## Required Credentials

To complete the setup, you'll need:

1. **Supabase**:
   - Project URL
   - Anon Key
   - Service Role Key (for admin operations)

2. **Google Cloud**:
   - OAuth Client ID
   - OAuth Client Secret
   - Google Ads Developer Token
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback`

3. **Anthropic**:
   - API Key

4. **Resend** (for email alerts):
   - API Key

## Deployment

Deploy to Vercel:

```bash
npm run build
vercel deploy
```

Set environment variables in Vercel dashboard before deploying to production.
