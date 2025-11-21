# Database Setup Instructions

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in details:
   - **Name**: onemetrik-command-center
   - **Database Password**: (create a strong password)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is sufficient to start

## Step 2: Run Database Migration

1. Once your project is created, go to the **SQL Editor**
2. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
3. Paste it into the SQL Editor
4. Click **RUN** to execute the migration

This will create:
- `ad_accounts` table
- `daily_metrics` table
- `anomalies` table
- `reports` table
- Row Level Security (RLS) policies
- Indexes for performance
- Helper functions

## Step 3: Get API Credentials

1. Go to **Project Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., https://xxxxx.supabase.co)
   - **anon/public key** (starts with eyJhbG...)
   - **service_role key** (starts with eyJhbG...) - KEEP THIS SECRET!

3. Add these to your `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

## Step 4: Verify Setup

Run this query in the SQL Editor to verify everything is set up:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

You should see all 4 tables with RLS enabled.

## Step 5: Test Authentication

1. Start your dev server: `npm run dev`
2. Go to `http://localhost:3000/signup`
3. Create a test account
4. You should be redirected to the dashboard

## Step 6: Optional - Disable Email Confirmation

By default, Supabase requires email confirmation for new signups. For development, you can disable this:

1. Go to **Authentication** → **Providers** → **Email**
2. Toggle OFF "Confirm email"
3. Click **Save**

For production, keep email confirmation enabled for security.

## Step 7: Get Service Role Key (Required for Cron Jobs)

The service role key is needed for:
- Cron jobs to access all accounts
- Anomaly detection across users
- AI explanation generation

**IMPORTANT:** Never expose the service role key to the client. Only use it in server-side code.

## Troubleshooting

### "No rows returned" when querying tables
- Check that RLS policies are correctly set up
- Make sure you're authenticated when testing from the app

### "Permission denied" errors
- Verify RLS policies exist: `SELECT * FROM pg_policies WHERE schemaname = 'public';`
- Check that the user is authenticated: `SELECT auth.uid();`

### Slow queries
- Run `EXPLAIN ANALYZE` on your queries
- Check that indexes exist on frequently queried columns
- Consider adding indexes if needed

## Next Steps

After completing database setup:
1. Configure Google Cloud OAuth credentials
2. Get Claude/Gemini API key
3. Set up Resend for email alerts
4. Deploy to Vercel

See `README.md` for the full setup guide.
