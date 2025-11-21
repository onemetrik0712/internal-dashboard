/**
 * Google OAuth Callback Handler
 *
 * GET /api/auth/callback
 *
 * SECURITY:
 * - Validates state parameter against stored cookie (CSRF protection)
 * - Encrypts refresh token before storage
 * - Requires authenticated user
 * - Validates authorization code
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  exchangeCodeForTokens,
  getUserInfo,
  OAuthTokens,
} from '@/lib/google-ads/oauth'
import {
  getAccessibleCustomers,
  getCustomerDetails,
} from '@/lib/google-ads/client'
import { encrypt, securityHeaders, sanitizeInput } from '@/lib/security'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Check for OAuth errors
    if (error) {
      console.error('OAuth error:', error)
      return NextResponse.redirect(
        new URL(
          `/dashboard?error=${encodeURIComponent('OAuth authorization failed')}`,
          request.url
        )
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          '/dashboard?error=' + encodeURIComponent('Missing authorization code'),
          request.url
        )
      )
    }

    // Verify state parameter (CSRF protection)
    const cookieStore = await cookies()
    const storedState = cookieStore.get('oauth_state')?.value

    if (!storedState || storedState !== state) {
      console.error('State mismatch:', { stored: storedState, received: state })
      return NextResponse.redirect(
        new URL(
          '/dashboard?error=' + encodeURIComponent('Invalid state parameter'),
          request.url
        )
      )
    }

    // Verify user is authenticated
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(
        new URL('/login?error=' + encodeURIComponent('Please log in first'), request.url)
      )
    }

    // Exchange code for tokens
    let tokens: OAuthTokens
    try {
      tokens = await exchangeCodeForTokens(code)
    } catch (error: any) {
      console.error('Token exchange error:', error)
      return NextResponse.redirect(
        new URL(
          '/dashboard?error=' +
            encodeURIComponent('Failed to obtain access tokens'),
          request.url
        )
      )
    }

    // Get user info from Google
    const userInfo = await getUserInfo(tokens.access_token)

    // Get accessible Google Ads accounts
    let customerIds: string[]
    try {
      customerIds = await getAccessibleCustomers(tokens.refresh_token)
    } catch (error: any) {
      console.error('Failed to get accessible customers:', error)
      return NextResponse.redirect(
        new URL(
          '/dashboard?error=' +
            encodeURIComponent(
              'No Google Ads accounts found. Please ensure you have Google Ads accounts linked to this Google account.'
            ),
          request.url
        )
      )
    }

    if (customerIds.length === 0) {
      return NextResponse.redirect(
        new URL(
          '/dashboard?error=' +
            encodeURIComponent('No Google Ads accounts found'),
          request.url
        )
      )
    }

    // Store each accessible customer as a separate account
    const insertedAccounts: string[] = []

    for (const customerId of customerIds) {
      try {
        // Get customer details
        const customerDetails = await getCustomerDetails(
          customerId,
          tokens.refresh_token
        )

        // Format customer ID with dashes (123-456-7890)
        const formattedCustomerId = customerId.replace(
          /(\d{3})(\d{3})(\d{4})/,
          '$1-$2-$3'
        )

        // Check if account already exists
        const { data: existingAccount } = await supabase
          .from('ad_accounts')
          .select('id')
          .eq('user_id', user.id)
          .eq('customer_id', formattedCustomerId)
          .single()

        if (existingAccount) {
          // Update existing account
          await supabase
            .from('ad_accounts')
            .update({
              refresh_token: encrypt(tokens.refresh_token),
              token_expires_at: new Date(
                Date.now() + tokens.expires_in * 1000
              ).toISOString(),
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingAccount.id)

          insertedAccounts.push(existingAccount.id)
        } else {
          // Insert new account
          const { data: newAccount, error: insertError } = await supabase
            .from('ad_accounts')
            .insert({
              user_id: user.id,
              platform: 'google_ads',
              account_name: sanitizeInput(
                customerDetails.descriptive_name || `Account ${formattedCustomerId}`
              ),
              customer_id: formattedCustomerId,
              refresh_token: encrypt(tokens.refresh_token),
              token_expires_at: new Date(
                Date.now() + tokens.expires_in * 1000
              ).toISOString(),
              is_active: true,
            })
            .select('id')
            .single()

          if (insertError) {
            console.error('Failed to insert account:', insertError)
            continue
          }

          if (newAccount) {
            insertedAccounts.push(newAccount.id)
          }
        }
      } catch (error: any) {
        console.error(`Failed to process customer ${customerId}:`, error)
        // Continue with other accounts
        continue
      }
    }

    // Clear the state cookie
    const response = NextResponse.redirect(
      new URL(
        `/dashboard?success=${encodeURIComponent(
          `Successfully connected ${insertedAccounts.length} account(s)`
        )}`,
        request.url
      )
    )

    response.cookies.delete('oauth_state')

    // Add security headers
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      new URL(
        '/dashboard?error=' +
          encodeURIComponent('An unexpected error occurred'),
        request.url
      )
    )
  }
}
