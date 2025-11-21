/**
 * Email Service for Anomaly Alerts
 *
 * Sends email notifications when critical anomalies are detected
 * Uses Resend API for reliable delivery
 */

import { Resend } from 'resend'
import { env } from './env'
import { formatCurrency, formatNumber, formatPercent } from './utils'

const resend = env?.resend.apiKey ? new Resend(env.resend.apiKey) : null

interface AnomalyAlert {
  account_id: string
  date: string
  metric: string
  expected_value: number
  actual_value: number
  percent_change: number
  severity: 'WARNING' | 'CRITICAL'
  context_data?: any
  ai_explanation?: string
}

/**
 * Send email alerts for anomalies
 *
 * @param accountId - Account ID
 * @param userId - User ID to send email to
 * @param anomalies - List of anomalies to alert about
 */
export async function sendAnomalyAlerts(
  accountId: string,
  userId: string,
  anomalies: AnomalyAlert[]
): Promise<void> {
  if (!resend || !env?.resend.apiKey) {
    console.warn('Resend API key not configured, skipping email alert')
    return
  }

  if (anomalies.length === 0) return

  // Get account and user details
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const [accountResult, userResult] = await Promise.all([
    supabase.from('ad_accounts').select('account_name').eq('id', accountId).single(),
    supabase.auth.admin.getUserById(userId),
  ])

  const accountName = accountResult.data?.account_name || 'Unknown Account'
  const userEmail = userResult.data?.user?.email

  if (!userEmail) {
    console.error('User email not found, cannot send alert')
    return
  }

  // Group anomalies by severity
  const criticalAnomalies = anomalies.filter((a) => a.severity === 'CRITICAL')
  const warningAnomalies = anomalies.filter((a) => a.severity === 'WARNING')

  // Build email content
  const subject = `🚨 Alert: ${criticalAnomalies.length} Critical Anomal${criticalAnomalies.length === 1 ? 'y' : 'ies'} on ${accountName}`

  const html = buildEmailHTML(accountName, criticalAnomalies, warningAnomalies)

  try {
    await resend.emails.send({
      from: 'OneMetrik Alerts <alerts@onemetrik.com>', // You'll need to verify this domain in Resend
      to: userEmail,
      subject,
      html,
    })

    console.log(`Alert email sent to ${userEmail} for account ${accountName}`)
  } catch (error: any) {
    console.error('Failed to send alert email:', error)
    throw error
  }
}

/**
 * Build HTML email content
 */
function buildEmailHTML(
  accountName: string,
  criticalAnomalies: AnomalyAlert[],
  warningAnomalies: AnomalyAlert[]
): string {
  const formatMetricName = (metric: string) => {
    return metric
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatValue = (metric: string, value: number) => {
    if (metric === 'spend' || metric === 'cost_per_conversion' || metric === 'cpc') {
      return formatCurrency(value)
    } else if (metric === 'ctr') {
      return formatPercent(value)
    } else {
      return formatNumber(value)
    }
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #dc2626;
      margin: 0;
      font-size: 24px;
    }
    .account-name {
      font-size: 18px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 20px;
    }
    .anomaly {
      background-color: #fef2f2;
      border-left: 4px solid #dc2626;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 4px;
    }
    .anomaly.warning {
      background-color: #fffbeb;
      border-left-color: #f59e0b;
    }
    .anomaly-metric {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 8px;
    }
    .anomaly-details {
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
    }
    .anomaly-change {
      font-weight: bold;
      font-size: 18px;
      margin-bottom: 8px;
    }
    .anomaly-change.negative {
      color: #dc2626;
    }
    .anomaly-change.positive {
      color: #059669;
    }
    .explanation {
      background-color: #f0f9ff;
      border-left: 3px solid #2563eb;
      padding: 10px;
      margin-top: 10px;
      font-size: 14px;
      font-style: italic;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      margin-top: 20px;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 Performance Alert</h1>
    </div>

    <div class="account-name">
      ${accountName}
    </div>

    ${
      criticalAnomalies.length > 0
        ? `
      <h2 style="color: #dc2626; font-size: 18px; margin-bottom: 15px;">
        Critical Anomalies (${criticalAnomalies.length})
      </h2>
      ${criticalAnomalies
        .map(
          (anomaly) => `
        <div class="anomaly">
          <div class="anomaly-metric">
            ${formatMetricName(anomaly.metric)}
          </div>
          <div class="anomaly-details">
            <strong>Expected:</strong> ${formatValue(anomaly.metric, anomaly.expected_value)}<br>
            <strong>Actual:</strong> ${formatValue(anomaly.metric, anomaly.actual_value)}<br>
            <strong>Date:</strong> ${anomaly.date}
          </div>
          <div class="anomaly-change ${anomaly.percent_change < 0 ? 'negative' : 'positive'}">
            ${anomaly.percent_change > 0 ? '+' : ''}${anomaly.percent_change.toFixed(1)}% change
          </div>
          ${
            anomaly.ai_explanation
              ? `
            <div class="explanation">
              ${anomaly.ai_explanation}
            </div>
          `
              : ''
          }
        </div>
      `
        )
        .join('')}
    `
        : ''
    }

    ${
      warningAnomalies.length > 0
        ? `
      <h2 style="color: #f59e0b; font-size: 18px; margin-bottom: 15px; margin-top: 30px;">
        Warnings (${warningAnomalies.length})
      </h2>
      ${warningAnomalies
        .map(
          (anomaly) => `
        <div class="anomaly warning">
          <div class="anomaly-metric">
            ${formatMetricName(anomaly.metric)}
          </div>
          <div class="anomaly-details">
            <strong>Expected:</strong> ${formatValue(anomaly.metric, anomaly.expected_value)}<br>
            <strong>Actual:</strong> ${formatValue(anomaly.metric, anomaly.actual_value)}
          </div>
          <div class="anomaly-change ${anomaly.percent_change < 0 ? 'negative' : 'positive'}">
            ${anomaly.percent_change > 0 ? '+' : ''}${anomaly.percent_change.toFixed(1)}% change
          </div>
        </div>
      `
        )
        .join('')}
    `
        : ''
    }

    <div style="text-align: center;">
      <a href="${env?.app.url || 'https://app.onemetrik.com'}/dashboard" class="button">
        View Full Dashboard
      </a>
    </div>

    <div class="footer">
      <p>
        This is an automated alert from OneMetrik Command Center.<br>
        You're receiving this because significant changes were detected in your account.
      </p>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Send test email (for testing email configuration)
 */
export async function sendTestEmail(email: string): Promise<boolean> {
  if (!resend || !env?.resend.apiKey) {
    throw new Error('Resend API key not configured')
  }

  try {
    await resend.emails.send({
      from: 'OneMetrik Alerts <alerts@onemetrik.com>',
      to: email,
      subject: 'Test Email from OneMetrik',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1>Test Email</h1>
          <p>If you're reading this, your email configuration is working correctly!</p>
          <p>OneMetrik will send alerts to this email when anomalies are detected.</p>
        </div>
      `,
    })

    return true
  } catch (error: any) {
    console.error('Test email failed:', error)
    throw error
  }
}
