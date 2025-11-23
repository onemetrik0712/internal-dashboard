/**
 * Manual Google Ads Account Connection
 *
 * Since auto-discovery of Google Ads accounts can be complex with different
 * API versions, this provides a manual way to connect accounts by entering
 * the customer ID directly.
 */

import { GoogleAdsApi } from 'google-ads-api'
import { env } from '@/lib/env'

export interface ManualAccountInfo {
  customerId: string
  descriptiveName: string
  currencyCode: string
  timeZone: string
  isManager: boolean
}

export interface ClientAccountInfo {
  customerId: string
  descriptiveName: string
  currencyCode: string
  timeZone: string
  level: number
}

/**
 * Verify a customer ID is accessible with the given refresh token
 *
 * @param customerId - Google Ads customer ID (with or without dashes)
 * @param refreshToken - OAuth refresh token
 * @returns Account information if successful
 */
export async function verifyAndGetAccountInfo(
  customerId: string,
  refreshToken: string
): Promise<ManualAccountInfo> {
  if (!env) throw new Error('Server environment not available')

  // Remove dashes and any whitespace
  const cleanCustomerId = customerId.replace(/[-\s]/g, '')

  if (!/^\d{10}$/.test(cleanCustomerId)) {
    throw new Error('Invalid customer ID format. Should be 10 digits (e.g., 1234567890 or 123-456-7890)')
  }

  const client = new GoogleAdsApi({
    client_id: env.google.clientId,
    client_secret: env.google.clientSecret,
    developer_token: env.google.developerToken,
  })

  const customer = client.Customer({
    customer_id: cleanCustomerId,
    refresh_token: refreshToken,
  })

  const query = `
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.currency_code,
      customer.time_zone,
      customer.manager
    FROM customer
    WHERE customer.id = ${cleanCustomerId}
  `

  try {
    console.log(`Verifying access to customer ${cleanCustomerId}...`)
    const results = await customer.query(query)

    if (results.length === 0) {
      throw new Error(`No account found with customer ID ${cleanCustomerId}. Please check the ID and try again.`)
    }

    const accountInfo = results[0].customer

    console.log('Account verified:', accountInfo.descriptive_name)
    console.log('Is manager account:', accountInfo.manager)

    return {
      customerId: cleanCustomerId,
      descriptiveName: accountInfo.descriptive_name || `Account ${cleanCustomerId}`,
      currencyCode: accountInfo.currency_code || 'USD',
      timeZone: accountInfo.time_zone || 'America/New_York',
      isManager: accountInfo.manager || false,
    }
  } catch (error: any) {
    console.error('Failed to verify account:', error)

    // Provide helpful error messages
    if (error.message && error.message.includes('PERMISSION_DENIED')) {
      throw new Error(`You don't have access to account ${cleanCustomerId}. Please ensure this Google account has access to this Google Ads account.`)
    } else if (error.message && error.message.includes('NOT_FOUND')) {
      throw new Error(`Account ${cleanCustomerId} not found. Please check the customer ID and try again.`)
    } else if (error.message && error.message.includes('INVALID_DEVELOPER_TOKEN')) {
      throw new Error('Your developer token is not valid or not approved. Please check your Google Ads API access.')
    }

    throw new Error(`Failed to verify account: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Fetch all client accounts under a manager account
 *
 * @param managerCustomerId - Manager account customer ID
 * @param refreshToken - OAuth refresh token
 * @returns List of client accounts
 */
export async function fetchClientAccounts(
  managerCustomerId: string,
  refreshToken: string
): Promise<ClientAccountInfo[]> {
  if (!env) throw new Error('Server environment not available')

  const cleanCustomerId = managerCustomerId.replace(/[-\s]/g, '')

  const client = new GoogleAdsApi({
    client_id: env.google.clientId,
    client_secret: env.google.clientSecret,
    developer_token: env.google.developerToken,
  })

  const customer = client.Customer({
    customer_id: cleanCustomerId,
    refresh_token: refreshToken,
    login_customer_id: cleanCustomerId, // Required for manager accounts
  })

  const query = `
    SELECT
      customer_client.id,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.level,
      customer_client.manager,
      customer_client.status
    FROM customer_client
    WHERE customer_client.status = 'ENABLED'
    AND customer_client.manager = false
  `

  try {
    console.log(`Fetching client accounts for manager ${cleanCustomerId}...`)
    const results = await customer.query(query)

    const clientAccounts: ClientAccountInfo[] = results.map((row: any) => ({
      customerId: row.customer_client.id.toString(),
      descriptiveName: row.customer_client.descriptive_name || `Account ${row.customer_client.id}`,
      currencyCode: row.customer_client.currency_code || 'USD',
      timeZone: row.customer_client.time_zone || 'America/New_York',
      level: row.customer_client.level || 1,
    }))

    console.log(`Found ${clientAccounts.length} client accounts`)
    return clientAccounts
  } catch (error: any) {
    console.error('Failed to fetch client accounts:', error)
    throw new Error(`Failed to fetch client accounts: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Format customer ID with dashes (123-456-7890)
 */
export function formatCustomerId(customerId: string): string {
  const clean = customerId.replace(/[-\s]/g, '')
  return clean.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
}
