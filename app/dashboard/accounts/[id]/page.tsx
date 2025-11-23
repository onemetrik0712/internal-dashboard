import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { redirect } from 'next/navigation'
import { formatCurrency, formatNumber } from '@/lib/utils'

export default async function AccountDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch account details
  const { data: account } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!account) {
    redirect('/dashboard')
  }

  // Fetch metrics for last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: metrics } = await supabase
    .from('daily_metrics')
    .select('*')
    .eq('account_id', account.id)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })

  // Calculate totals
  let totalSpend = 0
  let totalConversions = 0
  let totalClicks = 0
  let totalImpressions = 0

  if (metrics && metrics.length > 0) {
    metrics.forEach((m: any) => {
      if (m.metrics) {
        totalSpend += m.metrics.spend || 0
        totalConversions += m.metrics.conversions || 0
        totalClicks += m.metrics.clicks || 0
        totalImpressions += m.metrics.impressions || 0
      }
    })
  }

  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0
  const costPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0

  // Fetch anomalies
  const { data: anomalies } = await supabase
    .from('anomalies')
    .select('*')
    .eq('account_id', account.id)
    .eq('resolved', false)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })

  const handleRefresh = async () => {
    'use server'
    // This would trigger a data refresh - implement in next iteration
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{account.account_name}</h1>
          <p className="text-muted-foreground">
            {account.platform.replace('_', ' ').toUpperCase()} • {account.customer_id}
          </p>
        </div>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Spend (30d)</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalSpend)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conversions</CardDescription>
            <CardTitle className="text-2xl">{formatNumber(totalConversions)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cost per Conversion</CardDescription>
            <CardTitle className="text-2xl">
              {costPerConversion > 0 ? formatCurrency(costPerConversion) : 'N/A'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average CTR</CardDescription>
            <CardTitle className="text-2xl">
              {avgCtr > 0 ? `${avgCtr.toFixed(2)}%` : 'N/A'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Anomalies Section */}
      {anomalies && anomalies.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5 text-orange-600" />
                  Anomalies Detected
                </CardTitle>
                <CardDescription>
                  {anomalies.length} performance anomal{anomalies.length === 1 ? 'y' : 'ies'} in the last 30 days
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {anomalies.map((anomaly: any) => (
                <div
                  key={anomaly.id}
                  className={`rounded-lg border p-4 ${
                    anomaly.severity === 'CRITICAL'
                      ? 'border-red-200 bg-red-50'
                      : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                          anomaly.severity === 'CRITICAL' ? 'text-red-900' : 'text-yellow-900'
                        }`}>
                          {anomaly.metric.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          anomaly.severity === 'CRITICAL'
                            ? 'bg-red-200 text-red-800'
                            : 'bg-yellow-200 text-yellow-800'
                        }`}>
                          {anomaly.severity}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(anomaly.date).toLocaleDateString()} •{' '}
                        {anomaly.percent_change > 0 ? '+' : ''}
                        {anomaly.percent_change.toFixed(1)}% change
                      </div>
                      {anomaly.ai_explanation && (
                        <p className="mt-2 text-sm">{anomaly.ai_explanation}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data Message */}
      {(!metrics || metrics.length === 0) && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No data available</CardTitle>
            <CardDescription>
              Click "Refresh Data" to fetch your Google Ads performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Once data is fetched, you'll see detailed performance charts, campaign breakdowns, and more insights here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
