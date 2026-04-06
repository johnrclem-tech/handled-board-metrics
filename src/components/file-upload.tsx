"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Trash2 } from "lucide-react"
import { useEffect } from "react"

interface UploadRecord {
  id: number
  fileName: string
  fileType: string
  uploadedAt: string
  recordCount: number
  status: string
}

interface FileUploadProps {
  onUploadComplete: () => void
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [reportType, setReportType] = useState("")
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [uploads, setUploads] = useState<UploadRecord[]>([])
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    fetchUploads()
  }, [])

  const fetchUploads = async () => {
    try {
      const response = await fetch("/api/uploads")
      const data = await response.json()
      setUploads(data.uploads || [])
    } catch (error) {
      console.error("Failed to fetch uploads:", error)
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (
        droppedFile.name.endsWith(".xlsx") ||
        droppedFile.name.endsWith(".xls") ||
        droppedFile.name.endsWith(".csv")
      ) {
        setFile(droppedFile)
        setResult(null)
      } else {
        setResult({ success: false, message: "Please upload an Excel file (.xlsx, .xls) or CSV file." })
      }
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file || !reportType) return

    setUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("reportType", reportType)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: `Successfully imported ${data.rowCount} records for period ${data.period}`,
        })
        setFile(null)
        setReportType("")
        fetchUploads()
        onUploadComplete()
      } else {
        setResult({ success: false, message: data.error || "Upload failed" })
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Upload failed",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleClearData = async () => {
    if (!confirm("Are you sure you want to delete all imported data? This cannot be undone.")) {
      return
    }

    try {
      const response = await fetch("/api/clear-data", { method: "POST" })
      const data = await response.json()

      if (response.ok) {
        setResult({ success: true, message: "All data cleared successfully" })
        setUploads([])
        onUploadComplete()
      } else {
        setResult({ success: false, message: data.error || "Failed to clear data" })
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to clear data",
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import QuickBooks Data</CardTitle>
          <CardDescription>
            Upload Excel spreadsheets exported from QuickBooks to populate your KPI dashboard.
            Supported formats: .xlsx, .xls, .csv
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop your QuickBooks export file here, or click to browse
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <Button variant="outline" asChild>
              <label htmlFor="file-upload" className="cursor-pointer">
                Choose File
              </label>
            </Button>
            {file && (
              <p className="mt-3 text-sm font-medium">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="report-type">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger id="report-type">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profit_loss">Profit & Loss</SelectItem>
                  <SelectItem value="balance_sheet">Balance Sheet</SelectItem>
                  <SelectItem value="cash_flow">Cash Flow Statement</SelectItem>
                  <SelectItem value="storage_revenue_by_customer">Monthly Storage Revenue by Customer</SelectItem>
                  <SelectItem value="shipping_revenue_by_customer">Monthly Shipping Revenue by Customer</SelectItem>
                  <SelectItem value="handling_revenue_by_customer">Monthly Handling Revenue by Customer</SelectItem>
                  <SelectItem value="expenses_by_vendor">Expenses by Vendor</SelectItem>
                  <SelectItem value="ar_aging">Accounts Receivable Aging</SelectItem>
                  <SelectItem value="ap_aging">Accounts Payable Aging</SelectItem>
                  <SelectItem value="leads">Leads</SelectItem>
                  <SelectItem value="opportunities">Opportunities</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleUpload}
                disabled={!file || !reportType || uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Import Data
                  </>
                )}
              </Button>
            </div>
          </div>

          {result && (
            <div
              className={`flex items-center gap-2 rounded-lg p-4 ${
                result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
              }`}
            >
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <p className="text-sm">{result.message}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {uploads.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upload History</CardTitle>
                <CardDescription>Previously imported files</CardDescription>
              </div>
              <Button variant="destructive" size="sm" onClick={handleClearData}>
                <Trash2 className="h-4 w-4" />
                Clear All Data
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Report Type</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell className="font-medium">{upload.fileName}</TableCell>
                    <TableCell>{upload.fileType.replace(/_/g, " ")}</TableCell>
                    <TableCell>{upload.recordCount}</TableCell>
                    <TableCell>
                      <Badge
                        variant={upload.status === "processed" ? "secondary" : "destructive"}
                      >
                        {upload.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(upload.uploadedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
