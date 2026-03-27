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
      // Get the exact customer + calendar month pairs for this billing month
      const detailRes = await fetch(`/api/metrics/cohort-detail?month=${filter.billingMonth}`)
      const detailData = await detailRes.json()

      if (!detailData.customers || detailData.customers.length === 0) {
        setData([])
        setDrillLabel(filter.label)
        setLoading(false)
        return
      }

      // Build rows directly from cohort-detail which has exact per-customer amounts
      // This includes $0 customers (churned) who don't have database records
      interface CohortCustomer {
        customer: string
        firstBillingMonth: string
        calendarMonth: string
        storage: number
        shipping: number
        handling: number
        total: number
      }

      const customers: CohortCustomer[] = detailData.customers
      const rows: FinancialRecord[] = []
      let id = -1

      const categoriesToShow =
        filter.category === "all"
          ? ["storage", "shipping", "handling"] as const
          : filter.category === "Storage Revenue"
            ? ["storage"] as const
            : filter.category === "Shipping Revenue"
              ? ["shipping"] as const
              : ["handling"] as const

      const categoryLabels: Record<string, string> = {
        storage: "Storage Revenue",
        shipping: "Shipping Revenue",
        handling: "Handling Revenue",
      }

      for (const c of customers) {
        for (const cat of categoriesToShow) {
          rows.push({
            id: id--,
            reportType: `${cat}_revenue_by_customer`,
            period: c.calendarMonth,
            category: categoryLabels[cat],
            subcategory: `Started: ${c.firstBillingMonth}`,
            accountName: c.customer,
            amount: String(c[cat]),
          })
        }
      }

      // Sort: non-zero first, then by customer name
      rows.sort((a, b) => {
        const aAmt = Math.abs(parseFloat(a.amount))
        const bAmt = Math.abs(parseFloat(b.amount))
        if (aAmt > 0 && bAmt === 0) return -1
        if (aAmt === 0 && bAmt > 0) return 1
        return a.accountName.localeCompare(b.accountName)
      })

      const avgLabel = filter.category === "all" ? "Total" : filter.category
      const avg = detailData.averages
      const avgAmount = filter.category === "all"
        ? avg.total
        : filter.category === "Storage Revenue"
          ? avg.storage
          : filter.category === "Shipping Revenue"
            ? avg.shipping
            : avg.handling

      setData(rows)
      setPeriods([])
      setDrillLabel(
        `${filter.label} — ${detailData.customerCount} customers, avg ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(avgAmount)}`
      )
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
