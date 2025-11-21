/**
 * Anomaly Detection Service
 *
 * Detects anomalies by comparing metrics with same day last week
 * Thresholds:
 * - WARNING: 25-50% deviation
 * - CRITICAL: >50% deviation
 */

import { createClient as createServerClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { CampaignMetrics } from '@/types'
import { env } from './env'
import { subDays, format } from 'date-fns'

interface AnomalyThreshold {
  metric: keyof CampaignMetrics
  warningThreshold: number // Percentage
  criticalThreshold: number // Percentage
  direction?: 'increase' | 'decrease' | 'both' // Which direction is bad
}

// Define thresholds for each metric
const THRESHOLDS: AnomalyThreshold[] = [
  {
    metric: 'spend',
    warningThreshold: 30,
    criticalThreshold: 50,
    direction: 'increase', // Spending too much is bad
  },
  {
    metric: 'conversions',
    warningThreshold: 25,
    criticalThreshold: 50,
    direction: 'decrease', // Fewer conversions is bad
  },
  {
    metric: 'cost_per_conversion',
    warningThreshold: 40,
    criticalThreshold: 60,
    direction: 'increase', // Higher cost per conversion is bad
  },
  {
    metric: 'ctr',
    warningThreshold: 30,
    criticalThreshold: 50,
    direction: 'decrease', // Lower CTR is bad
  },
]

interface DetectedAnomaly {
  account_id: string
  date: string
  metric: string
  expected_value: number
  actual_value: number
  percent_change: number
  severity: 'WARNING' | 'CRITICAL'
  context_data: any
}

/**
 * Calculate percentage change
 */
function calculatePercentChange(current: number, baseline: number): number {
  if (baseline === 0) return current > 0 ? 100 : 0
  return ((current - baseline) / baseline) * 100
}

/**
 * Check if anomaly based on threshold
 */
function isAnomaly(
  percentChange: number,
  threshold: AnomalyThreshold
): 'WARNING' | 'CRITICAL' | null {
  const absChange = Math.abs(percentChange)

  // Check direction
  const isNegativeChange = percentChange < 0
  const isPositiveChange = percentChange > 0

  let isBadDirection = false

  if (threshold.direction === 'increase' && isPositiveChange) {
    isBadDirection = true
  } else if (threshold.direction === 'decrease' && isNegativeChange) {
    isBadDirection = true
  } else if (threshold.direction === 'both') {
    isBadDirection = true
  }

  if (!isBadDirection) return null

  if (absChange >= threshold.criticalThreshold) {
    return 'CRITICAL'
  } else if (absChange >= threshold.warningThreshold) {
    return 'WARNING'
  }

  return null
}

/**
 * Detect anomalies for an account
 *
 * @param accountId - Account ID to check
 * @param date - Date to check (defaults to yesterday)
 * @returns Array of detected anomalies
 */
export async function detectAnomalies(
  accountId: string,
  date?: string
): Promise<DetectedAnomaly[]> {
  if (!env) throw new Error('Server environment not available')

  // Create service role client for unrestricted access
  const supabase = createServerClient<Database>(
    env.supabase.url,
    env.supabase.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  const checkDate = date || format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const baselineDate = format(subDays(new Date(checkDate), 7), 'yyyy-MM-dd')

  const anomalies: DetectedAnomaly[] = []

  try {
    // Fetch current day metrics (aggregated across campaigns)
    const { data: currentMetrics, error: currentError } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('account_id', accountId)
      .eq('date', checkDate)

    if (currentError || !currentMetrics || currentMetrics.length === 0) {
      console.log('No current metrics found for date:', checkDate)
      return []
    }

    // Fetch baseline metrics (same day last week)
    const { data: baselineMetrics, error: baselineError } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('account_id', accountId)
      .eq('date', baselineDate)

    if (baselineError || !baselineMetrics || baselineMetrics.length === 0) {
      console.log('No baseline metrics found for date:', baselineDate)
      return []
    }

    // Aggregate metrics across all campaigns
    const aggregateCurrent = aggregateMetrics(
      currentMetrics.map((m) => m.metrics as CampaignMetrics)
    )
    const aggregateBaseline = aggregateMetrics(
      baselineMetrics.map((m) => m.metrics as CampaignMetrics)
    )

    // Check each threshold
    for (const threshold of THRESHOLDS) {
      const currentValue = aggregateCurrent[threshold.metric]
      const baselineValue = aggregateBaseline[threshold.metric]

      const percentChange = calculatePercentChange(currentValue, baselineValue)
      const severity = isAnomaly(percentChange, threshold)

      if (severity) {
        // Gather context data
        const contextData = {
          current_metrics: aggregateCurrent,
          baseline_metrics: aggregateBaseline,
          campaigns_count: currentMetrics.length,
          device_data: currentMetrics[0]?.device_data || null,
          top_campaigns: currentMetrics
            .sort(
              (a, b) =>
                ((b.metrics as CampaignMetrics).spend || 0) -
                ((a.metrics as CampaignMetrics).spend || 0)
            )
            .slice(0, 5)
            .map((m) => ({
              name: m.campaign_name,
              spend: (m.metrics as CampaignMetrics).spend,
              conversions: (m.metrics as CampaignMetrics).conversions,
            })),
        }

        anomalies.push({
          account_id: accountId,
          date: checkDate,
          metric: threshold.metric,
          expected_value: baselineValue,
          actual_value: currentValue,
          percent_change: percentChange,
          severity,
          context_data: contextData,
        })
      }
    }

    return anomalies
  } catch (error) {
    console.error('Anomaly detection error:', error)
    throw error
  }
}

/**
 * Aggregate metrics across multiple campaigns
 */
function aggregateMetrics(metrics: CampaignMetrics[]): CampaignMetrics {
  const totals = metrics.reduce(
    (acc, m) => ({
      spend: acc.spend + (m.spend || 0),
      impressions: acc.impressions + (m.impressions || 0),
      clicks: acc.clicks + (m.clicks || 0),
      conversions: acc.conversions + (m.conversions || 0),
      conversion_value: acc.conversion_value + (m.conversion_value || 0),
      ctr: 0, // Will calculate below
      cpc: 0, // Will calculate below
      cost_per_conversion: 0, // Will calculate below
    }),
    {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      conversion_value: 0,
      ctr: 0,
      cpc: 0,
      cost_per_conversion: 0,
    }
  )

  // Calculate derived metrics
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
  totals.cost_per_conversion =
    totals.conversions > 0 ? totals.spend / totals.conversions : 0

  return totals
}

/**
 * Store detected anomalies in database
 */
export async function storeAnomalies(
  anomalies: DetectedAnomaly[]
): Promise<void> {
  if (!env) throw new Error('Server environment not available')
  if (anomalies.length === 0) return

  const supabase = createServerClient<Database>(
    env.supabase.url,
    env.supabase.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  for (const anomaly of anomalies) {
    // Check if anomaly already exists
    const { data: existing } = await supabase
      .from('anomalies')
      .select('id')
      .eq('account_id', anomaly.account_id)
      .eq('date', anomaly.date)
      .eq('metric', anomaly.metric)
      .single()

    if (!existing) {
      // Insert new anomaly (AI explanation will be added later)
      const { error } = await supabase.from('anomalies').insert({
        account_id: anomaly.account_id,
        date: anomaly.date,
        metric: anomaly.metric,
        expected_value: anomaly.expected_value,
        actual_value: anomaly.actual_value,
        percent_change: anomaly.percent_change,
        severity: anomaly.severity,
        context_data: anomaly.context_data,
      })

      if (error) {
        console.error('Failed to store anomaly:', error)
      }
    }
  }
}

/**
 * Run anomaly detection for all active accounts
 */
export async function runAnomalyDetectionForAllAccounts(
  date?: string
): Promise<{ accountId: string; anomaliesCount: number }[]> {
  if (!env) throw new Error('Server environment not available')

  const supabase = createServerClient<Database>(
    env.supabase.url,
    env.supabase.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  // Get all active accounts
  const { data: accounts, error } = await supabase
    .from('ad_accounts')
    .select('id')
    .eq('is_active', true)

  if (error || !accounts) {
    console.error('Failed to fetch accounts:', error)
    return []
  }

  const results: { accountId: string; anomaliesCount: number }[] = []

  for (const account of accounts) {
    try {
      const anomalies = await detectAnomalies(account.id, date)
      if (anomalies.length > 0) {
        await storeAnomalies(anomalies)
      }
      results.push({
        accountId: account.id,
        anomaliesCount: anomalies.length,
      })
    } catch (error) {
      console.error(`Failed to detect anomalies for account ${account.id}:`, error)
    }
  }

  return results
}
