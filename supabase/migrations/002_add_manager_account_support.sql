-- Add manager account support
-- This migration adds fields to handle Google Ads Manager Accounts (MCC)
-- and their client accounts

ALTER TABLE ad_accounts
ADD COLUMN is_manager BOOLEAN DEFAULT false,
ADD COLUMN parent_account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE;

-- Create index for faster client account lookups
CREATE INDEX idx_ad_accounts_parent_account_id ON ad_accounts(parent_account_id);

-- Add unique constraint for user_id + customer_id to prevent duplicates
-- This allows upsert operations to work properly
ALTER TABLE ad_accounts
ADD CONSTRAINT unique_user_customer UNIQUE (user_id, customer_id);

-- Comments for documentation
COMMENT ON COLUMN ad_accounts.is_manager IS 'Whether this is a Google Ads Manager Account (MCC)';
COMMENT ON COLUMN ad_accounts.parent_account_id IS 'Reference to parent manager account if this is a client account';
