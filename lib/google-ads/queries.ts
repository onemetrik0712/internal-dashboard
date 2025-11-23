/**
 * Google Ads Query Language (GAQL) Queries
 *
 * Pre-built queries for fetching campaign metrics, device data, and keywords
 */

import { Customer } from 'google-ads-api'
import { CampaignMetrics, DeviceMetrics, KeywordData } from '@/types'

/**
 * Fetch campaign metrics for a date range
 *
 * @param customer - Google Ads customer instance
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Array of campaign metrics
 */
export async function fetchCampaignMetrics(
  customer: Customer,
  startDate: string,
  endDate: string
): Promise<
  Array<{
    campaign_id: string
    campaign_name: string
    date: string
    metrics: CampaignMetrics
  }>
> {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      segments.date,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_per_conversion
    FROM campaign
    WHERE
      segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status = 'ENABLED'
    ORDER BY segments.date DESC
  `

  try {
    const results = await customer.query(query)

    return results.map((row: any) => ({
      campaign_id: row.campaign.id.toString(),
      campaign_name: row.campaign.name,
      date: row.segments.date,
      metrics: {
        spend: parseFloat(row.metrics.cost_micros) / 1_000_000, // Convert micros to dollars
        impressions: parseInt(row.metrics.impressions),
        clicks: parseInt(row.metrics.clicks),
        conversions: parseFloat(row.metrics.conversions),
        conversion_value: parseFloat(row.metrics.conversions_value),
        ctr: parseFloat(row.metrics.ctr) * 100, // Convert to percentage
        cpc: parseFloat(row.metrics.average_cpc) / 1_000_000,
        cost_per_conversion: row.metrics.cost_per_conversion
          ? parseFloat(row.metrics.cost_per_conversion) / 1_000_000
          : 0,
      },
    }))
  } catch (error: any) {
    console.error('Failed to fetch campaign metrics:', error)
    throw new Error(`Failed to fetch campaign metrics: ${error.message}`)
  }
}

/**
 * Fetch device breakdown for a date range
 *
 * @param customer - Google Ads customer instance
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Device breakdown metrics
 */
export async function fetchDeviceMetrics(
  customer: Customer,
  startDate: string,
  endDate: string
): Promise<Record<string, DeviceMetrics>> {
  const query = `
    SELECT
      segments.date,
      segments.device,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE
      segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status = 'ENABLED'
  `

  try {
    const results = await customer.query(query)

    // Group by date
    const deviceDataByDate: Record<string, DeviceMetrics> = {}

    results.forEach((row: any) => {
      const date = row.segments.date
      const device = String(row.segments.device || 'UNKNOWN').toLowerCase()

      if (!deviceDataByDate[date]) {
        deviceDataByDate[date] = {
          mobile: {},
          desktop: {},
          tablet: {},
        }
      }

      const deviceKey = device as 'mobile' | 'desktop' | 'tablet'
      if (['mobile', 'desktop', 'tablet'].includes(device)) {
        deviceDataByDate[date][deviceKey] = {
          spend: parseFloat(row.metrics.cost_micros) / 1_000_000,
          impressions: parseInt(row.metrics.impressions),
          clicks: parseInt(row.metrics.clicks),
          conversions: parseFloat(row.metrics.conversions),
          conversion_value: parseFloat(row.metrics.conversions_value),
        }
      }
    })

    return deviceDataByDate
  } catch (error: any) {
    console.error('Failed to fetch device metrics:', error)
    throw new Error(`Failed to fetch device metrics: ${error.message}`)
  }
}

/**
 * Fetch top keywords by spend for a date range
 *
 * @param customer - Google Ads customer instance
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param limit - Number of top keywords to fetch (default: 50)
 * @returns Array of top keywords
 */
export async function fetchTopKeywords(
  customer: Customer,
  startDate: string,
  endDate: string,
  limit: number = 50
): Promise<Record<string, KeywordData[]>> {
  const query = `
    SELECT
      segments.date,
      ad_group_criterion.keyword.text,
      metrics.cost_micros,
      metrics.clicks,
      metrics.conversions,
      metrics.impressions
    FROM keyword_view
    WHERE
      segments.date BETWEEN '${startDate}' AND '${endDate}'
      AND campaign.status = 'ENABLED'
      AND ad_group.status = 'ENABLED'
      AND ad_group_criterion.status IN ('ENABLED', 'PAUSED')
    ORDER BY metrics.cost_micros DESC
    LIMIT ${limit}
  `

  try {
    const results = await customer.query(query)

    // Group by date
    const keywordsByDate: Record<string, KeywordData[]> = {}

    results.forEach((row: any) => {
      const date = row.segments.date

      if (!keywordsByDate[date]) {
        keywordsByDate[date] = []
      }

      keywordsByDate[date].push({
        keyword: row.ad_group_criterion.keyword.text,
        spend: parseFloat(row.metrics.cost_micros) / 1_000_000,
        clicks: parseInt(row.metrics.clicks),
        conversions: parseFloat(row.metrics.conversions),
        impressions: parseInt(row.metrics.impressions),
      })
    })

    return keywordsByDate
  } catch (error: any) {
    console.error('Failed to fetch top keywords:', error)
    throw new Error(`Failed to fetch top keywords: ${error.message}`)
  }
}

/**
 * Fetch account summary metrics
 *
 * @param customer - Google Ads customer instance
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Account-level summary metrics
 */
export async function fetchAccountSummary(
  customer: Customer,
  startDate: string,
  endDate: string
): Promise<CampaignMetrics> {
  const query = `
    SELECT
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_per_conversion
    FROM customer
    WHERE
      segments.date BETWEEN '${startDate}' AND '${endDate}'
  `

  try {
    const results = await customer.query(query)

    if (results.length === 0) {
      return {
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversion_value: 0,
        ctr: 0,
        cpc: 0,
        cost_per_conversion: 0,
      }
    }

    // Aggregate results
    const totals = results.reduce(
      (acc: any, row: any) => {
        acc.spend += parseFloat(row.metrics.cost_micros) / 1_000_000
        acc.impressions += parseInt(row.metrics.impressions)
        acc.clicks += parseInt(row.metrics.clicks)
        acc.conversions += parseFloat(row.metrics.conversions)
        acc.conversion_value += parseFloat(row.metrics.conversions_value)
        return acc
      },
      {
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversion_value: 0,
      }
    )

    return {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      cost_per_conversion:
        totals.conversions > 0 ? totals.spend / totals.conversions : 0,
    }
  } catch (error: any) {
    console.error('Failed to fetch account summary:', error)
    throw new Error(`Failed to fetch account summary: ${error.message}`)
  }
}
