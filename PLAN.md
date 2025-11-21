# OneMetrik Command Center - Implementation Plan

## Executive Summary
Building a Google Ads monitoring dashboard that automatically detects performance issues and explains them using AI. You'll log in, connect your accounts, and get daily automated reports with anomaly alerts.

---

## Architecture Decisions

### 1. **Application Framework: Next.js 14 (App Router)**
- **Why**: Server components reduce client-side JS, API routes built-in, edge-ready
- **Structure**: App router for cleaner routing, server actions for mutations
- **Deployment**: Vercel for zero-config deployment with automatic preview environments

### 2. **Database: Supabase (PostgreSQL)**
- **Why**: Managed Postgres with built-in auth, real-time subscriptions, row-level security
- **Data access**: Direct PostgREST API + TypeScript client for type safety
- **Migrations**: Use Supabase CLI for version-controlled schema changes

### 3. **Authentication Strategy**
- **Primary**: Supabase Auth (email/password)
- **Session handling**: Server-side cookies (secure, httpOnly)
- **Protected routes**: Middleware-based auth checks
- **Future-ready**: Can add Google SSO later without refactoring

### 4. **Google Ads Integration**
- **OAuth 2.0**: Server-side flow (more secure than client-side)
- **Token storage**: Encrypted refresh tokens in Supabase (using pgcrypto)
- **API client**: Official `google-ads-api` npm package
- **Rate limiting**: Built-in queue system to respect API limits

### 5. **Anomaly Detection Algorithm**
**Logic**:
```
for each metric in [spend, conversions, ctr, cpc]:
  baseline = same_day_last_week_value
  current = today_value
  percent_change = ((current - baseline) / baseline) * 100

  if abs(percent_change) > threshold:
    severity = WARNING if change < 50% else CRITICAL
    generate_ai_explanation(metric, baseline, current, context)
```

**Why week-over-week**: Accounts for day-of-week patterns (Mondays vs Fridays behave differently)

### 6. **AI Insights: Claude 3.5 Sonnet**
- **API**: Direct Anthropic API calls (not streaming for simplicity)
- **Prompt engineering**: Structured prompts with metric context + campaign data
- **Cost optimization**: Only call AI when anomaly detected (not for every data point)
- **Caching**: Store explanations in database to avoid re-generating

### 7. **Report Generation**
**Approach**: React component → HTML → PDF
- **Library**: `@react-pdf/renderer` for programmatic PDF generation
- **Alternative**: Puppeteer for pixel-perfect rendering (heavier, but better design control)
- **Decision**: Start with react-pdf, switch to Puppeteer if design requirements increase
- **Storage**: Store reports in Supabase Storage, link in database

### 8. **Cron Jobs (Vercel)**
```
/api/cron/daily-sync → runs at 3 AM IST
  1. Fetch all accounts with active refresh tokens
  2. For each account:
     - Pull yesterday's data from Google Ads API
     - Store in daily_metrics table
     - Run anomaly detection
     - If critical anomaly → trigger email alert
```

### 9. **Email System**
- **Provider**: Resend (10k free emails/month, better deliverability than SendGrid free tier)
- **Templates**: React Email components (same stack as reports)
- **Trigger**: Supabase database webhook or direct call from cron job

---

## Database Schema

### `users` (Managed by Supabase Auth)
```sql
-- Auto-created by Supabase
id UUID PRIMARY KEY
email TEXT UNIQUE
encrypted_password TEXT
created_at TIMESTAMPTZ
```

### `ad_accounts`
```sql
CREATE TABLE ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'google_ads',
  account_name TEXT NOT NULL,
  customer_id TEXT NOT NULL, -- Google Ads customer ID (123-456-7890)
  refresh_token TEXT, -- Encrypted
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own accounts" ON ad_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON ad_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON ad_accounts FOR UPDATE USING (auth.uid() = user_id);
```

### `daily_metrics`
```sql
CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  metrics JSONB NOT NULL, -- {spend, impressions, clicks, conversions, conversion_value, ctr, cpc, cost_per_conversion}
  device_data JSONB, -- {mobile: {...}, desktop: {...}, tablet: {...}}
  top_keywords JSONB, -- [{keyword, spend, clicks}, ...] top 50
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, date, campaign_id)
);

CREATE INDEX idx_daily_metrics_account_date ON daily_metrics(account_id, date DESC);

-- RLS Policies
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own metrics" ON daily_metrics FOR SELECT
  USING (account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()));
```

### `anomalies`
```sql
CREATE TABLE anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  metric TEXT NOT NULL, -- 'spend', 'conversions', 'ctr', 'cpc'
  expected_value NUMERIC NOT NULL,
  actual_value NUMERIC NOT NULL,
  percent_change NUMERIC NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('WARNING', 'CRITICAL')),
  ai_explanation TEXT,
  context_data JSONB, -- Device breakdown, campaign data used for AI context
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_anomalies_account_date ON anomalies(account_id, date DESC);

-- RLS Policies
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own anomalies" ON anomalies FOR SELECT
  USING (account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()));
```

### `reports`
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  report_type TEXT DEFAULT 'performance_summary',
  file_url TEXT, -- Supabase Storage URL
  generated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reports" ON reports FOR SELECT
  USING (account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()));
```

---

## File Structure

```
internal-dashboard/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── signup/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx (protected layout with nav)
│   │   ├── page.tsx (all accounts overview)
│   │   ├── accounts/
│   │   │   └── [id]/
│   │   │       └── page.tsx (single account detail)
│   │   └── reports/
│   │       └── page.tsx (report history)
│   ├── api/
│   │   ├── auth/
│   │   │   ├── callback/route.ts (OAuth callback)
│   │   │   └── signout/route.ts
│   │   ├── google-ads/
│   │   │   ├── connect/route.ts (initiate OAuth)
│   │   │   ├── fetch-data/route.ts (manual refresh)
│   │   │   └── disconnect/route.ts
│   │   ├── reports/
│   │   │   └── generate/route.ts
│   │   └── cron/
│   │       └── daily-sync/route.ts (Vercel cron)
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/ (shadcn components)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── chart.tsx
│   │   └── ... (other shadcn components)
│   ├── dashboard/
│   │   ├── account-card.tsx
│   │   ├── anomaly-alert.tsx
│   │   ├── metrics-table.tsx
│   │   └── trend-arrow.tsx
│   └── charts/
│       ├── spend-chart.tsx
│       └── comparison-chart.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts (browser client)
│   │   ├── server.ts (server client)
│   │   └── middleware.ts (auth middleware)
│   ├── google-ads/
│   │   ├── client.ts (API wrapper)
│   │   ├── oauth.ts (OAuth flow)
│   │   └── queries.ts (pre-built GAQL queries)
│   ├── anomaly-detection.ts
│   ├── ai-insights.ts (Claude API)
│   ├── report-generator.ts
│   └── email.ts (Resend integration)
├── types/
│   ├── database.ts (Supabase generated types)
│   ├── google-ads.ts
│   └── index.ts
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── .env.local (gitignored)
└── package.json
```

---

## Implementation Phases

### Phase 1: Foundation (Days 1-2)
- [x] Initialize Next.js 14 project with TypeScript
- [x] Install dependencies: Supabase, shadcn/ui, Tailwind
- [x] Set up Supabase project and connection
- [x] Create database schema with migrations
- [x] Build authentication (login/signup pages)
- [x] Protected route middleware

### Phase 2: Google Ads Integration (Days 3-4)
- [ ] Set up Google Cloud project OAuth credentials
- [ ] Build OAuth flow (connect account button → Google consent → callback → store tokens)
- [ ] Test connection with your Google Ads account
- [ ] Build data fetching service (GAQL queries for campaign metrics)
- [ ] Manual "Refresh Now" functionality

### Phase 3: Dashboard UI (Days 5-6)
- [ ] All accounts overview page
  - [ ] Account cards with 7-day summary
  - [ ] Trend indicators (up/down arrows)
  - [ ] Red highlight for anomalies
- [ ] Single account detail page
  - [ ] Date range selector
  - [ ] Line charts (Recharts library)
  - [ ] Campaign performance table
  - [ ] Anomaly alerts section

### Phase 4: Intelligence Layer (Days 7-8)
- [ ] Anomaly detection algorithm
- [ ] Claude API integration for explanations
- [ ] Test with historical data (simulate anomalies)
- [ ] Refine AI prompts based on output quality

### Phase 5: Reporting & Automation (Days 9-10)
- [ ] PDF report generation
- [ ] Vercel cron job setup (daily sync at 3 AM IST)
- [ ] Email alert system with Resend
- [ ] End-to-end testing

### Phase 6: Polish & Deploy (Day 11)
- [ ] Error handling and loading states
- [ ] Mobile responsive design
- [ ] Deploy to Vercel production
- [ ] Set up environment variables in Vercel dashboard

---

## Security Considerations

### 1. **Token Encryption**
```sql
-- Use pgcrypto for refresh token encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt before storing
UPDATE ad_accounts
SET refresh_token = pgp_sym_encrypt('token_value', current_setting('app.encryption_key'));

-- Decrypt when fetching
SELECT pgp_sym_decrypt(refresh_token::bytea, current_setting('app.encryption_key'))
FROM ad_accounts;
```

### 2. **Row-Level Security (RLS)**
- Users can only see their own accounts, metrics, anomalies, reports
- Enforced at database level (can't bypass even with direct Supabase API access)

### 3. **API Route Protection**
```typescript
// All API routes check authentication
const supabase = createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

### 4. **Environment Variables**
```env
# .env.local (never commit)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY= # For admin operations only
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
ENCRYPTION_KEY= # For token encryption
CRON_SECRET= # To protect cron endpoint
```

### 5. **Cron Job Protection**
```typescript
// Only Vercel cron can call this
if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## What I Need From You

### Required Immediately:
1. **Supabase Project**
   - Create a new project at supabase.com
   - Provide: `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   - (I'll guide you through creating the database tables)

2. **Google Cloud Credentials**
   - Create OAuth 2.0 credentials in Google Cloud Console
   - Enable Google Ads API
   - Provide: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - Add authorized redirect URI: `http://localhost:3000/api/auth/callback` (dev)

3. **Claude API Key**
   - From console.anthropic.com
   - Provide: `ANTHROPIC_API_KEY`

### Required Before Production:
4. **Resend API Key** (for email alerts)
   - Sign up at resend.com
   - Verify your domain (or use their test domain)
   - Provide: `RESEND_API_KEY`

5. **Vercel Deployment Approval**
   - When ready to deploy, I'll push to GitHub
   - You'll connect the repo to Vercel
   - I'll configure environment variables in Vercel dashboard

### For Testing:
6. **Your Google Ads Customer ID**
   - Format: `123-456-7890`
   - I'll use this to test data fetching

---

## Cost Estimates (Monthly)

| Service | Free Tier | Expected Usage | Cost |
|---------|-----------|----------------|------|
| Vercel | Unlimited | Hosting + Cron | $0 |
| Supabase | 500MB DB, 1GB storage | <100MB DB, <1GB files | $0 |
| Google Ads API | Free | 500 accounts × 1 call/day | $0 |
| Claude API | No free tier | ~50 anomalies/day × $0.003 | ~$5 |
| Resend | 3,000 emails/month | ~50 alerts/month | $0 |
| **Total** | | | **~$5/month** |

---

## Success Metrics

### Week 1 (MVP):
- ✅ You can log in
- ✅ Connect 1 Google Ads account
- ✅ See last 30 days of spend/conversions
- ✅ See 1 anomaly with AI explanation

### Week 2 (Production-Ready):
- ✅ Daily automated sync running
- ✅ Email alerts working
- ✅ Generate PDF report
- ✅ Connect multiple accounts
- ✅ Mobile-responsive dashboard

---

## Risk Mitigation

### Risk: Google Ads API rate limits
**Solution**: Implement queue with exponential backoff, process accounts sequentially

### Risk: Claude API costs spike
**Solution**: Set monthly budget alert at $20, cache explanations, only call for new anomalies

### Risk: Data sync failures
**Solution**: Log all errors to Supabase, create admin dashboard to see failed syncs, retry logic

### Risk: Token expiration
**Solution**: Refresh tokens automatically before API calls, notify user if refresh fails

---

## Next Steps

1. ✅ **You approve this plan**
2. ✅ **You provide credentials listed above**
3. ✅ **I start building** (will report progress every 2 days with CEO summaries)

---

**Questions or changes to the plan?** Let me know now before I start building.

Otherwise, please provide the credentials and I'll begin implementation immediately.
