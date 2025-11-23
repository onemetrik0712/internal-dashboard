import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatNumber } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch user's connected accounts (excluding manager accounts)
  const { data: accounts } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('is_manager', false)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your Google Ads accounts and performance
          </p>
        </div>
        <Button asChild>
          <Link href="/api/google-ads/connect">
            <Plus className="mr-2 h-4 w-4" />
            Connect Account
          </Link>
        </Button>
      </div>

      {!accounts || accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No accounts connected</CardTitle>
            <CardDescription>
              Connect your first Google Ads account to start monitoring performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/api/google-ads/connect">
                <Plus className="mr-2 h-4 w-4" />
                Connect Google Ads Account
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  )
}

async function AccountCard({ account }: { account: any }) {
  const supabase = await createClient()

  // Fetch last 7 days of metrics
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: metrics } = await supabase
    .from('daily_metrics')
    .select('metrics')
    .eq('account_id', account.id)
    .gte('date', sevenDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })

  // Calculate totals
  let totalSpend = 0
  let totalConversions = 0

  if (metrics && metrics.length > 0) {
    metrics.forEach((m: any) => {
      if (m.metrics) {
        totalSpend += m.metrics.spend || 0
        totalConversions += m.metrics.conversions || 0
      }
    })
  }

  const costPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0
  const hasData = metrics && metrics.length > 0

  // Check for anomalies
  const { data: anomalies } = await supabase
    .from('anomalies')
    .select('severity')
    .eq('account_id', account.id)
    .eq('resolved', false)
    .gte('date', sevenDaysAgo.toISOString().split('T')[0])

  const hasCriticalAnomalies = anomalies?.some((a: any) => a.severity === 'CRITICAL')

  return (
    <Link href={`/dashboard/accounts/${account.id}`}>
      <Card className={`cursor-pointer transition-shadow hover:shadow-lg ${hasCriticalAnomalies ? 'border-red-300 bg-red-50/50' : ''}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{account.account_name}</CardTitle>
            <div className="flex gap-2">
              {hasCriticalAnomalies && (
                <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  Alert
                </span>
              )}
              <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                Active
              </span>
            </div>
          </div>
          <CardDescription>
            {account.platform.replace('_', ' ').toUpperCase()} • {account.customer_id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasData ? (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No data yet. Click to fetch data from Google Ads.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last 7 days spend</span>
                  <span className="font-medium">{formatCurrency(totalSpend)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Conversions</span>
                  <span className="font-medium">{formatNumber(totalConversions)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cost per conversion</span>
                  <span className="font-medium">
                    {costPerConversion > 0 ? formatCurrency(costPerConversion) : 'N/A'}
                  </span>
                </div>
              </div>

              {anomalies && anomalies.length > 0 && (
                <div className="flex items-center justify-between border-t pt-4 text-sm">
                  <span className="text-muted-foreground">Anomalies detected</span>
                  <span className="font-medium text-orange-600">{anomalies.length}</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
