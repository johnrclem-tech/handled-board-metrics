"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Package, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Check, ChevronsUpDown } from "lucide-react"
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

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [selectedPeriods, selectedCategories, search])

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
                : `${filtered.length.toLocaleString()} records from imported data`}
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
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
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span>Page {page} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
