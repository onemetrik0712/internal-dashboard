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

  // Fetch user's connected accounts
  const { data: accounts } = await supabase
    .from('ad_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
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
  // In a real implementation, we'd fetch the last 7 days of metrics here
  // For now, we'll show placeholder data

  return (
    <Link href={`/dashboard/accounts/${account.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{account.account_name}</CardTitle>
            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
              Active
            </span>
          </div>
          <CardDescription>
            {account.platform.replace('_', ' ').toUpperCase()} • {account.customer_id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last 7 days spend</span>
              <span className="font-medium">{formatCurrency(0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Conversions</span>
              <span className="font-medium">{formatNumber(0)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Cost per conversion</span>
              <span className="font-medium">{formatCurrency(0)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-4 text-sm">
            <span className="text-muted-foreground">vs. previous period</span>
            <div className="flex items-center space-x-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-600">0%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
