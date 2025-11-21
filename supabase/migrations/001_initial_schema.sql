-- Enable pgcrypto for UUID generation and encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ad Accounts Table
CREATE TABLE ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'google_ads',
  account_name TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  refresh_token TEXT, -- Will be encrypted
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_ad_accounts_user_id ON ad_accounts(user_id);
CREATE INDEX idx_ad_accounts_customer_id ON ad_accounts(customer_id);

-- Enable Row Level Security
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ad_accounts
CREATE POLICY "Users can view own accounts"
  ON ad_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
  ON ad_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON ad_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
  ON ad_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Daily Metrics Table
CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  metrics JSONB NOT NULL,
  device_data JSONB,
  top_keywords JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, date, campaign_id)
);

-- Create indexes for faster queries
CREATE INDEX idx_daily_metrics_account_date ON daily_metrics(account_id, date DESC);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date DESC);

-- Enable Row Level Security
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_metrics
CREATE POLICY "Users can view own metrics"
  ON daily_metrics FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM ad_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert metrics"
  ON daily_metrics FOR INSERT
  WITH CHECK (true); -- Only service role will insert via API

-- Anomalies Table
CREATE TABLE anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  metric TEXT NOT NULL,
  expected_value NUMERIC NOT NULL,
  actual_value NUMERIC NOT NULL,
  percent_change NUMERIC NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('WARNING', 'CRITICAL')),
  ai_explanation TEXT,
  context_data JSONB,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_anomalies_account_date ON anomalies(account_id, date DESC);
CREATE INDEX idx_anomalies_severity ON anomalies(severity, resolved);

-- Enable Row Level Security
ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for anomalies
CREATE POLICY "Users can view own anomalies"
  ON anomalies FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM ad_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own anomalies"
  ON anomalies FOR UPDATE
  USING (
    account_id IN (
      SELECT id FROM ad_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert anomalies"
  ON anomalies FOR INSERT
  WITH CHECK (true); -- Only service role will insert via API

-- Reports Table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  report_type TEXT DEFAULT 'performance_summary',
  file_url TEXT,
  generated_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_reports_account ON reports(account_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reports
CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM ad_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own reports"
  ON reports FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT id FROM ad_accounts WHERE user_id = auth.uid()
    )
    AND generated_by = auth.uid()
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_ad_accounts_updated_at
  BEFORE UPDATE ON ad_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function to get account metrics summary
CREATE OR REPLACE FUNCTION get_account_summary(
  p_account_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  total_spend NUMERIC,
  total_conversions NUMERIC,
  avg_cost_per_conversion NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUM((metrics->>'spend')::NUMERIC) as total_spend,
    SUM((metrics->>'conversions')::NUMERIC) as total_conversions,
    CASE
      WHEN SUM((metrics->>'conversions')::NUMERIC) > 0
      THEN SUM((metrics->>'spend')::NUMERIC) / SUM((metrics->>'conversions')::NUMERIC)
      ELSE 0
    END as avg_cost_per_conversion
  FROM daily_metrics
  WHERE
    account_id = p_account_id
    AND date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    AND date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
