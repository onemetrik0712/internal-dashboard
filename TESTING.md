# Local Testing Guide

## Prerequisites

- Node.js 18+ installed
- Git installed
- Supabase account set up (database migrated)
- Google Ads account with access

---

## Step 1: Clone the Repository

```bash
# Clone the repo
git clone https://github.com/onemetrik0712/internal-dashboard.git

# Navigate to the project
cd internal-dashboard

# Checkout the correct branch
git checkout claude/build-onemetrik-command-center-013KCWn8XpTJCSMpARpKJqwq
```

---

## Step 2: Install Dependencies

```bash
# Install all packages (this may take 2-3 minutes)
npm install
```

**Expected output**: You should see "added 667 packages" (or similar)

---

## Step 3: Configure Environment Variables

### Get Supabase Service Role Key

**IMPORTANT:** You need the service role key from Supabase.

1. Go to [supabase.com](https://supabase.com/dashboard)
2. Select your project: `onemetrik-command-center`
3. Go to **Settings** → **API**
4. Scroll down to **Project API keys**
5. Copy the **service_role** key (starts with `eyJhbG...`)

### Update .env.local

The file `.env.local` is already created with your credentials. You just need to add the service role key:

```bash
# Open the file
nano .env.local  # or use your preferred editor

# Find this line:
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Replace with your actual key:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Save and exit (Ctrl+X, then Y, then Enter)
```

### Verify All Credentials

Check that `.env.local` has:
- ✅ Supabase URL and keys (all 3)
- ✅ Google Client ID and Secret
- ✅ Google Developer Token
- ✅ Gemini API Key
- ✅ AI_PROVIDER=gemini

---

## Step 4: Set Up Database

### Run the Migration

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the **entire** contents of `supabase/migrations/001_initial_schema.sql`
6. Paste into the SQL Editor
7. Click **RUN**

**Expected output**: "Success. No rows returned"

### Verify Tables Created

Run this query in SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected output**: You should see 4 tables:
- ad_accounts
- anomalies
- daily_metrics
- reports

---

## Step 5: Start the Development Server

```bash
# Start the dev server
npm run dev
```

**Expected output**:
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
- event compiled client and server successfully
```

**If you see errors:**
- Check that all environment variables are set correctly
- Make sure Node.js version is 18+: `node --version`
- Try deleting `node_modules` and running `npm install` again

---

## Step 6: Test Authentication

### 6.1 Create an Account

1. Open your browser: http://localhost:3000
2. You should be redirected to `/login`
3. Click **"Sign up"** link
4. Fill in the form:
   - **Name**: Your name
   - **Email**: Your email
   - **Password**: At least 6 characters
   - **Confirm Password**: Same password
5. Click **"Create account"**

**Expected result**: You should be redirected to `/dashboard`

**If it fails:**
- Check browser console for errors (F12 → Console tab)
- Check terminal for server errors
- Verify Supabase credentials are correct

### 6.2 Test Login

1. Open new incognito window: http://localhost:3000
2. Click **"Sign in"**
3. Enter your email and password
4. Click **"Sign in"**

**Expected result**: You should be redirected to `/dashboard`

---

## Step 7: Connect Google Ads Account

### 7.1 Update Google OAuth Redirect URI

**IMPORTANT:** Before connecting, add the local redirect URI:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Under **Authorized redirect URIs**, click **+ ADD URI**
6. Add: `http://localhost:3000/api/auth/callback`
7. Click **SAVE**

### 7.2 Connect Your Account

1. On the dashboard, click **"Connect Account"** button
2. You should be redirected to Google login
3. Select your Google account
4. Review permissions (it needs access to Google Ads)
5. Click **"Allow"**

**Expected result**:
- Redirected back to dashboard
- Success message: "Successfully connected X account(s)"
- Account card(s) should appear on dashboard

**If it fails:**
- Check that redirect URI is added in Google Cloud Console
- Check browser console for errors
- Check terminal for server errors
- Verify Google credentials in `.env.local`

---

## Step 8: Fetch Google Ads Data

### 8.1 Manual Data Fetch

Test the data fetching API:

```bash
# In a new terminal (keep dev server running)
curl -X POST http://localhost:3000/api/google-ads/fetch-data \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "YOUR_ACCOUNT_ID_HERE",
    "days": 7
  }'
```

**To get your account ID:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. In the dashboard, inspect the account card
4. Look for the link `/dashboard/accounts/[ID]`
5. Copy the ID from the URL

**Alternative (easier):**
```bash
# This will show you the account ID
curl http://localhost:3000/api/google-ads/accounts
```

**Expected output**:
```json
{
  "message": "Successfully fetched data for X campaign-days",
  "details": {
    "campaigns": 5,
    "dateRange": { "start": "2025-11-14", "end": "2025-11-20" },
    "inserted": 35
  }
}
```

### 8.2 Verify Data in Database

1. Go to Supabase dashboard → **Table Editor**
2. Select `daily_metrics` table
3. You should see rows with:
   - account_id
   - date
   - campaign_id
   - campaign_name
   - metrics (JSON)
   - device_data (JSON)

---

## Step 9: Test Anomaly Detection

Run anomaly detection manually:

```bash
# Create a test file
cat > test-anomaly.js << 'EOF'
const { detectAnomalies } = require('./lib/anomaly-detection');

async function test() {
  const accountId = process.argv[2];
  if (!accountId) {
    console.error('Usage: node test-anomaly.js <account_id>');
    process.exit(1);
  }

  console.log('Running anomaly detection for account:', accountId);
  const anomalies = await detectAnomalies(accountId);
  console.log('Anomalies detected:', anomalies.length);
  console.log(JSON.stringify(anomalies, null, 2));
}

test().catch(console.error);
EOF

# Run it (replace with your account ID)
node test-anomaly.js "your-account-id-here"
```

**Expected output**:
- Number of anomalies detected
- Details of each anomaly (if any)

---

## Step 10: Test AI Insights (Gemini)

Test the Gemini API integration:

```bash
# Create a test file
cat > test-ai.js << 'EOF'
const { generateAnomalyExplanation } = require('./lib/ai-insights');

async function test() {
  const context = {
    account_name: 'Test Account',
    date: '2025-11-20',
    metric: 'spend',
    expected_value: 100,
    actual_value: 200,
    percent_change: 100,
    device_data: { mobile: { spend: 150 }, desktop: { spend: 50 } },
    top_campaigns: [
      { name: 'Campaign 1', spend: 120, conversions: 5 },
      { name: 'Campaign 2', spend: 80, conversions: 3 }
    ]
  };

  console.log('Testing Gemini API...');
  const explanation = await generateAnomalyExplanation(context);
  console.log('\nAI Explanation:');
  console.log(explanation);
}

test().catch(console.error);
EOF

# Run it
node test-ai.js
```

**Expected output**:
- A 2-3 sentence explanation of the anomaly
- Should be specific and actionable

**If it fails:**
- Check Gemini API key is correct
- Check that `AI_PROVIDER=gemini` in `.env.local`
- Check terminal for API errors

---

## Step 11: Test Cron Job (Optional)

Test the daily sync cron job manually:

```bash
curl -X GET http://localhost:3000/api/cron/daily-sync \
  -H "Authorization: Bearer R4tY7uI9oP3sD6fG8hJ0kL2zX5cV7bN4mQ1wE3rT9yU5"
```

**Expected output**:
```json
{
  "message": "Daily sync completed",
  "timestamp": "2025-11-21T...",
  "results": {
    "accounts_processed": 1,
    "campaigns_synced": 10,
    "anomalies_detected": 2
  }
}
```

**Note:** This will fetch yesterday's data, run anomaly detection, and generate AI explanations.

---

## Troubleshooting

### Error: "Server environment not available"
**Fix**: Make sure `.env.local` exists and all required variables are set

### Error: "Failed to create Google Ads client"
**Fix**:
1. Check Google Developer Token is correct
2. Verify refresh token hasn't expired (try reconnecting account)
3. Check terminal for detailed error message

### Error: "Failed to generate explanation"
**Fix**:
1. Check Gemini API key is correct
2. Try in browser: https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY
3. Should return list of models

### Database query errors
**Fix**:
1. Verify migration ran successfully
2. Check RLS policies: `SELECT * FROM pg_policies WHERE schemaname = 'public';`
3. Try disabling RLS for testing: `ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;`

### Port 3000 already in use
**Fix**:
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

---

## Testing Checklist

Before moving to deployment, verify:

- [ ] You can sign up and log in
- [ ] Google Ads account connects successfully
- [ ] Account card appears on dashboard
- [ ] Data fetching works (API returns success)
- [ ] Data appears in Supabase database
- [ ] Anomaly detection runs without errors
- [ ] Gemini API generates explanations
- [ ] Cron job endpoint is accessible

---

## What's Next?

Once local testing is complete:

1. **Deploy to Vercel** (see `DEPLOYMENT.md`)
2. **Set up Resend** for email alerts
3. **Monitor first automated sync** (3 AM IST)
4. **Add Meta Ads integration** (Phase 2)

---

## Getting Help

If you encounter issues:

1. **Check terminal output** for errors
2. **Check browser console** (F12)
3. **Check Supabase logs**: Dashboard → Logs
4. **Review error messages carefully** - they usually tell you what's wrong

Common error patterns:
- "Unauthorized" → Check authentication/tokens
- "Not found" → Check database setup/RLS policies
- "Invalid request" → Check request payload format
- "API error" → Check API keys and quotas

---

## Performance Notes

**Expected load times:**
- Login/Signup: <2 seconds
- Connect account: 3-5 seconds (Google OAuth)
- Fetch data: 5-15 seconds (depending on account size)
- Anomaly detection: 1-3 seconds
- AI explanation: 2-4 seconds per anomaly

**Data limits:**
- Free Supabase: 500MB database
- Free Vercel: Unlimited requests, 100GB bandwidth
- Gemini API: 60 requests/minute (free tier)

Good luck with testing! 🚀
