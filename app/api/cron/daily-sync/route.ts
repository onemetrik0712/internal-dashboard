/**
 * Daily Data Sync Cron Job
 *
 * GET /api/cron/daily-sync
 *
 * Runs daily at 3 AM IST via Vercel Cron
 *
 * Tasks:
 * 1. Fetch yesterday's data for all active accounts
 * 2. Run anomaly detection
 * 3. Generate AI explanations for anomalies
 * 4. Send email alerts for critical anomalies
 *
 * SECURITY:
 * - Protected by cron secret (only Vercel cron can call)
 * - Validates authorization header
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { validateCronAuth, securityHeaders } from '@/lib/security'
import { createGoogleAdsClient } from '@/lib/google-ads/client'
import {
  fetchCampaignMetrics,
  fetchDeviceMetrics,
  fetchTopKeywords,
} from '@/lib/google-ads/queries'
import {
  detectAnomalies,
  storeAnomalies,
} from '@/lib/anomaly-detection'
import { generateExplanationsForPendingAnomalies } from '@/lib/ai-insights'
import { sendAnomalyAlerts } from '@/lib/email'
import { subDays, format } from 'date-fns'

export const maxDuration = 300 // 5 minutes max execution time

export async function GET(request: NextRequest) {
  try {
    // Validate cron authorization
    const authHeader = request.headers.get('authorization')
    if (!validateCronAuth(authHeader)) {
      console.error('Unauthorized cron attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: securityHeaders }
      )
    }

    if (!env) {
      throw new Error('Server environment not available')
    }

    console.log('Starting daily sync cron job...')

    // Create service role client
    const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get all active accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('ad_accounts')
      .select('id, account_name, user_id')
      .eq('is_active', true)

    if (accountsError || !accounts || accounts.length === 0) {
      console.log('No active accounts found')
      return NextResponse.json(
        { message: 'No active accounts to sync' },
        { headers: securityHeaders }
      )
    }

    console.log(`Found ${accounts.length} active accounts`)

    // Calculate yesterday's date
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

    const results = {
      accounts_processed: 0,
      accounts_failed: 0,
      campaigns_synced: 0,
      anomalies_detected: 0,
      alerts_sent: 0,
      errors: [] as string[],
    }

    // Process each account
    for (const account of accounts) {
      try {
        console.log(`Processing account: ${account.account_name}`)

        // Create Google Ads client
        const { customer } = await createGoogleAdsClient(account.id)

        // Fetch yesterday's data
        const [campaignMetrics, deviceMetrics, topKeywords] = await Promise.all([
          fetchCampaignMetrics(customer, yesterday, yesterday),
          fetchDeviceMetrics(customer, yesterday, yesterday),
          fetchTopKeywords(customer, yesterday, yesterday, 50),
        ])

        console.log(`Fetched ${campaignMetrics.length} campaigns for ${account.account_name}`)

        // Store metrics in database
        for (const campaign of campaignMetrics) {
          const { error: upsertError } = await supabase
            .from('daily_metrics')
            .upsert(
              {
                account_id: account.id,
                date: campaign.date,
                campaign_id: campaign.campaign_id,
                campaign_name: campaign.campaign_name,
                metrics: campaign.metrics,
                device_data: deviceMetrics[campaign.date] || null,
                top_keywords: topKeywords[campaign.date] || null,
              },
              {
                onConflict: 'account_id,date,campaign_id',
              }
            )

          if (upsertError) {
            console.error(`Failed to upsert metrics for campaign ${campaign.campaign_name}:`, upsertError)
            results.errors.push(`${account.account_name}: ${upsertError.message}`)
          } else {
            results.campaigns_synced++
          }
        }

        // Run anomaly detection
        const anomalies = await detectAnomalies(account.id, yesterday)

        if (anomalies.length > 0) {
          console.log(`Detected ${anomalies.length} anomalies for ${account.account_name}`)
          await storeAnomalies(anomalies)
          results.anomalies_detected += anomalies.length

          // Send alerts for critical anomalies
          const criticalAnomalies = anomalies.filter(a => a.severity === 'CRITICAL')
          if (criticalAnomalies.length > 0) {
            try {
              await sendAnomalyAlerts(account.id, account.user_id, criticalAnomalies)
              results.alerts_sent += criticalAnomalies.length
            } catch (emailError: any) {
              console.error('Failed to send alert emails:', emailError)
              results.errors.push(`Email alerts failed for ${account.account_name}`)
            }
          }
        }

        results.accounts_processed++
      } catch (error: any) {
        console.error(`Failed to process account ${account.account_name}:`, error)
        results.accounts_failed++
        results.errors.push(`${account.account_name}: ${error.message}`)
      }
    }

    // Generate AI explanations for anomalies (batch process)
    try {
      console.log('Generating AI explanations for pending anomalies...')
      const explanationsGenerated = await generateExplanationsForPendingAnomalies()
      console.log(`Generated ${explanationsGenerated} AI explanations`)
    } catch (error: any) {
      console.error('Failed to generate AI explanations:', error)
      results.errors.push(`AI explanations failed: ${error.message}`)
    }

    console.log('Daily sync completed:', results)

    return NextResponse.json(
      {
        message: 'Daily sync completed',
        timestamp: new Date().toISOString(),
        results,
      },
      { headers: securityHeaders }
    )
  } catch (error: any) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      {
        error: 'Cron job failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers: securityHeaders }
    )
  }
}
