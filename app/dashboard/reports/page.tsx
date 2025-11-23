import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Download, Calendar } from 'lucide-react'
import { formatDistance } from 'date-fns'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch user's reports
  const { data: reports } = await supabase
    .from('reports')
    .select(`
      *,
      ad_accounts (
        account_name,
        customer_id
      )
    `)
    .eq('generated_by', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          View and download your generated performance reports
        </p>
      </div>

      {!reports || reports.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No reports yet</CardTitle>
            <CardDescription>
              Reports will appear here once you generate them from your account pages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <FileText className="mr-2 h-5 w-5" />
              <span>Generate your first report to see it here</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report: any) => (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {report.ad_accounts?.account_name || 'Unknown Account'}
                    </CardTitle>
                    <CardDescription>
                      {report.ad_accounts?.customer_id || 'N/A'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                      {report.report_type.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="mr-2 h-4 w-4" />
                      <span>
                        {new Date(report.date_range_start).toLocaleDateString()} -{' '}
                        {new Date(report.date_range_end).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Generated {formatDistance(new Date(report.created_at), new Date(), { addSuffix: true })}
                    </div>
                  </div>
                  {report.file_url ? (
                    <a
                      href={report.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Processing...
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
