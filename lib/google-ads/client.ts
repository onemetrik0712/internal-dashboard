/**
 * Google Ads API Client
 *
 * Handles authenticated requests to Google Ads API
 * with automatic token refresh and retry logic
 */

import { GoogleAdsApi, Customer } from 'google-ads-api'
import { env } from '@/lib/env'
import { refreshAccessToken } from './oauth'
import { decrypt, encrypt } from '@/lib/security'
import { createClient } from '@/lib/supabase/server'

/**
 * Create Google Ads API client for an account
 *
 * @param accountId - Database ID of the ad account
 * @returns Configured Google Ads API client
 */
export async function createGoogleAdsClient(
  accountId: string
): Promise<{ client: GoogleAdsApi; customer: Customer }> {
  if (!env) throw new Error('Server environment not available')

  const supabase = await createClient()

  // Fetch account details with encrypted refresh token
  const { data: account, error } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('id', accountId)
    .single()

  if (error || !account) {
    throw new Error('Account not found')
  }

  if (!account.refresh_token) {
    throw new Error('No refresh token available for this account')
  }

  // Decrypt refresh token
  let refreshToken: string
  try {
    refreshToken = decrypt(account.refresh_token)
  } catch (error) {
    throw new Error('Failed to decrypt refresh token')
  }

  // Check if token needs refresh (refresh if expires within 5 minutes)
  const needsRefresh = account.token_expires_at
    ? new Date(account.token_expires_at).getTime() - Date.now() < 5 * 60 * 1000
    : true

  let accessToken = refreshToken

  if (needsRefresh) {
    try {
      // Refresh the access token
      const tokens = await refreshAccessToken(refreshToken)
      accessToken = tokens.access_token

      // Update stored tokens
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

      await supabase
        .from('ad_accounts')
        .update({
          refresh_token: encrypt(tokens.refresh_token),
          token_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', accountId)
    } catch (error) {
      console.error('Failed to refresh token:', error)
      throw new Error('Failed to refresh access token. Please reconnect your account.')
    }
  }

  // Initialize Google Ads API client
  const client = new GoogleAdsApi({
    client_id: env.google.clientId,
    client_secret: env.google.clientSecret,
    developer_token: env.google.developerToken,
  })

  // Create customer instance
  const customer = client.Customer({
    customer_id: account.customer_id.replace(/-/g, ''), // Remove dashes
    refresh_token: refreshToken,
  })

  return { client, customer }
}

/**
 * Get list of accessible customer IDs
 *
 * @param refreshToken - OAuth refresh token
 * @returns List of accessible customer accounts
 */
export async function getAccessibleCustomers(
  refreshToken: string
): Promise<string[]> {
  if (!env) throw new Error('Server environment not available')

  const client = new GoogleAdsApi({
    client_id: env.google.clientId,
    client_secret: env.google.clientSecret,
    developer_token: env.google.developerToken,
  })

  try {
    // Create a temporary customer to get accessible customers
    const customer = client.Customer({
      customer_id: '0', // Placeholder
      refresh_token: refreshToken,
    })

    const accessibleCustomers = await customer.listAccessibleCustomers()
    return accessibleCustomers.resource_names.map((name) =>
      name.replace('customers/', '')
    )
  } catch (error) {
    console.error('Failed to get accessible customers:', error)
    throw new Error('Failed to fetch accessible accounts')
  }
}

/**
 * Get customer account details
 *
 * @param customerId - Google Ads customer ID
 * @param refreshToken - OAuth refresh token
 * @returns Customer account information
 */
export async function getCustomerDetails(
  customerId: string,
  refreshToken: string
): Promise<{
  id: string
  descriptive_name: string
  currency_code: string
  time_zone: string
}> {
  if (!env) throw new Error('Server environment not available')

  const client = new GoogleAdsApi({
    client_id: env.google.clientId,
    client_secret: env.google.clientSecret,
    developer_token: env.google.developerToken,
  })

  const customer = client.Customer({
    customer_id: customerId.replace(/-/g, ''),
    refresh_token: refreshToken,
  })

  const query = `
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.currency_code,
      customer.time_zone
    FROM customer
    WHERE customer.id = ${customerId.replace(/-/g, '')}
  `

  try {
    const results = await customer.query(query)
    if (results.length === 0) {
      throw new Error('Customer not found')
    }
    return results[0].customer
  } catch (error) {
    console.error('Failed to get customer details:', error)
    throw new Error('Failed to fetch account details')
  }
}
