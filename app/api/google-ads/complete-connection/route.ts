/**
 * Complete Google Ads Connection
 *
 * POST /api/google-ads/complete-connection
 *
 * Verifies customer ID and saves the account
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyAndGetAccountInfo, formatCustomerId } from '@/lib/google-ads/manual-connect'
import { decrypt, encrypt, securityHeaders, sanitizeInput } from '@/lib/security'
import { cookies } from 'next/headers'

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

    // Get customer ID from request
    const { customerId } = await request.json()

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400, headers: securityHeaders }
      )
    }

    // Get refresh token from cookie
    const cookieStore = await cookies()
    const encryptedRefreshToken = cookieStore.get('google_ads_refresh_token')?.value

    if (!encryptedRefreshToken) {
      return NextResponse.json(
        { error: 'OAuth session expired. Please reconnect your Google account.' },
        { status: 401, headers: securityHeaders }
      )
    }

    // Decrypt refresh token
    let refreshToken: string
    try {
      refreshToken = decrypt(encryptedRefreshToken)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid OAuth session. Please reconnect your Google account.' },
        { status: 401, headers: securityHeaders }
      )
    }

    // Verify and get account information
    let accountInfo
    try {
      accountInfo = await verifyAndGetAccountInfo(customerId, refreshToken)
    } catch (error: any) {
      console.error('Failed to verify account:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to verify account access' },
        { status: 400, headers: securityHeaders }
      )
    }

    // Format customer ID with dashes
    const formattedCustomerId = formatCustomerId(accountInfo.customerId)

    // Check if account already exists for this user
    const { data: existingAccount } = await supabase
      .from('ad_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('customer_id', formattedCustomerId)
      .single()

    if (existingAccount) {
      // Update existing account
      const { error: updateError } = await supabase
        .from('ad_accounts')
        .update({
          refresh_token: encrypt(refreshToken),
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
          is_active: true,
          account_name: sanitizeInput(accountInfo.descriptiveName),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAccount.id)

      if (updateError) {
        console.error('Failed to update account:', updateError)
        return NextResponse.json(
          { error: 'Failed to update account' },
          { status: 500, headers: securityHeaders }
        )
      }

      // Clear the refresh token cookie
      const response = NextResponse.json(
        {
          message: 'Account updated successfully',
          accountId: existingAccount.id,
        },
        { headers: securityHeaders }
      )

      response.cookies.delete('google_ads_refresh_token')

      return response
    } else {
      // Insert new account
      const { data: newAccount, error: insertError } = await supabase
        .from('ad_accounts')
        .insert({
          user_id: user.id,
          platform: 'google_ads',
          account_name: sanitizeInput(accountInfo.descriptiveName),
          customer_id: formattedCustomerId,
          refresh_token: encrypt(refreshToken),
          token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          is_active: true,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('Failed to insert account:', insertError)
        return NextResponse.json(
          { error: 'Failed to save account' },
          { status: 500, headers: securityHeaders }
        )
      }

      // Clear the refresh token cookie
      const response = NextResponse.json(
        {
          message: 'Account connected successfully',
          accountId: newAccount.id,
          accountName: accountInfo.descriptiveName,
        },
        { headers: securityHeaders }
      )

      response.cookies.delete('google_ads_refresh_token')

      return response
    }
  } catch (error: any) {
    console.error('Complete connection error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500, headers: securityHeaders }
    )
  }
}
