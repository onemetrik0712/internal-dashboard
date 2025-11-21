/**
 * Disconnect Google Ads Account
 *
 * POST /api/google-ads/disconnect
 *
 * SECURITY:
 * - Requires authenticated user
 * - Validates account ownership
 * - Revokes OAuth tokens
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revokeToken } from '@/lib/google-ads/oauth'
import { decrypt, securityHeaders } from '@/lib/security'

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

    // Get account ID from request body
    const { accountId } = await request.json()

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400, headers: securityHeaders }
      )
    }

    // Fetch account and verify ownership
    const { data: account, error: fetchError } = await supabase
      .from('ad_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404, headers: securityHeaders }
      )
    }

    // Revoke OAuth token
    if (account.refresh_token) {
      try {
        const refreshToken = decrypt(account.refresh_token)
        await revokeToken(refreshToken)
      } catch (error) {
        console.error('Failed to revoke token:', error)
        // Continue with deletion even if revocation fails
      }
    }

    // Mark account as inactive (soft delete)
    const { error: updateError } = await supabase
      .from('ad_accounts')
      .update({
        is_active: false,
        refresh_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId)

    if (updateError) {
      console.error('Failed to deactivate account:', updateError)
      return NextResponse.json(
        { error: 'Failed to disconnect account' },
        { status: 500, headers: securityHeaders }
      )
    }

    return NextResponse.json(
      { message: 'Account disconnected successfully' },
      { headers: securityHeaders }
    )
  } catch (error: any) {
    console.error('Disconnect error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500, headers: securityHeaders }
    )
  }
}
