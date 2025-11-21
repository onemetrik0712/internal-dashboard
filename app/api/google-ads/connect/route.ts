/**
 * Initiate Google Ads OAuth Flow
 *
 * GET /api/google-ads/connect
 *
 * SECURITY:
 * - Requires authenticated user
 * - Generates secure state token for CSRF protection
 * - State token stored in HTTP-only cookie
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthorizationUrl } from '@/lib/google-ads/oauth'
import { securityHeaders } from '@/lib/security'

export async function GET(request: NextRequest) {
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

    // Generate authorization URL with state token
    const { url, state } = getAuthorizationUrl()

    // Create response with redirect
    const response = NextResponse.redirect(url)

    // Store state in HTTP-only cookie for verification in callback
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    // Add security headers
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error: any) {
    console.error('OAuth initiation error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500, headers: securityHeaders }
    )
  }
}
