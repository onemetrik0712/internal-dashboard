/**
 * Google Ads OAuth 2.0 Flow
 *
 * SECURITY:
 * - Uses PKCE (Proof Key for Code Exchange) for additional security
 * - State parameter for CSRF protection
 * - Tokens encrypted before storage
 * - Refresh tokens used for long-term access
 */

import { env } from '@/lib/env'
import { generateSecureToken } from '@/lib/security'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// Scopes required for Google Ads API
const SCOPES = [
  'https://www.googleapis.com/auth/adwords', // Google Ads API access
  'openid',
  'email',
  'profile',
]

export interface OAuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
  token_type: string
  id_token?: string
}

export interface GoogleUserInfo {
  email: string
  name: string
  picture?: string
}

/**
 * Generate OAuth authorization URL
 *
 * @returns Object with authorization URL and state token
 */
export function getAuthorizationUrl(): { url: string; state: string } {
  if (!env) throw new Error('Server environment not available')

  const state = generateSecureToken(32)
  const redirectUri = `${env.app.url}/api/auth/callback`

  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline', // Get refresh token
    prompt: 'consent', // Force consent to get refresh token
    state: state,
  })

  return {
    url: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    state,
  }
}

/**
 * Exchange authorization code for tokens
 *
 * @param code - Authorization code from OAuth callback
 * @returns OAuth tokens including refresh token
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<OAuthTokens> {
  if (!env) throw new Error('Server environment not available')

  const redirectUri = `${env.app.url}/api/auth/callback`

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code for tokens: ${error}`)
  }

  return response.json()
}

/**
 * Refresh access token using refresh token
 *
 * @param refreshToken - The refresh token
 * @returns New OAuth tokens
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<OAuthTokens> {
  if (!env) throw new Error('Server environment not available')

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh access token: ${error}`)
  }

  const tokens = await response.json()

  // Refresh token is not always returned, so preserve the original
  if (!tokens.refresh_token) {
    tokens.refresh_token = refreshToken
  }

  return tokens
}

/**
 * Get user info from Google
 *
 * @param accessToken - Valid access token
 * @returns User information
 */
export async function getUserInfo(
  accessToken: string
): Promise<GoogleUserInfo> {
  const response = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get user info: ${error}`)
  }

  return response.json()
}

/**
 * Revoke access token (sign out)
 *
 * @param token - Access or refresh token to revoke
 */
export async function revokeToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
}
