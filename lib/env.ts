/**
 * Environment Variable Validation and Type Safety
 *
 * SECURITY: This file validates all environment variables at build time
 * and provides type-safe access. Never expose server-side env vars to client.
 */

// Server-side only environment variables
function getServerEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('Server environment variables accessed on client side')
  }

  return {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      developerToken: process.env.GOOGLE_DEVELOPER_TOKEN || '',
    },
    ai: {
      provider: (process.env.AI_PROVIDER || 'claude') as 'claude' | 'gemini',
      anthropicKey: process.env.ANTHROPIC_API_KEY || '',
      geminiKey: process.env.GEMINI_API_KEY || '',
    },
    resend: {
      apiKey: process.env.RESEND_API_KEY || '',
    },
    security: {
      encryptionKey: process.env.ENCRYPTION_KEY!,
      cronSecret: process.env.CRON_SECRET!,
    },
    app: {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
  }
}

// Client-side safe environment variables
export function getClientEnv() {
  return {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    app: {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
  }
}

// Validate all required environment variables
export function validateEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'ENCRYPTION_KEY',
    'CRON_SECRET',
  ]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env.local file.'
    )
  }
}

// Export typed environment variables (server-side only)
export const env = typeof window === 'undefined' ? getServerEnv() : null

// Validate on module load (server-side only)
if (typeof window === 'undefined') {
  validateEnv()
}
