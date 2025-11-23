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

    console.log('OAuth tokens obtained successfully')

    // Get user info from Google
    const userInfo = await getUserInfo(tokens.access_token)
    console.log('Google user info:', userInfo.email)

    // Store the refresh token temporarily in a cookie for the manual connection step
    // This is more reliable than trying to auto-discover accounts
    const response = NextResponse.redirect(
      new URL('/dashboard/connect-account', request.url)
    )

    // Store refresh token in secure cookie (expires in 10 minutes)
    response.cookies.set('google_ads_refresh_token', encrypt(tokens.refresh_token), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    // Clear the OAuth state cookie
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
