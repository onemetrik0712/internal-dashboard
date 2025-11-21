/**
 * Fetch Google Ads Data
 *
 * POST /api/google-ads/fetch-data
 *
 * Manually fetch latest data for an account
 *
 * SECURITY:
 * - Requires authenticated user
 * - Validates account ownership
 * - Rate limited to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createGoogleAdsClient } from '@/lib/google-ads/client'
import {
  fetchCampaignMetrics,
  fetchDeviceMetrics,
  fetchTopKeywords,
} from '@/lib/google-ads/queries'
import { securityHeaders, rateLimiter } from '@/lib/security'
import { subDays, format } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: securityHeaders }
      )
    }

    // Rate limiting: max 5 requests per minute per user
    const rateLimitKey = `fetch-data:${user.id}`
    if (!rateLimiter.check(rateLimitKey, 5, 60000)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: securityHeaders }
      )
    }

    // Get account ID from request body
    const { accountId, days = 30 } = await request.json()

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400, headers: securityHeaders }
      )
    }

    // Verify account ownership
    const { data: account, error: accountError } = await supabase
      .from('ad_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404, headers: securityHeaders }
      )
    }

    // Create Google Ads client
    let customer
    try {
      const { customer: c } = await createGoogleAdsClient(accountId)
      customer = c
    } catch (error: any) {
      console.error('Failed to create Google Ads client:', error)
      return NextResponse.json(
        {
          error:
            'Failed to connect to Google Ads. Please try reconnecting your account.',
        },
        { status: 500, headers: securityHeaders }
      )
    }

    // Calculate date range (yesterday and past X days)
    const endDate = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')

    // Fetch data from Google Ads
    let campaignMetrics, deviceMetrics, topKeywords

    try {
      ;[campaignMetrics, deviceMetrics, topKeywords] = await Promise.all([
        fetchCampaignMetrics(customer, startDate, endDate),
        fetchDeviceMetrics(customer, startDate, endDate),
        fetchTopKeywords(customer, startDate, endDate, 50),
      ])
    } catch (error: any) {
      console.error('Failed to fetch Google Ads data:', error)
      return NextResponse.json(
        { error: `Failed to fetch data: ${error.message}` },
        { status: 500, headers: securityHeaders }
      )
    }

    // Store data in database
    let insertedCount = 0
    const errors: string[] = []

    for (const campaign of campaignMetrics) {
      try {
        const deviceData = deviceMetrics[campaign.date] || null
        const keywords = topKeywords[campaign.date] || null

        // Upsert (insert or update if exists)
        const { error: upsertError } = await supabase
          .from('daily_metrics')
          .upsert(
            {
              account_id: accountId,
              date: campaign.date,
              campaign_id: campaign.campaign_id,
              campaign_name: campaign.campaign_name,
              metrics: campaign.metrics,
              device_data: deviceData,
              top_keywords: keywords,
            },
            {
              onConflict: 'account_id,date,campaign_id',
            }
          )

        if (upsertError) {
          console.error('Failed to insert metrics:', upsertError)
          errors.push(`Campaign ${campaign.campaign_name}: ${upsertError.message}`)
        } else {
          insertedCount++
        }
      } catch (error: any) {
        console.error('Error processing campaign:', error)
        errors.push(`Campaign ${campaign.campaign_name}: ${error.message}`)
      }
    }

    return NextResponse.json(
      {
        message: `Successfully fetched data for ${insertedCount} campaign-days`,
        details: {
          campaigns: campaignMetrics.length,
          dateRange: { start: startDate, end: endDate },
          inserted: insertedCount,
          errors: errors.length > 0 ? errors : undefined,
        },
      },
      { headers: securityHeaders }
    )
  } catch (error: any) {
    console.error('Fetch data error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500, headers: securityHeaders }
    )
  }
}
