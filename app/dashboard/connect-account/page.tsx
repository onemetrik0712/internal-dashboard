'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function ConnectAccountPage() {
  const router = useRouter()
  const [customerId, setCustomerId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/google-ads/complete-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customerId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect account')
      }

      // Success! Redirect to dashboard
      router.push('/dashboard?success=' + encodeURIComponent('Google Ads account connected successfully!'))
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to connect account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Connect Your Google Ads Account</CardTitle>
          <CardDescription>
            Enter your Google Ads Customer ID to complete the connection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerId">Google Ads Customer ID</Label>
                <Input
                  id="customerId"
                  type="text"
                  placeholder="123-456-7890 or 1234567890"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  disabled={loading}
                  className="font-mono"
                />
                <p className="text-sm text-muted-foreground">
                  Enter your 10-digit Customer ID with or without dashes
                </p>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <h4 className="font-medium text-sm">Where to find your Customer ID:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Go to <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">ads.google.com</a></li>
                  <li>Sign in with the Google account you just authorized</li>
                  <li>Look in the top right corner of the page</li>
                  <li>Your Customer ID is displayed as a 10-digit number (e.g., 123-456-7890)</li>
                  <li>If you have multiple accounts, select the one you want to connect</li>
                </ol>
              </div>

              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-2">
                <h4 className="font-medium text-sm text-yellow-900">Manager Accounts (MCC):</h4>
                <p className="text-sm text-yellow-800">
                  If you have a Manager Account (MCC), you can enter its Customer ID here.
                  You'll be able to see all sub-accounts managed by this MCC.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Connecting...' : 'Connect Account'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard')}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
