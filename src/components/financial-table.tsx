"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Package, X } from "lucide-react"
import type { CohortDrillFilter } from "@/components/dashboard"

interface FinancialRecord {
  id: number
  reportType: string
  period: string
  category: string
  subcategory: string | null
  accountName: string
  amount: string
}

interface FinancialTableProps {
  drillFilter?: CohortDrillFilter | null
  onClearDrill?: () => void
}

export function FinancialTable({ drillFilter, onClearDrill }: FinancialTableProps) {
  const [data, setData] = useState<FinancialRecord[]>([])
  const [periods, setPeriods] = useState<string[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")
  const [selectedType, setSelectedType] = useState<string>("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [drillLabel, setDrillLabel] = useState<string | null>(null)

  useEffect(() => {
    if (drillFilter) {
      fetchDrillData(drillFilter)
    } else {
      setDrillLabel(null)
      fetchData()
    }
  }, [drillFilter, selectedPeriod, selectedType])

  const fetchDrillData = async (filter: CohortDrillFilter) => {
    setLoading(true)
    try {
      // Get the customer list for this billing month from cohort-detail
      const detailRes = await fetch(`/api/metrics/cohort-detail?month=${filter.billingMonth}`)
      const detailData = await detailRes.json()

      if (!detailData.customers || detailData.customers.length === 0) {
        setData([])
        setDrillLabel(filter.label)
        setLoading(false)
        return
      }

      // Get the calendar months these customers map to
      const customerNames = detailData.customers.map((c: { customer: string }) => c.customer)
      const calendarMonths = [...new Set(detailData.customers.map((c: { calendarMonth: string }) => c.calendarMonth))] as string[]

      // Build query params
      const params = new URLSearchParams()
      params.set("customers", customerNames.join(","))
      params.set("periods", calendarMonths.join(","))

      // Filter by specific category unless "total" (show all 3)
      if (filter.category !== "all") {
        params.set("category", filter.category)
      } else {
        params.set("category", "Storage Revenue,Shipping Revenue,Handling Revenue")
      }

      const response = await fetch(`/api/metrics?${params}`)
      const result = await response.json()
      setData(result.details || [])
      setPeriods(result.periods || [])
      setDrillLabel(filter.label)
    } catch (error) {
      console.error("Failed to fetch drill data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedPeriod) params.set("period", selectedPeriod)
      if (selectedType && selectedType !== "all") params.set("reportType", selectedType)

      const response = await fetch(`/api/metrics?${params}`)
      const result = await response.json()
      setData(result.details || [])
      setPeriods(result.periods || [])

      if (!selectedPeriod && result.periods?.length > 0) {
        setSelectedPeriod(result.periods[0])
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleClearDrill = () => {
    setDrillLabel(null)
    onClearDrill?.()
  }

  const filteredData = data.filter((row) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      row.accountName.toLowerCase().includes(searchLower) ||
      row.category.toLowerCase().includes(searchLower) ||
      (row.subcategory && row.subcategory.toLowerCase().includes(searchLower))
    )
  })

  const formatCurrency = (value: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(parseFloat(value))

  if (loading) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          Loading financial data...
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0 && !selectedPeriod && !drillLabel) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No financial data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Import QuickBooks data from the Import Data tab to get started
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Financial Data</CardTitle>
            <CardDescription>
              {drillLabel
                ? `Showing records for: ${drillLabel}`
                : "Detailed financial records from imported data"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {drillLabel ? (
              <Button variant="outline" size="sm" onClick={handleClearDrill} className="gap-1">
                <X className="h-4 w-4" />
                Clear Filter
              </Button>
            ) : (
              <>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((period) => (
                      <SelectItem key={period} value={period}>
                        {period}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="profit_loss">Profit & Loss</SelectItem>
                    <SelectItem value="balance_sheet">Balance Sheet</SelectItem>
                    <SelectItem value="cash_flow">Cash Flow</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Badge variant="outline">{row.category}</Badge>
                  {row.subcategory && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {row.subcategory}
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{row.accountName}</TableCell>
                <TableCell>{row.period}</TableCell>
                <TableCell
                  className={`text-right font-mono ${
                    parseFloat(row.amount) < 0 ? "text-red-600" : ""
                  }`}
                >
                  {formatCurrency(row.amount)}
                </TableCell>
              </TableRow>
            ))}
            {filteredData.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  {search ? "No matching records found" : drillLabel ? "No records for this cohort filter" : "No data for selected filters"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
