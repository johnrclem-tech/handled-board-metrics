"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload, CheckCircle, AlertCircle, Loader2, Trash2 } from "lucide-react"

interface ReportStatus {
  reportType: string
  recordCount: number
  lastUpload: string | null
  latestDate: string | null
}

const REPORT_CONFIG: { type: string; name: string; source: string }[] = [
  { type: "storage_revenue_by_customer", name: "Monthly Storage Revenue by Customer", source: "QuickBooks" },
  { type: "shipping_revenue_by_customer", name: "Monthly Shipping Revenue by Customer", source: "QuickBooks" },
  { type: "handling_revenue_by_customer", name: "Monthly Handling Revenue by Customer", source: "QuickBooks" },
  { type: "ad_group_performance", name: "Ad Group Performance", source: "Google AdSense" },
  { type: "ad_campaign_performance", name: "Ad Campaign Performance", source: "Google AdSense" },
  { type: "leads", name: "Leads", source: "Zoho" },
  { type: "opportunities", name: "Opportunities", source: "Zoho" },
]

const SOURCE_COLORS: Record<string, string> = {
  QuickBooks: "bg-green-100 text-green-800",
  "Google AdSense": "bg-blue-100 text-blue-800",
  Zoho: "bg-purple-100 text-purple-800",
}

interface FileUploadProps {
  onUploadComplete: () => void
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [reports, setReports] = useState<ReportStatus[]>([])
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const [deletingType, setDeletingType] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const fetchReportStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/report-status")
      const data = await res.json()
      setReports(data.reports || [])
    } catch (err) {
      console.error("Failed to fetch report status:", err)
    }
  }, [])

  useEffect(() => {
    fetchReportStatus()
  }, [fetchReportStatus])

  const getStatus = (type: string): ReportStatus | undefined =>
    reports.find((r) => r.reportType === type)

  const handleImport = async (reportType: string, file: File) => {
    setUploadingType(reportType)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("reportType", reportType)
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()
      if (res.ok) {
        setResult({
          success: true,
          message: data.period
            ? `Successfully imported ${data.rowCount} records for period ${data.period}`
            : `Successfully imported ${data.rowCount} records`,
        })
        fetchReportStatus()
        onUploadComplete()
      } else {
        setResult({ success: false, message: data.error || "Upload failed" })
      }
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Upload failed" })
    } finally {
      setUploadingType(null)
    }
  }

  const handleDelete = async (reportType: string, reportName: string) => {
    if (!confirm(`Delete all ${reportName} data? This cannot be undone.`)) return
    setDeletingType(reportType)
    setResult(null)
    try {
      const res = await fetch("/api/clear-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ success: true, message: data.message })
        fetchReportStatus()
        onUploadComplete()
      } else {
        setResult({ success: false, message: data.error || "Delete failed" })
      }
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Delete failed" })
    } finally {
      setDeletingType(null)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—"
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
          <CardDescription>Manage imported data across all report types</CardDescription>
        </CardHeader>
        <CardContent>
          {result && (
            <div
              className={`flex items-center gap-2 rounded-lg p-4 mb-4 ${
                result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
              }`}
            >
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              )}
              <p className="text-sm">{result.message}</p>
            </div>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead>Latest Record</TableHead>
                  <TableHead>Last Upload</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {REPORT_CONFIG.map((cfg) => {
                  const status = getStatus(cfg.type)
                  const count = status?.recordCount || 0
                  const isUploading = uploadingType === cfg.type
                  const isDeleting = deletingType === cfg.type
                  return (
                    <TableRow key={cfg.type}>
                      <TableCell className="font-medium whitespace-nowrap">{cfg.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={SOURCE_COLORS[cfg.source] || ""}>
                          {cfg.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{count.toLocaleString()}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(status?.latestDate ?? null)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(status?.lastUpload ?? null)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            ref={(el) => { fileInputRefs.current[cfg.type] = el }}
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) handleImport(cfg.type, f)
                              e.target.value = ""
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUploading || isDeleting}
                            onClick={() => fileInputRefs.current[cfg.type]?.click()}
                            className="gap-1"
                          >
                            {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                            Import
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={count === 0 || isUploading || isDeleting}
                            onClick={() => handleDelete(cfg.type, cfg.name)}
                            className="gap-1"
                          >
                            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
