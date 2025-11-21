/**
 * AI-Powered Insights Service
 *
 * Supports both Claude (Anthropic) and Gemini (Google) APIs
 * Generates explanations for detected anomalies
 */

import { env } from './env'
import Anthropic from '@anthropic-ai/sdk'

interface AnomalyContext {
  account_name: string
  date: string
  metric: string
  expected_value: number
  actual_value: number
  percent_change: number
  device_data?: any
  top_campaigns?: Array<{
    name: string
    spend: number
    conversions: number
  }>
}

/**
 * Generate AI explanation using Claude API
 */
async function generateClaudeExplanation(
  context: AnomalyContext
): Promise<string> {
  if (!env?.ai.anthropicKey) {
    throw new Error('Anthropic API key not configured')
  }

  const anthropic = new Anthropic({
    apiKey: env.ai.anthropicKey,
  })

  const metricName = context.metric.replace(/_/g, ' ')
  const changeDirection = context.percent_change > 0 ? 'increased' : 'decreased'
  const changeAbs = Math.abs(context.percent_change).toFixed(1)

  const prompt = `You are a Google Ads performance analyst. An anomaly was detected:

Account: ${context.account_name}
Date: ${context.date}
Metric: ${metricName}
Expected (based on last week): ${context.expected_value.toFixed(2)}
Actual: ${context.actual_value.toFixed(2)}
Change: ${changeDirection} by ${changeAbs}%

${
  context.device_data
    ? `Device breakdown:
${JSON.stringify(context.device_data, null, 2)}`
    : ''
}

${
  context.top_campaigns && context.top_campaigns.length > 0
    ? `Top campaigns by spend:
${context.top_campaigns
  .map(
    (c, i) =>
      `${i + 1}. ${c.name}: $${c.spend.toFixed(2)} spend, ${c.conversions} conversions`
  )
  .join('\n')}`
    : ''
}

Write a 2-3 sentence explanation of what likely caused this change. Be specific and actionable. Don't hedge with "might" or "could be" - give your best assessment based on the data.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const textContent = message.content.find((block) => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    return textContent.text.trim()
  } catch (error: any) {
    console.error('Claude API error:', error)
    throw new Error(`Failed to generate explanation: ${error.message}`)
  }
}

/**
 * Generate AI explanation using Gemini API
 */
async function generateGeminiExplanation(
  context: AnomalyContext
): Promise<string> {
  if (!env?.ai.geminiKey) {
    throw new Error('Gemini API key not configured')
  }

  const metricName = context.metric.replace(/_/g, ' ')
  const changeDirection = context.percent_change > 0 ? 'increased' : 'decreased'
  const changeAbs = Math.abs(context.percent_change).toFixed(1)

  const prompt = `You are a Google Ads performance analyst. An anomaly was detected:

Account: ${context.account_name}
Date: ${context.date}
Metric: ${metricName}
Expected (based on last week): ${context.expected_value.toFixed(2)}
Actual: ${context.actual_value.toFixed(2)}
Change: ${changeDirection} by ${changeAbs}%

${
  context.device_data
    ? `Device breakdown:
${JSON.stringify(context.device_data, null, 2)}`
    : ''
}

${
  context.top_campaigns && context.top_campaigns.length > 0
    ? `Top campaigns by spend:
${context.top_campaigns
  .map(
    (c, i) =>
      `${i + 1}. ${c.name}: $${c.spend.toFixed(2)} spend, ${c.conversions} conversions`
  )
  .join('\n')}`
    : ''
}

Write a 2-3 sentence explanation of what likely caused this change. Be specific and actionable. Don't hedge with "might" or "could be" - give your best assessment based on the data.`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${env.ai.geminiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gemini API error: ${error}`)
    }

    const data = await response.json()

    if (
      !data.candidates ||
      !data.candidates[0] ||
      !data.candidates[0].content ||
      !data.candidates[0].content.parts ||
      !data.candidates[0].content.parts[0]
    ) {
      throw new Error('Invalid response from Gemini API')
    }

    return data.candidates[0].content.parts[0].text.trim()
  } catch (error: any) {
    console.error('Gemini API error:', error)
    throw new Error(`Failed to generate explanation: ${error.message}`)
  }
}

/**
 * Generate AI explanation for an anomaly
 *
 * Automatically selects the configured AI provider (Claude or Gemini)
 *
 * @param context - Anomaly context data
 * @returns AI-generated explanation
 */
export async function generateAnomalyExplanation(
  context: AnomalyContext
): Promise<string> {
  if (!env) {
    throw new Error('Server environment not available')
  }

  const provider = env.ai.provider

  try {
    if (provider === 'claude') {
      return await generateClaudeExplanation(context)
    } else if (provider === 'gemini') {
      return await generateGeminiExplanation(context)
    } else {
      throw new Error(`Unsupported AI provider: ${provider}`)
    }
  } catch (error: any) {
    // Fallback to a generic explanation if AI fails
    console.error('AI explanation generation failed:', error)

    const metricName = context.metric.replace(/_/g, ' ')
    const changeDirection = context.percent_change > 0 ? 'increased' : 'decreased'
    const changeAbs = Math.abs(context.percent_change).toFixed(1)

    return `The ${metricName} ${changeDirection} by ${changeAbs}% compared to last week. This significant change warrants investigation to understand the underlying cause and take appropriate action.`
  }
}

/**
 * Generate AI explanations for all anomalies without explanations
 */
export async function generateExplanationsForPendingAnomalies(): Promise<number> {
  if (!env) throw new Error('Server environment not available')

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Fetch anomalies without AI explanations
  const { data: anomalies, error } = await supabase
    .from('anomalies')
    .select(`
      id,
      metric,
      expected_value,
      actual_value,
      percent_change,
      date,
      context_data,
      ad_accounts (
        account_name
      )
    `)
    .is('ai_explanation', null)
    .limit(50) // Process in batches

  if (error || !anomalies || anomalies.length === 0) {
    return 0
  }

  let processedCount = 0

  for (const anomaly of anomalies) {
    try {
      const context: AnomalyContext = {
        account_name: (anomaly.ad_accounts as any)?.account_name || 'Unknown Account',
        date: anomaly.date,
        metric: anomaly.metric,
        expected_value: anomaly.expected_value,
        actual_value: anomaly.actual_value,
        percent_change: anomaly.percent_change,
        device_data: anomaly.context_data?.device_data,
        top_campaigns: anomaly.context_data?.top_campaigns,
      }

      const explanation = await generateAnomalyExplanation(context)

      // Update anomaly with explanation
      await supabase
        .from('anomalies')
        .update({ ai_explanation: explanation })
        .eq('id', anomaly.id)

      processedCount++

      // Rate limiting: wait 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`Failed to generate explanation for anomaly ${anomaly.id}:`, error)
    }
  }

  return processedCount
}

/**
 * Generate report summary using AI
 */
export async function generateReportSummary(reportData: {
  account_name: string
  date_range: { start: string; end: string }
  key_metrics: {
    spend: number
    conversions: number
    cost_per_conversion: number
    ctr: number
  }
  comparison: {
    spend_change: number
    conversions_change: number
  }
  top_campaigns: Array<{ name: string; roas: number }>
  anomalies_count: number
}): Promise<string> {
  if (!env) throw new Error('Server environment not available')

  const prompt = `You are writing an executive summary for a Google Ads performance report.

Account: ${reportData.account_name}
Period: ${reportData.date_range.start} to ${reportData.date_range.end}

Key Metrics:
- Total Spend: $${reportData.key_metrics.spend.toFixed(2)}
- Conversions: ${reportData.key_metrics.conversions}
- Cost per Conversion: $${reportData.key_metrics.cost_per_conversion.toFixed(2)}
- CTR: ${reportData.key_metrics.ctr.toFixed(2)}%

vs. Previous Period:
- Spend: ${reportData.comparison.spend_change > 0 ? '+' : ''}${reportData.comparison.spend_change.toFixed(1)}%
- Conversions: ${reportData.comparison.conversions_change > 0 ? '+' : ''}${reportData.comparison.conversions_change.toFixed(1)}%

Top Performing Campaigns (by ROAS):
${reportData.top_campaigns
  .slice(0, 3)
  .map((c, i) => `${i + 1}. ${c.name}: ${c.roas.toFixed(2)}x ROAS`)
  .join('\n')}

Anomalies Detected: ${reportData.anomalies_count}

Write a 3-4 sentence executive summary that highlights the most important insights and any actions that should be taken. Be concise and focus on business impact.`

  try {
    if (env.ai.provider === 'claude' && env.ai.anthropicKey) {
      const anthropic = new Anthropic({ apiKey: env.ai.anthropicKey })
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      })
      const textContent = message.content.find((block) => block.type === 'text')
      return textContent && textContent.type === 'text' ? textContent.text.trim() : ''
    } else if (env.ai.provider === 'gemini' && env.ai.geminiKey) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${env.ai.geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
          }),
        }
      )
      const data = await response.json()
      return data.candidates[0]?.content?.parts[0]?.text.trim() || ''
    }
  } catch (error) {
    console.error('Failed to generate report summary:', error)
  }

  // Fallback summary
  return `Account performance for ${reportData.date_range.start} to ${reportData.date_range.end} shows $${reportData.key_metrics.spend.toFixed(2)} in spend with ${reportData.key_metrics.conversions} conversions. ${reportData.anomalies_count > 0 ? `${reportData.anomalies_count} anomalies detected require attention.` : 'Performance is stable with no major anomalies.'}`
}
