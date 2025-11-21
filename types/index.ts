// Campaign Metrics
export interface CampaignMetrics {
  spend: number
  impressions: number
  clicks: number
  conversions: number
  conversion_value: number
  ctr: number
  cpc: number
  cost_per_conversion: number
}

// Device Breakdown
export interface DeviceMetrics {
  mobile: Partial<CampaignMetrics>
  desktop: Partial<CampaignMetrics>
  tablet: Partial<CampaignMetrics>
}

// Keyword Data
export interface KeywordData {
  keyword: string
  spend: number
  clicks: number
  conversions: number
  impressions: number
}

// Account Summary (for dashboard cards)
export interface AccountSummary {
  id: string
  account_name: string
  customer_id: string
  platform: string
  last_7_days: {
    spend: number
    conversions: number
    cost_per_conversion: number
    trend: {
      spend: number
      conversions: number
      cost_per_conversion: number
    }
  }
  has_anomalies: boolean
  anomaly_count: number
}

// Anomaly
export interface Anomaly {
  id: string
  account_id: string
  date: string
  metric: string
  expected_value: number
  actual_value: number
  percent_change: number
  severity: 'WARNING' | 'CRITICAL'
  ai_explanation: string | null
  context_data: any
  resolved: boolean
  created_at: string
}

// Daily Metric
export interface DailyMetric {
  id: string
  account_id: string
  date: string
  campaign_id: string
  campaign_name: string
  metrics: CampaignMetrics
  device_data: DeviceMetrics | null
  top_keywords: KeywordData[] | null
  created_at: string
}

// Ad Account
export interface AdAccount {
  id: string
  user_id: string
  platform: string
  account_name: string
  customer_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Report
export interface Report {
  id: string
  account_id: string
  date_range_start: string
  date_range_end: string
  report_type: string
  file_url: string | null
  generated_by: string
  created_at: string
}

// Chart Data Point
export interface ChartDataPoint {
  date: string
  spend: number
  conversions: number
  cost_per_conversion: number
}

// Date Range
export type DateRangePreset = '7d' | '30d' | '90d' | 'custom'

export interface DateRange {
  from: Date
  to: Date
}
