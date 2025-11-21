/**
 * Security utilities for token encryption and validation
 *
 * SECURITY MEASURES:
 * - AES-256-GCM encryption for OAuth tokens
 * - CSRF protection via Next.js built-in
 * - Rate limiting considerations
 * - Input sanitization helpers
 */

import crypto from 'crypto'
import { env } from './env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Derive encryption key from master key
 */
function deriveKey(salt: Buffer): Buffer {
  if (!env) throw new Error('Server environment not available')
  return crypto.pbkdf2Sync(
    env.security.encryptionKey,
    salt,
    100000,
    KEY_LENGTH,
    'sha512'
  )
}

/**
 * Encrypt sensitive data (OAuth tokens, etc.)
 *
 * @param text - Plain text to encrypt
 * @returns Encrypted string with salt, iv, tag, and ciphertext
 */
export function encrypt(text: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = deriveKey(salt)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag()

  // Format: salt:iv:tag:encrypted
  return [
    salt.toString('hex'),
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted,
  ].join(':')
}

/**
 * Decrypt sensitive data
 *
 * @param encryptedText - Encrypted string from encrypt()
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':')
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format')
  }

  const [saltHex, ivHex, tagHex, encrypted] = parts

  const salt = Buffer.from(saltHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const key = deriveKey(salt)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML brackets
    .trim()
    .slice(0, 1000) // Limit length
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Hash sensitive data for comparison (e.g., API keys)
 */
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Validate cron job authorization
 */
export function validateCronAuth(authHeader: string | null): boolean {
  if (!env) return false
  if (!authHeader) return false

  const expectedAuth = `Bearer ${env.security.cronSecret}`
  return authHeader === expectedAuth
}

/**
 * Rate limiting helper (simple in-memory implementation)
 * For production, use Redis or similar
 */
class RateLimiter {
  private attempts: Map<string, { count: number; resetAt: number }> = new Map()

  check(identifier: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now()
    const record = this.attempts.get(identifier)

    if (!record || now > record.resetAt) {
      this.attempts.set(identifier, {
        count: 1,
        resetAt: now + windowMs,
      })
      return true
    }

    if (record.count >= maxAttempts) {
      return false
    }

    record.count++
    return true
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier)
  }
}

export const rateLimiter = new RateLimiter()

/**
 * Security headers for API routes
 */
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}
