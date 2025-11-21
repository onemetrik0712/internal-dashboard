# Deployment Guide

## Prerequisites

Before deploying, ensure you have:

✅ Supabase project set up (see `SETUP_DATABASE.md`)
✅ Google Cloud OAuth credentials
✅ Claude or Gemini API key (optional, can add later)
✅ Resend API key (optional, can add later)
✅ GitHub repository pushed

## Step 1: Prepare Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Sign up or log in (use GitHub for easier integration)
3. Install Vercel CLI (optional): `npm i -g vercel`

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Click **"New Project"**
2. Import your GitHub repository: `onemetrik0712/internal-dashboard`
3. Select the `claude/build-onemetrik-command-center-*` branch
4. Click **"Deploy"** (it will fail initially - this is expected)

### Option B: Via Vercel CLI

```bash
vercel deploy --prod
```

## Step 3: Configure Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add the following variables for **Production**, **Preview**, and **Development**:

### Required Variables

```env
# Supabase (Get from Supabase dashboard → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Ads (Get from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_DEVELOPER_TOKEN=your_google_ads_developer_token

# Security (Generate using: openssl rand -base64 32)
ENCRYPTION_KEY=generate_secure_32_char_key
CRON_SECRET=generate_secure_cron_secret

# App URL (update after deployment)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Optional Variables (Add when available)

```env
# AI Provider (claude or gemini)
AI_PROVIDER=claude
ANTHROPIC_API_KEY=your_key_here
# OR
GEMINI_API_KEY=your_key_here

# Email Alerts
RESEND_API_KEY=your_key_here
```

3. Click **"Save"** after each variable

## Step 4: Update Google OAuth Redirect URI

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://your-app.vercel.app/api/auth/callback
   ```
5. Click **"Save"**

## Step 5: Redeploy

After adding environment variables:

1. Go to **Deployments** tab
2. Click **"..."** on the latest deployment
3. Click **"Redeploy"**

Your app should now be live! 🎉

## Step 6: Verify Deployment

### Test Authentication
1. Visit `https://your-app.vercel.app`
2. Click **"Sign up"** and create an account
3. You should be redirected to the dashboard

### Test Google Ads Connection
1. Click **"Connect Account"** on the dashboard
2. Go through Google OAuth flow
3. Your Google Ads accounts should appear

### Test Cron Job (Manual Trigger)
```bash
curl -X GET \
  https://your-app.vercel.app/api/cron/daily-sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"
```

Replace `YOUR_CRON_SECRET_HERE` with the value you set in `CRON_SECRET` environment variable.

## Step 7: Configure Cron Job

Vercel automatically sets up cron jobs from `vercel.json`.

To verify:
1. Go to **Settings** → **Cron Jobs**
2. You should see: `/api/cron/daily-sync` scheduled for `30 21 * * *` (3 AM IST)

## Step 8: Set Up Resend for Emails

### Get Resend API Key
1. Sign up at [resend.com](https://resend.com)
2. Verify your domain (or use their test domain)
3. Generate an API key
4. Add to Vercel environment variables:
   ```
   RESEND_API_KEY=re_xxxxx
   ```

### Update Email "From" Address
Edit `lib/email.ts` line 71:
```typescript
from: 'OneMetrik Alerts <alerts@yourdomain.com>',
```

Replace `yourdomain.com` with your verified domain.

## Step 9: Get Google Ads Developer Token

**Important:** This is required for production use of Google Ads API.

1. Go to [Google Ads API Center](https://ads.google.com/aw/apicenter)
2. Apply for a developer token (takes 24-48 hours for approval)
3. Once approved, add to Vercel environment variables:
   ```
   GOOGLE_DEVELOPER_TOKEN=your_token_here
   ```

**Note:** You can test with basic access initially, but production requires approval.

## Step 10: Set Up Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain (e.g., `app.onemetrik.com`)
3. Follow Vercel's DNS instructions
4. Update `NEXT_PUBLIC_APP_URL` environment variable
5. Update Google OAuth redirect URI

## Post-Deployment Checklist

- [ ] Supabase database migrated successfully
- [ ] All environment variables configured
- [ ] Google OAuth redirect URI updated
- [ ] Authentication works (sign up/login)
- [ ] Google Ads connection works
- [ ] Data fetching works (manual refresh)
- [ ] Cron job configured in Vercel
- [ ] Email alerts configured (optional)
- [ ] Custom domain configured (optional)

## Monitoring & Logs

### View Application Logs
1. Go to Vercel dashboard → **Deployments**
2. Click on deployment → **Functions**
3. Click on any function to see logs

### View Cron Job Logs
1. Go to **Settings** → **Cron Jobs**
2. Click on your cron job
3. View execution history and logs

### Supabase Logs
1. Go to Supabase dashboard
2. Click **Logs** in sidebar
3. View API logs, database queries, etc.

## Troubleshooting

### OAuth redirect not working
- Verify redirect URI in Google Cloud Console
- Check that `NEXT_PUBLIC_APP_URL` matches your domain
- Ensure no trailing slashes in URLs

### Cron job not running
- Check cron secret matches in `vercel.json` and environment variables
- View cron job logs in Vercel dashboard
- Manually trigger to test: `curl` command above

### Email alerts not sending
- Verify Resend API key is correct
- Check that domain is verified in Resend
- View email logs in Resend dashboard

### Database errors
- Check Supabase service role key is correct
- Verify RLS policies are set up correctly
- Check database logs in Supabase

### Google Ads API errors
- Verify developer token is approved
- Check that OAuth tokens haven't expired
- Ensure customer IDs are formatted correctly (123-456-7890)

## Security Best Practices

✅ Never commit `.env.local` to git
✅ Rotate cron secret and encryption key regularly
✅ Use Vercel's environment variable encryption
✅ Enable Supabase RLS on all tables
✅ Monitor Vercel logs for suspicious activity
✅ Set up Vercel's Security & Compliance features
✅ Use strong passwords for Supabase
✅ Enable 2FA on Vercel, Supabase, and Google accounts

## Scaling Considerations

### If You Have Many Accounts (>100)
- Consider upgrading to Vercel Pro for longer function timeouts
- Implement queue system (e.g., BullMQ + Redis)
- Batch process accounts in cron job

### If Data Volume Increases
- Add database indexes for slow queries
- Consider Supabase Pro for better performance
- Implement data archival strategy

### If Email Volume Increases
- Upgrade Resend plan (3,000 free → 50,000/month)
- Implement email batching/digest
- Add unsubscribe functionality

## Support

For issues:
1. Check logs first (Vercel, Supabase, Resend)
2. Review error messages carefully
3. Consult this guide and `README.md`
4. Check GitHub issues

## Next Steps

After successful deployment:
1. Test all features end-to-end
2. Monitor first cron job execution (3 AM IST)
3. Add more accounts and test with real data
4. Customize email templates (optional)
5. Set up reports and analytics (Phase 2)

Congratulations on deploying OneMetrik Command Center! 🚀
