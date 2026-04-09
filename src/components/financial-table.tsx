"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Package, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Check, ChevronsUpDown } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import type { CohortDrillFilter } from "@/components/dashboard"
import { cn } from "@/lib/utils"

interface FinancialRecord {
  id: number
  reportType: string
  period: string
  category: string
  subcategory: string | null
  accountName: string
  amount: string
}

type SortField = "accountName" | "category" | "period" | "amount"
type SortDir = "asc" | "desc"

const PAGE_SIZE = 250

interface FinancialTableProps {
  drillFilter?: CohortDrillFilter | null
  onClearDrill?: () => void
}

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  width = "w-[200px]",
}: {
  options: string[]
  selected: Set<string>
  onChange: (selected: Set<string>) => void
  placeholder: string
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const allSelected = selected.size === 0 || selected.size === options.length
  const label = allSelected
    ? `All ${placeholder}`
    : selected.size === 1
      ? [...selected][0]
      : `${selected.size} selected`

  const toggle = (value: string) => {
    const next = new Set(selected)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    // If all are selected, clear to mean "all"
    if (next.size === options.length) {
      onChange(new Set())
    } else {
      onChange(next)
    }
  }

  const selectAll = () => {
    onChange(new Set())
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        role="combobox"
        className={cn("justify-between text-sm font-normal", width)}
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          <div
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={selectAll}
          >
            <div className={cn("flex h-4 w-4 items-center justify-center rounded-sm border", allSelected ? "bg-primary border-primary" : "border-input")}>
              {allSelected && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            All
          </div>
          <div className="max-h-60 overflow-auto">
            {options.map((opt) => {
              const isSelected = selected.has(opt)
              return (
                <div
                  key={opt}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() => toggle(opt)}
                >
                  <div className={cn("flex h-4 w-4 items-center justify-center rounded-sm border", isSelected ? "bg-primary border-primary" : "border-input")}>
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  {opt}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

type TableView = "raw" | "ltv"

interface LtvRow {
  customer: string
  total: number
  billingMonths: Map<number, number | null> // billing month number (1-based) -> revenue, null = not yet reached
  isAverage?: boolean
}

export function FinancialTable({ drillFilter, onClearDrill }: FinancialTableProps) {
  const [data, setData] = useState<FinancialRecord[]>([])
  const [allPeriods, setAllPeriods] = useState<string[]>([])
  const [allCategories, setAllCategories] = useState<string[]>([])
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set())
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [drillLabel, setDrillLabel] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>("accountName")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [page, setPage] = useState(1)
  const [tableView, setTableView] = useState<TableView>("raw")

  useEffect(() => {
    if (drillFilter) {
      fetchDrillData(drillFilter)
    } else {
      setDrillLabel(null)
      fetchAllData()
    }
  }, [drillFilter])

  const fetchDrillData = async (filter: CohortDrillFilter) => {
    setLoading(true)
    try {
      const detailRes = await fetch(`/api/metrics/cohort-detail?month=${filter.billingMonth}`)
      const detailData = await detailRes.json()

      if (!detailData.customers || detailData.customers.length === 0) {
        setData([])
        setDrillLabel(filter.label)
        setLoading(false)
        return
      }

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

      rows.sort((a, b) => {
        const aAmt = Math.abs(parseFloat(a.amount))
        const bAmt = Math.abs(parseFloat(b.amount))
        if (aAmt > 0 && bAmt === 0) return -1
        if (aAmt === 0 && bAmt > 0) return 1
        return a.accountName.localeCompare(b.accountName)
      })

      const avg = detailData.averages
      const avgAmount = filter.category === "all"
        ? avg.total
        : filter.category === "Storage Revenue"
          ? avg.storage
          : filter.category === "Shipping Revenue"
            ? avg.shipping
            : avg.handling

      setData(rows)
      setAllPeriods([])
      setAllCategories([])
      setPage(1)
      setDrillLabel(
        `${filter.label} — ${detailData.customerCount} customers, avg ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(avgAmount)}`
      )
    } catch (error) {
      console.error("Failed to fetch drill data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/metrics")
      const result = await response.json()
      setData(result.details || [])
      setAllPeriods(result.periods || [])

      const cats = [...new Set((result.details || []).map((r: FinancialRecord) => r.category))].sort() as string[]
      setAllCategories(cats)
      setPage(1)
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
    setPage(1)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

  const filtered = useMemo(() => {
    let result = data

    // Filter by selected periods (empty set = all)
    if (selectedPeriods.size > 0) {
      result = result.filter((row) => selectedPeriods.has(row.period))
    }

    // Filter by selected categories (empty set = all)
    if (selectedCategories.size > 0) {
      result = result.filter((row) => selectedCategories.has(row.category))
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        (row) =>
          row.accountName.toLowerCase().includes(searchLower) ||
          row.category.toLowerCase().includes(searchLower) ||
          (row.subcategory && row.subcategory.toLowerCase().includes(searchLower))
      )
    }

    // Sort
    return [...result].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      switch (sortField) {
        case "accountName":
          return dir * a.accountName.localeCompare(b.accountName)
        case "category":
          return dir * a.category.localeCompare(b.category)
        case "period":
          return dir * a.period.localeCompare(b.period)
        case "amount":
          return dir * (parseFloat(a.amount) - parseFloat(b.amount))
        default:
          return 0
      }
    })
  }, [data, selectedPeriods, selectedCategories, search, sortField, sortDir])

  // LTV pivot: new customers only, normalized billing months, $0 for churned, null for not-yet-reached
  const { ltvRows, ltvMaxMonth, ltvAverageRow } = useMemo(() => {
    // Build per-customer per-calendar-period revenue from ALL data (not filtered)
    const customerCalendarMap = new Map<string, Map<string, number>>()
    const customerCategorySet = new Map<string, Set<string>>()

    for (const row of data) {
      if (!customerCalendarMap.has(row.accountName)) {
        customerCalendarMap.set(row.accountName, new Map())
        customerCategorySet.set(row.accountName, new Set())
      }
      const periods = customerCalendarMap.get(row.accountName)!
      const amt = parseFloat(row.amount)
      periods.set(row.period, (periods.get(row.period) || 0) + amt)
      if (amt > 0) customerCategorySet.get(row.accountName)!.add(row.category)
    }

    // Exclude pre-existing customers (revenue > 0 in Sep 2024) — new customers only
    for (const [customer, calPeriods] of customerCalendarMap) {
      const sep = calPeriods.get("2024-09") || 0
      if (sep > 0) customerCalendarMap.delete(customer)
    }

    // Apply search filter
    let customerKeys = [...customerCalendarMap.keys()]
    if (search) {
      const q = search.toLowerCase()
      customerKeys = customerKeys.filter((c) => c.toLowerCase().includes(q))
    }

    // Helper
    function monthOffset(base: string, target: string): number {
      const [by, bm] = base.split("-").map(Number)
      const [ty, tm] = target.split("-").map(Number)
      return (ty - by) * 12 + (tm - bm)
    }

    // Find global latest period
    let globalLatest = ""
    for (const calPeriods of customerCalendarMap.values()) {
      for (const p of calPeriods.keys()) {
        if (p > globalLatest) globalLatest = p
      }
    }

    // Normalize to billing months
    let maxMonth = 0
    const rows: LtvRow[] = []

    for (const customer of customerKeys) {
      const calPeriods = customerCalendarMap.get(customer)!

      // Find first period with revenue > 0
      const sortedPeriods = [...calPeriods.keys()].sort()
      let firstPeriod: string | null = null
      for (const p of sortedPeriods) {
        if ((calPeriods.get(p) || 0) > 0) { firstPeriod = p; break }
      }
      if (!firstPeriod) continue

      // Total billing months from first period to global latest
      const totalBillingMonths = monthOffset(firstPeriod, globalLatest) + 1
      if (totalBillingMonths > maxMonth) maxMonth = totalBillingMonths

      // Check if customer is churned (no revenue in latest period)
      const latestRev = calPeriods.get(globalLatest) || 0
      const isChurned = latestRev <= 0

      // Find last period with revenue > 0
      let lastRevBillingMonth = 0
      for (const [period, amount] of calPeriods) {
        if (amount > 0) {
          const bm = monthOffset(firstPeriod, period) + 1
          if (bm > lastRevBillingMonth) lastRevBillingMonth = bm
        }
      }

      const billingMonths = new Map<number, number | null>()
      let total = 0

      for (let bm = 1; bm <= totalBillingMonths; bm++) {
        // Generate the calendar period for this billing month
        const [fy, fm] = firstPeriod.split("-").map(Number)
        const d = new Date(fy, fm - 1 + (bm - 1), 1)
        const calPeriod = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        const rev = calPeriods.get(calPeriod) || 0

        if (rev > 0) {
          billingMonths.set(bm, rev)
          total += rev
        } else if (isChurned && bm > lastRevBillingMonth) {
          // Customer has churned and this is after their last revenue — show $0
          billingMonths.set(bm, 0)
        } else if (bm <= lastRevBillingMonth) {
          // Gap month before last revenue — show $0
          billingMonths.set(bm, 0)
        } else {
          // Not yet reached (still active, just hasn't hit this month yet)
          billingMonths.set(bm, null)
        }
      }

      rows.push({ customer, total, billingMonths })
    }

    // Sort
    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1
      if (sortField === "amount") return dir * (a.total - b.total)
      return dir * a.customer.localeCompare(b.customer)
    })

    // Compute average row (matching cohort-revenue: include all customers for each billing month)
    const avgMonths = new Map<number, { sum: number; count: number }>()
    for (const row of rows) {
      for (const [bm, amount] of row.billingMonths) {
        if (amount === null) continue // don't count not-yet-reached
        const prev = avgMonths.get(bm) || { sum: 0, count: 0 }
        avgMonths.set(bm, { sum: prev.sum + amount, count: prev.count + 1 })
      }
    }
    const avgBillingMonths = new Map<number, number | null>()
    let avgTotal = 0
    for (const [bm, { sum, count }] of avgMonths) {
      const avg = count > 0 ? sum / count : 0
      avgBillingMonths.set(bm, avg)
      avgTotal += avg
    }
    const averageRow: LtvRow = { customer: "Average", total: avgTotal, billingMonths: avgBillingMonths, isAverage: true }

    return { ltvRows: rows, ltvMaxMonth: maxMonth, ltvAverageRow: averageRow }
  }, [data, search, sortField, sortDir])

  const ltvMonthNumbers = useMemo(() => Array.from({ length: ltvMaxMonth }, (_, i) => i + 1), [ltvMaxMonth])

  const ltvTotalPages = Math.max(1, Math.ceil(ltvRows.length / PAGE_SIZE))
  const ltvPaginated = ltvRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [selectedPeriods, selectedCategories, search, tableView])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginatedData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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

  if (data.length === 0 && !drillLabel) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No financial data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Import QuickBooks data from the Import page to get started
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <CardTitle>Revenue Data</CardTitle>
              <CardDescription>
                {drillLabel
                  ? `Showing records for: ${drillLabel}`
                  : tableView === "ltv"
                    ? `${ltvRows.length.toLocaleString()} customers across ${ltvMaxMonth} billing months`
                    : `${filtered.length.toLocaleString()} records from imported data`}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Tabs value={tableView} onValueChange={(v) => { setTableView(v as TableView); setPage(1) }}>
              <TabsList className="bg-muted h-9">
                <TabsTrigger value="raw" className="px-4">Raw</TabsTrigger>
                <TabsTrigger value="ltv" className="px-4">LTV</TabsTrigger>
              </TabsList>
            </Tabs>
            {drillLabel ? (
              <Button variant="outline" size="sm" onClick={handleClearDrill} className="gap-1">
                <X className="h-4 w-4" />
                Clear Filter
              </Button>
            ) : (
              <>
                <MultiSelect
                  options={allPeriods}
                  selected={selectedPeriods}
                  onChange={setSelectedPeriods}
                  placeholder="Periods"
                  width="w-[160px]"
                />
                <MultiSelect
                  options={allCategories}
                  selected={selectedCategories}
                  onChange={setSelectedCategories}
                  placeholder="Categories"
                  width="w-[200px]"
                />
              </>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        {tableView === "raw" ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("accountName")}>
                    <span className="flex items-center">Customer<SortIcon field="accountName" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("category")}>
                    <span className="flex items-center">Category<SortIcon field="category" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("period")}>
                    <span className="flex items-center">Period<SortIcon field="period" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("amount")}>
                    <span className="flex items-center justify-end">Amount<SortIcon field="amount" /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.accountName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.category}</Badge>
                      {row.subcategory && (
                        <span className="ml-2 text-xs text-muted-foreground">{row.subcategory}</span>
                      )}
                    </TableCell>
                    <TableCell>{row.period}</TableCell>
                    <TableCell className={`text-right font-mono ${parseFloat(row.amount) < 0 ? "text-red-600" : ""}`}>
                      {formatCurrency(row.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {search ? "No matching records found" : drillLabel ? "No records for this cohort filter" : "No data for selected filters"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                <span>
                  Showing {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span>Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <ScrollArea className="w-full">
              <div className="min-w-max">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[200px] cursor-pointer select-none" onClick={() => handleSort("accountName")}>
                        <span className="flex items-center">Customer<SortIcon field="accountName" /></span>
                      </TableHead>
                      <TableHead className="text-right min-w-[100px] cursor-pointer select-none" onClick={() => handleSort("amount")}>
                        <span className="flex items-center justify-end">Total<SortIcon field="amount" /></span>
                      </TableHead>
                      {ltvMonthNumbers.map((m) => (
                        <TableHead key={m} className="text-right min-w-[90px]">
                          Mo {m}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Average row */}
                    <TableRow className="bg-muted/30 font-semibold border-b-2">
                      <TableCell className="sticky left-0 bg-muted/30 z-10 font-semibold">Average</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(String(ltvAverageRow.total))}
                      </TableCell>
                      {ltvMonthNumbers.map((m) => {
                        const val = ltvAverageRow.billingMonths.get(m)
                        return (
                          <TableCell key={m} className={`text-right font-mono font-semibold ${val == null || val === 0 ? "text-muted-foreground" : ""}`}>
                            {val == null ? "—" : formatCurrency(String(val))}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                    {/* Customer rows */}
                    {ltvPaginated.map((row) => (
                      <TableRow key={row.customer}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">{row.customer}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatCurrency(String(row.total))}
                        </TableCell>
                        {ltvMonthNumbers.map((m) => {
                          const val = row.billingMonths.get(m)
                          return (
                            <TableCell key={m} className={`text-right font-mono ${val == null ? "text-muted-foreground" : val === 0 ? "text-muted-foreground" : val < 0 ? "text-red-600" : ""}`}>
                              {val === null ? "—" : formatCurrency(String(val))}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                    {ltvPaginated.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2 + ltvMonthNumbers.length} className="text-center py-8 text-muted-foreground">
                          {search ? "No matching customers found" : "No data for selected filters"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {ltvRows.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                <span>
                  Showing {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, ltvRows.length).toLocaleString()} of {ltvRows.length.toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span>Page {page} of {ltvTotalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= ltvTotalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
