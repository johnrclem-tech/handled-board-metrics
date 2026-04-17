"use client"

import React, { useEffect, useState, useMemo, useCallback, type ReactElement } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Search,
  Package,
  Megaphone,
  UserPlus,
  Target,
  PieChart,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ListFilter,
} from "lucide-react"
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  ComposedChart,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  Cell,
  Label,
  AreaChart,
  Area,
} from "recharts"
import { cn } from "@/lib/utils"

interface AdRow {
  id: number
  date: string | null
  campaign: string | null
  campaignType: string | null
  adGroup: string | null
  currency: string | null
  cost: string | null
  clicks: number | null
  impressions: number | null
  conversions: string | null
  ctr: string | null
  avgCpc: string | null
  conversionRate: string | null
  costPerConversion: string | null
  searchLostIsBudget: string | null
  searchLostIsRank: string | null
  searchImprShare: string | null
}

type SortField =
  | "date"
  | "campaign"
  | "adGroup"
  | "currency"
  | "cost"
  | "clicks"
  | "conversions"
  | "searchLostIsBudget"
  | "searchLostIsRank"
  | "searchImprShare"

type SortDir = "asc" | "desc"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

function formatPct(value: number): string {
  // Data may come through as either 0.23 (ratio) or 23.5 (already %)
  const pct = value > 1 ? value : value * 100
  return `${pct.toFixed(2)}%`
}

function formatDate(d: string | null): string {
  if (!d) return "—"
  const date = new Date(d)
  if (isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function compare(a: unknown, b: unknown, dir: SortDir): number {
  // Push nullish to the bottom regardless of sort direction
  const aNull = a == null || a === ""
  const bNull = b == null || b === ""
  if (aNull && bNull) return 0
  if (aNull) return 1
  if (bNull) return -1

  const an = typeof a === "number" ? a : Number(a)
  const bn = typeof b === "number" ? b : Number(b)
  const bothNumeric = !Number.isNaN(an) && !Number.isNaN(bn)
  const result = bothNumeric
    ? an - bn
    : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" })
  return dir === "asc" ? result : -result
}

function SortableHead({
  field,
  active,
  dir,
  onSort,
  align = "left",
  children,
}: {
  field: SortField
  active: boolean
  dir: SortDir
  onSort: (f: SortField) => void
  align?: "left" | "right"
  children: React.ReactNode
}) {
  const Icon = active ? (dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          align === "right" && "ml-auto",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span>{children}</span>
        <Icon className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-50")} />
      </button>
    </TableHead>
  )
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const allSelected = selected.size === 0 || selected.size === options.length
  const summary =
    selected.size === 0 || selected.size === options.length
      ? "All"
      : selected.size === 1
        ? Array.from(selected)[0]
        : `${selected.size} selected`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 justify-between gap-2 min-w-[180px]">
          <span className="flex items-center gap-2 truncate">
            <ListFilter className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">{label}:</span>
            <span className="truncate font-medium">{summary}</span>
          </span>
          {!allSelected && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {selected.size}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Filter by {label.toLowerCase()}</span>
          <span className="text-xs text-muted-foreground font-normal">
            {options.length} total
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex items-center gap-2 px-2 pb-2">
          <DropdownMenuItem
            className="flex-1 justify-center text-xs"
            onSelect={(e) => {
              e.preventDefault()
              onChange(new Set(options))
            }}
          >
            Select all
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex-1 justify-center text-xs"
            onSelect={(e) => {
              e.preventDefault()
              onChange(new Set())
            }}
          >
            Clear
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-72">
          {options.map((opt) => {
            const isChecked = selected.size === 0 || selected.has(opt)
            return (
              <DropdownMenuCheckboxItem
                key={opt}
                checked={isChecked}
                onCheckedChange={(checked) => {
                  // Treat empty selected set as "all"; first toggle materializes the full list
                  const base = selected.size === 0 ? new Set(options) : new Set(selected)
                  if (checked) {
                    base.add(opt)
                  } else {
                    base.delete(opt)
                  }
                  onChange(base)
                }}
                onSelect={(e) => e.preventDefault()}
              >
                <span className="truncate">{opt}</span>
              </DropdownMenuCheckboxItem>
            )
          })}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type AdSpendView = "campaigns" | "ad-groups" | "budget"
export type AdSpendRange = "all" | "ytd" | "ttm" | "last-mo" | "last-qtr"
export type AdSpendChannel = "all" | "ppc-website" | "ppc-only"
export type AdSpendPeriod = "monthly" | "quarterly" | "ttm"

// Classify a lead_source / source string as PPC, Website, or other. We try to
// be generous with PPC aliases since different CRMs label paid channels
// differently.
function classifySource(source: string | null | undefined): "ppc" | "website" | "other" {
  if (!source) return "other"
  const s = source.toLowerCase()
  if (
    s.includes("adwords") ||
    s.includes("google ads") ||
    s.includes("google ad ") ||
    s.includes("ppc") ||
    s === "paid search" ||
    s.includes("paid social") ||
    s.includes("paid") ||
    s.includes("bing") ||
    s.includes("facebook ad") ||
    s.includes("meta ad") ||
    s.includes("linkedin ad") ||
    s.includes("sem") ||
    s.includes("sponsored")
  ) {
    return "ppc"
  }
  if (s === "website" || s === "web" || s.includes("organic")) {
    return "website"
  }
  return "other"
}

function sourceMatchesChannel(
  source: string | null | undefined,
  channel: AdSpendChannel,
): boolean {
  if (channel === "all") return true
  const c = classifySource(source)
  if (channel === "ppc-only") return c === "ppc"
  if (channel === "ppc-website") return c === "ppc" || c === "website"
  return true
}

function rangeBounds(range: AdSpendRange): { start: Date | null; end: Date | null } {
  if (range === "all") return { start: null, end: null }
  const now = new Date()
  if (range === "ytd") {
    return { start: new Date(now.getFullYear(), 0, 1), end: now }
  }
  if (range === "ttm") {
    const start = new Date(now)
    start.setMonth(start.getMonth() - 12)
    return { start, end: now }
  }
  if (range === "last-mo") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0) // last day of previous month
    return { start, end }
  }
  if (range === "last-qtr") {
    const currentQtr = Math.floor(now.getMonth() / 3) // 0..3
    const lastQtrStartMonth = currentQtr * 3 - 3 // can be negative for Q1
    const start = new Date(now.getFullYear(), lastQtrStartMonth, 1)
    const end = new Date(now.getFullYear(), lastQtrStartMonth + 3, 0)
    return { start, end }
  }
  return { start: null, end: null }
}

interface AcquisitionRow {
  closingDate: string | null
  createdTime: string | null
  leadSource: string | null
  stage: string | null
}

export function AdSpendPage({
  range = "all",
  channel = "all",
  period = "monthly",
}: {
  range?: AdSpendRange
  channel?: AdSpendChannel
  period?: AdSpendPeriod
}) {
  const [view, setView] = useState<AdSpendView>("ad-groups")
  const isAdGroupView = view === "ad-groups"
  const isBudgetView = view === "budget"
  const [rows, setRows] = useState<AdRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set())
  const [selectedAdGroups, setSelectedAdGroups] = useState<Set<string>>(new Set())
  const [acquisitions, setAcquisitions] = useState<AcquisitionRow[]>([])
  const [ltv, setLtv] = useState<number | null>(null)
  const [billingMonthGm, setBillingMonthGm] = useState<number[]>([])
  const [budgetDailyRaw, setBudgetDailyRaw] = useState<{ date: string; actual: number; potential: number; missed: Record<string, number> }[]>([])
  const [budgetCampaigns, setBudgetCampaigns] = useState<string[]>([])
  const [budgetPeriod, setBudgetPeriod] = useState<"daily" | "weekly">("daily")
  useEffect(() => {
    if (view === "budget") { setLoading(false); return }
    setLoading(true)
    setRows([])
    setSelectedCampaigns(new Set())
    setSelectedAdGroups(new Set())
    setSearch("")
    fetch(`/api/ad-spend?view=${view}`)
      .then((r) => r.json())
      .then((data) => setRows(data.rows || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [view])

  // Acquisitions = opportunities in stage "Closed Won". Fetch them once and
  // filter client-side by range + channel.
  useEffect(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((data) => {
        const oppRows: AcquisitionRow[] = (data.opportunities || []).map(
          (o: {
            closingDate: string | null
            createdTime: string | null
            leadSource: string | null
            stage: string | null
          }) => ({
            closingDate: o.closingDate,
            createdTime: o.createdTime,
            leadSource: o.leadSource,
            stage: o.stage,
          }),
        )
        setAcquisitions(oppRows)
      })
      .catch(console.error)
  }, [])

  // Fetch LTV (same logic as LifetimeGrossMarginCard) and per-billing-month GM
  useEffect(() => {
    const GM_MARGINS: Record<string, number> = { "Storage Revenue": 0.10, "Shipping Revenue": 0.15, "Handling Revenue": 0.30 }
    Promise.all([
      fetch("/api/metrics?category=Storage Revenue,Shipping Revenue,Handling Revenue").then((r) => r.json()),
      fetch("/api/metrics/churn?segment=all").then((r) => r.json()),
      fetch("/api/metrics/cohort-revenue").then((r) => r.json()),
    ])
      .then(([metricsData, churnData, cohortData]) => {
        // LTV calculation
        const records: { category: string; accountName: string; period: string; amount: string }[] = metricsData.details || []
        const raw = new Map<string, Map<string, Map<string, number>>>()
        for (const r of records) {
          const amt = parseFloat(r.amount) || 0
          if (amt === 0) continue
          if (!raw.has(r.accountName)) raw.set(r.accountName, new Map())
          const custMap = raw.get(r.accountName)!
          if (!custMap.has(r.period)) custMap.set(r.period, new Map())
          const catMap = custMap.get(r.period)!
          catMap.set(r.category, (catMap.get(r.category) || 0) + amt)
        }
        let sumAvgMonthlyGm = 0
        let custCount = 0
        for (const [, periodMap] of raw) {
          let totalGm = 0
          let activeMonths = 0
          for (const [, catMap] of periodMap) {
            let periodTotal = 0
            let periodGm = 0
            for (const [cat, amt] of catMap) {
              periodTotal += amt
              periodGm += amt * (GM_MARGINS[cat] || 0)
            }
            totalGm += periodGm
            if (periodTotal > 0) activeMonths++
          }
          if (activeMonths > 0) { sumAvgMonthlyGm += totalGm / activeMonths; custCount++ }
        }
        const avgGm = custCount > 0 ? sumAvgMonthlyGm / custCount : 0

        const ttmWindows: { period: string; revenueChurnRate: number }[] = (churnData.ttm || [])
          .slice(0, -1)
          .filter((t: { period: string }) => parseInt(t.period.slice(0, 4), 10) >= 2025)
        const avgAnnualChurn = ttmWindows.length > 0
          ? ttmWindows.reduce((s: number, t: { revenueChurnRate: number }) => s + t.revenueChurnRate, 0) / ttmWindows.length
          : 0
        const monthlyEquiv = avgAnnualChurn > 0 ? (1 - Math.pow(1 - avgAnnualChurn / 100, 1 / 12)) * 100 : 0

        if (monthlyEquiv > 0 && avgGm > 0) {
          setLtv(avgGm / (monthlyEquiv / 100))
        }

        // Per-billing-month GM from cohort data
        const cohort = cohortData?.cohortData
        if (cohort) {
          const storageLookup = new Map<number, number>((cohort.storage || []).map((e: { month: number; average: number }) => [e.month, e.average]))
          const shippingLookup = new Map<number, number>((cohort.shipping || []).map((e: { month: number; average: number }) => [e.month, e.average]))
          const handlingLookup = new Map<number, number>((cohort.handling || []).map((e: { month: number; average: number }) => [e.month, e.average]))
          const maxMonths = cohortData.metadata?.maxBillingMonths || 0
          const gms: number[] = []
          for (let m = 1; m <= maxMonths; m++) {
            gms.push(
              (storageLookup.get(m) || 0) * 0.10 +
              (shippingLookup.get(m) || 0) * 0.15 +
              (handlingLookup.get(m) || 0) * 0.30
            )
          }
          setBillingMonthGm(gms)
        }
      })
      .catch(console.error)
  }, [])

  // ── Budget chart: actual vs potential spend ──
  useEffect(() => {
    Promise.all([
      fetch("/api/ad-spend?view=ad-groups").then((r) => r.json()),
      fetch("/api/ad-spend?view=campaigns").then((r) => r.json()),
    ])
      .then(([agData, campData]) => {
        const agRows: AdRow[] = agData.rows || []
        const campRows: AdRow[] = campData.rows || []

        // Campaign-day lost IS (budget) lookup from campaign data
        const campLostIs = new Map<string, number>()
        for (const r of campRows) {
          if (!r.date || !r.campaign) continue
          const lostBudget = r.searchLostIsBudget ? parseFloat(r.searchLostIsBudget) : 0
          if (lostBudget > 0) {
            const key = `${r.date}|${r.campaign.split(/[|,]/)[0].trim()}`
            campLostIs.set(key, lostBudget)
          }
        }

        // Sum ad group spend per campaign-day, then compute potential
        const campaignDaySpend = new Map<string, Map<string, number>>()
        for (const r of agRows) {
          if (!r.date || !r.campaign || r.date < "2026-01-01") continue
          const cost = r.cost ? parseFloat(r.cost) : 0
          if (cost <= 0) continue
          const campaign = r.campaign.split(/[|,]/)[0].trim()
          const dayMap = campaignDaySpend.get(campaign) || new Map<string, number>()
          dayMap.set(r.date, (dayMap.get(r.date) || 0) + cost)
          campaignDaySpend.set(campaign, dayMap)
        }

        // Step 1: compute per campaign-day potential
        const dailyTotals = new Map<string, { actual: number; missed: Map<string, number> }>()

        for (const [campaign, dayMap] of campaignDaySpend) {
          for (const [date, actual] of dayMap) {
            const lostIs = campLostIs.get(`${date}|${campaign}`) || 0
            const potential = lostIs < 100 ? actual / (1 - lostIs / 100) : actual
            const missed = potential - actual

            const entry = dailyTotals.get(date) || { actual: 0, missed: new Map<string, number>() }
            entry.actual += actual
            if (missed > 0) entry.missed.set(campaign, (entry.missed.get(campaign) || 0) + missed)
            dailyTotals.set(date, entry)
          }
        }

        // Sort campaigns by total missed spend (descending)
        const campTotals = new Map<string, number>()
        for (const [, entry] of dailyTotals) {
          for (const [camp, m] of entry.missed) {
            campTotals.set(camp, (campTotals.get(camp) || 0) + m)
          }
        }
        const sortedCampaigns = Array.from(campTotals.entries())
          .filter(([, total]) => total > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => name)

        // Build daily data
        const sortedDates = Array.from(dailyTotals.keys()).sort()
        const dailyRows = sortedDates.map((date) => {
          const entry = dailyTotals.get(date)!
          const missedTotal = Array.from(entry.missed.values()).reduce((s, v) => s + v, 0)
          const missedObj: Record<string, number> = {}
          for (const camp of sortedCampaigns) {
            missedObj[camp] = Math.round(entry.missed.get(camp) || 0)
          }
          return {
            date,
            actual: Math.round(entry.actual),
            potential: Math.round(entry.actual + missedTotal),
            missed: missedObj,
          }
        })

        setBudgetDailyRaw(dailyRows)
        setBudgetCampaigns(sortedCampaigns)
      })
      .catch(console.error)
  }, [])

  const budgetChartData = useMemo(() => {
    if (budgetDailyRaw.length === 0) return []

    if (budgetPeriod === "daily") {
      const last14 = budgetDailyRaw.slice(-14)
      return last14.map((d) => {
        const dt = new Date(d.date + "T00:00:00")
        const dayName = dt.toLocaleString("en-US", { weekday: "short" })
        return { label: dayName, actual: d.actual, potential: d.potential, missed: d.missed }
      })
    }

    // Weekly aggregation
    const getWeekStart = (dateStr: string) => {
      const d = new Date(dateStr + "T00:00:00")
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d.setDate(diff))
      return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`
    }

    const weeklyMap = new Map<string, { actual: number; potential: number; missed: Record<string, number> }>()
    for (const d of budgetDailyRaw) {
      const week = getWeekStart(d.date)
      const wEntry = weeklyMap.get(week) || { actual: 0, potential: 0, missed: {} as Record<string, number> }
      wEntry.actual += d.actual
      wEntry.potential += d.potential
      for (const camp of budgetCampaigns) {
        wEntry.missed[camp] = (wEntry.missed[camp] || 0) + (d.missed[camp] || 0)
      }
      weeklyMap.set(week, wEntry)
    }

    return Array.from(weeklyMap.keys()).sort().map((week) => {
      const wEntry = weeklyMap.get(week)!
      const dt = new Date(week + "T00:00:00")
      const label = `${dt.toLocaleString("en-US", { month: "short" })} ${dt.getDate()}`
      return { label, actual: wEntry.actual, potential: wEntry.potential, missed: wEntry.missed }
    })
  }, [budgetDailyRaw, budgetCampaigns, budgetPeriod])

  // Apply the page-level Range filter first so every other derived value
  // (KPIs, filter options, table) reflects the same window
  const rangeFilteredRows = useMemo(() => {
    const { start, end } = rangeBounds(range)
    if (!start && !end) return rows
    return rows.filter((r) => {
      if (!r.date) return false
      const d = new Date(r.date)
      if (isNaN(d.getTime())) return false
      if (start && d < start) return false
      if (end && d > end) return false
      return true
    })
  }, [rows, range])

  const campaignOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rangeFilteredRows) if (r.campaign) set.add(r.campaign)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rangeFilteredRows])

  const adGroupOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rangeFilteredRows) if (r.adGroup) set.add(r.adGroup)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rangeFilteredRows])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      // Default direction: numeric/date columns descend first, text ascends
      const textCols: SortField[] = ["campaign", "adGroup", "currency"]
      setSortDir(textCols.includes(field) ? "asc" : "desc")
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rangeFilteredRows.filter((r) => {
      if (selectedCampaigns.size > 0 && !selectedCampaigns.has(r.campaign || "")) {
        return false
      }
      if (selectedAdGroups.size > 0 && !selectedAdGroups.has(r.adGroup || "")) {
        return false
      }
      if (q) {
        const hay = `${r.campaign || ""} ${r.adGroup || ""} ${r.currency || ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rangeFilteredRows, search, selectedCampaigns, selectedAdGroups])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      const av = a[sortField]
      const bv = b[sortField]
      // String numerics like "12.34" should be compared as numbers
      const numericFields: SortField[] = [
        "cost",
        "clicks",
        "conversions",
        "searchLostIsBudget",
        "searchLostIsRank",
        "searchImprShare",
      ]
      if (numericFields.includes(sortField)) {
        const an = av == null ? null : typeof av === "number" ? av : parseFloat(av as string)
        const bn = bv == null ? null : typeof bv === "number" ? bv : parseFloat(bv as string)
        return compare(an, bn, sortDir)
      }
      return compare(av, bv, sortDir)
    })
    return copy
  }, [filtered, sortField, sortDir])

  const totals = useMemo(() => {
    let cost = 0
    let clicks = 0
    let conversions = 0
    let impressionShareSum = 0
    let impressionShareCount = 0
    for (const r of rangeFilteredRows) {
      if (r.cost) cost += parseFloat(r.cost)
      if (r.clicks) clicks += r.clicks
      if (r.conversions) conversions += parseFloat(r.conversions)
      if (r.searchImprShare) {
        impressionShareSum += parseFloat(r.searchImprShare)
        impressionShareCount++
      }
    }
    const cpc = clicks > 0 ? cost / clicks : 0
    const costPerConv = conversions > 0 ? cost / conversions : 0
    const avgImprShare =
      impressionShareCount > 0 ? impressionShareSum / impressionShareCount : 0
    return { cost, clicks, conversions, cpc, costPerConv, avgImprShare }
  }, [rangeFilteredRows])

  // Total acquisitions = Opportunities with stage "Closed Won" whose closing
  // date (falling back to createdTime when missing) is within the selected
  // range and whose lead_source matches the selected Channel.
  const acquisitionsInRange = useMemo(() => {
    const { start, end } = rangeBounds(range)
    let count = 0
    for (const a of acquisitions) {
      const stage = (a.stage || "").toLowerCase().replace(/[-_]/g, " ").trim()
      if (stage !== "closed won") continue
      const dateStr = a.closingDate || a.createdTime
      if (!dateStr) continue
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) continue
      if (start && d < start) continue
      if (end && d > end) continue
      if (!sourceMatchesChannel(a.leadSource, channel)) continue
      count++
    }
    return count
  }, [acquisitions, range, channel])

  const cpa = acquisitionsInRange > 0 ? totals.cost / acquisitionsInRange : 0

  const ltvCacRatio = ltv != null && cpa > 0 ? ltv / cpa : null

  const paybackMonths = useMemo(() => {
    if (cpa <= 0 || billingMonthGm.length === 0) return null
    let cumulative = 0
    for (let i = 0; i < billingMonthGm.length; i++) {
      cumulative += billingMonthGm[i]
      if (cumulative >= cpa) return i + 1
    }
    return null
  }, [cpa, billingMonthGm])

  const hasData = !loading && rows.length > 0

  const kpis = hasData
    ? [
        { title: "Total Spend", value: formatCurrency(totals.cost), icon: Megaphone, color: "text-chart-1", bg: "bg-chart-1/15" },
        {
          title: "CAC",
          value: acquisitionsInRange > 0 ? formatCurrency(cpa) : "—",
          sub: `${formatNumber(acquisitionsInRange)} acquisition${acquisitionsInRange === 1 ? "" : "s"}`,
          icon: UserPlus,
          color: "text-chart-2",
          bg: "bg-chart-2/15",
        },
        {
          title: "LTV/CAC Ratio",
          value: ltvCacRatio != null ? `${ltvCacRatio.toFixed(1)}x` : "—",
          sub: paybackMonths != null ? `${paybackMonths} mo payback` : "—",
          icon: Target,
          color: "text-chart-3",
          bg: "bg-chart-3/15",
        },
        { title: "Avg Impr. Share", value: formatPct(totals.avgImprShare), sub: "Search impression share", icon: PieChart, color: "text-chart-4", bg: "bg-chart-4/15" },
      ]
    : []

  // ── Chart data: aggregate spend + CPA by period ──
  const chartData = useMemo(() => {
    if (rangeFilteredRows.length === 0) return []

    // Group ad-spend rows by period bucket
    const spendByBucket = new Map<string, number>()
    for (const r of rangeFilteredRows) {
      if (!r.date) continue
      const d = new Date(r.date)
      if (isNaN(d.getTime())) continue
      let key: string
      if (period === "monthly") {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      } else if (period === "quarterly") {
        key = `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      }
      spendByBucket.set(key, (spendByBucket.get(key) || 0) + (r.cost ? parseFloat(r.cost) : 0))
    }

    // Group acquisitions (Closed Won opps) by same period buckets
    const acqByBucket = new Map<string, number>()
    const { start, end } = rangeBounds(range)
    for (const a of acquisitions) {
      const stage = (a.stage || "").toLowerCase().replace(/[-_]/g, " ").trim()
      if (stage !== "closed won") continue
      if (!sourceMatchesChannel(a.leadSource, channel)) continue
      const dateStr = a.closingDate || a.createdTime
      if (!dateStr) continue
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) continue
      if (start && d < start) continue
      if (end && d > end) continue
      let key: string
      if (period === "monthly") {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      } else if (period === "quarterly") {
        key = `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      }
      acqByBucket.set(key, (acqByBucket.get(key) || 0) + 1)
    }

    // For TTM: roll monthly buckets into trailing-12-month windows
    if (period === "ttm") {
      const monthKeys = [...new Set([...spendByBucket.keys(), ...acqByBucket.keys()])].sort()
      const ttmData: { label: string; spend: number; cpa: number | null; acquisitions: number }[] = []
      for (let i = 11; i < monthKeys.length; i++) {
        const windowKeys = monthKeys.slice(i - 11, i + 1)
        let windowSpend = 0
        let windowAcq = 0
        for (const k of windowKeys) {
          windowSpend += spendByBucket.get(k) || 0
          windowAcq += acqByBucket.get(k) || 0
        }
        const endKey = windowKeys[windowKeys.length - 1]
        const [y, m] = endKey.split("-").map(Number)
        const label = `${new Date(y, m - 1).toLocaleString("en-US", { month: "short" })} ${String(y).slice(2)}`
        ttmData.push({
          label,
          spend: windowSpend,
          cpa: windowAcq > 0 ? windowSpend / windowAcq : null,
          acquisitions: windowAcq,
        })
      }
      return ttmData.filter((d) => d.spend > 0)
    }

    // Monthly / Quarterly: straightforward
    const allKeys = [...new Set([...spendByBucket.keys(), ...acqByBucket.keys()])].sort()
    return allKeys.map((key) => {
      const spend = spendByBucket.get(key) || 0
      const acq = acqByBucket.get(key) || 0
      let label: string
      if (period === "quarterly") {
        const [y, qPart] = key.split("-Q")
        label = `Q${qPart} ${y.slice(2)}`
      } else {
        const [y, m] = key.split("-").map(Number)
        label = `${new Date(y, m - 1).toLocaleString("en-US", { month: "short" })} ${String(y).slice(2)}`
      }
      return {
        label,
        spend,
        cpa: acq > 0 ? spend / acq : null,
        acquisitions: acq,
      }
    }).filter((d) => d.spend > 0)
  }, [rangeFilteredRows, acquisitions, range, channel, period])

  // ── Scatter chart: ad group quadrant analysis ──
  const [scatterCampaignFilter, setScatterCampaignFilter] = useState<string>("all")

  const scatterData = useMemo(() => {
    // Always use ad-group level rows from rangeFilteredRows
    const groupMap = new Map<string, { campaign: string; cost: number; clicks: number; impressions: number; conversions: number; imprShareSum: number; lostIsRankSum: number; rowCount: number }>()
    for (const r of rangeFilteredRows) {
      if (!r.date || r.date < "2026-01-01") continue
      const name = r.adGroup || r.campaign || "Unknown"
      const campaign = r.campaign || "Unknown"
      const cost = r.cost ? parseFloat(r.cost) : 0
      if (cost <= 0) continue
      const prev = groupMap.get(name) || { campaign, cost: 0, clicks: 0, impressions: 0, conversions: 0, imprShareSum: 0, lostIsRankSum: 0, rowCount: 0 }
      prev.cost += cost
      prev.clicks += r.clicks || 0
      prev.impressions += r.impressions || 0
      prev.conversions += r.conversions ? parseFloat(r.conversions) : 0
      const imprShare = r.searchImprShare ? parseFloat(r.searchImprShare) : 0
      const lostRank = r.searchLostIsRank ? parseFloat(r.searchLostIsRank) : 0
      if (imprShare > 0 || lostRank > 0) {
        prev.imprShareSum += imprShare
        prev.lostIsRankSum += lostRank
        prev.rowCount++
      }
      prev.campaign = campaign
      groupMap.set(name, prev)
    }

    return Array.from(groupMap.entries()).map(([name, d]) => ({
      name,
      campaign: d.campaign,
      cost: d.cost,
      clicks: d.clicks,
      conversions: Math.round(d.conversions * 10) / 10,
      cpc: d.clicks > 0 ? d.cost / d.clicks : 0,
      imprShare: d.rowCount > 0 ? d.imprShareSum / d.rowCount : 0,
      lostIsRank: d.rowCount > 0 ? d.lostIsRankSum / d.rowCount : 0,
    }))
  }, [rangeFilteredRows])

  const scatterCampaigns = useMemo(() => {
    const set = new Set<string>()
    for (const d of scatterData) set.add(d.campaign)
    return Array.from(set).sort()
  }, [scatterData])

  const medianCpc = useMemo(() => {
    const sorted = scatterData.map((d) => d.cpc).sort((a, b) => a - b)
    if (sorted.length === 0) return 0
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }, [scatterData])

  const medianClicks = useMemo(() => {
    const sorted = scatterData.map((d) => d.clicks).sort((a, b) => a - b)
    if (sorted.length === 0) return 0
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }, [scatterData])

  const getQuadrantColor = useCallback((cpc: number, clicks: number) => {
    if (cpc <= medianCpc && clicks >= medianClicks) return "#22c55e" // green — traffic drivers
    if (cpc > medianCpc && clicks >= medianClicks) return "#f59e0b"  // amber — watch
    if (cpc <= medianCpc && clicks < medianClicks) return "#3b82f6"  // blue — low volume
    return "#ef4444" // red — cut/restructure
  }, [medianCpc, medianClicks])

  const viewToggle = (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">View:</span>
      <Tabs value={view} onValueChange={(v) => setView(v as AdSpendView)}>
        <TabsList className="bg-muted h-9">
          <TabsTrigger value="campaigns" className="px-4">Campaigns</TabsTrigger>
          <TabsTrigger value="ad-groups" className="px-4">Ad Groups</TabsTrigger>
          <TabsTrigger value="budget" className="px-4">Campaign Budget</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )

  return (
    <div className="space-y-6">
      {hasData && (
        <div className="grid gap-4 md:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardDescription className="text-sm font-medium">{kpi.title}</CardDescription>
                <div className={`flex h-8 w-8 items-center justify-center rounded-md ${kpi.bg}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                {kpi.sub && <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasData && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Ad Spend {period === "monthly" ? "& CPA by Month" : period === "quarterly" ? "& CPA by Quarter" : "& CPA — TTM"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={55} interval={0} />
                <YAxis
                  yAxisId="spend"
                  tick={{ fontSize: 11 }}
                  width={70}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                  }
                  label={{ value: "Ad Spend", angle: -90, position: "insideLeft", offset: 0, style: { fontSize: 12, fill: "var(--chart-1)" } }}
                />
                <YAxis
                  yAxisId="cpa"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  width={70}
                  tickFormatter={(v: number) => `$${v.toLocaleString()}`}
                  label={{ value: "CPA", angle: 90, position: "insideRight", offset: 0, style: { fontSize: 12, fill: "var(--chart-2)" } }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null
                    const spendVal = payload.find((p) => p.dataKey === "spend")?.value
                    const cpaVal = payload.find((p) => p.dataKey === "cpa")?.value
                    const acqVal = payload[0]?.payload?.acquisitions as number | undefined
                    return (
                      <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
                        <p className="font-medium mb-1">{label}</p>
                        {spendVal != null && (
                          <p style={{ color: "var(--chart-1)" }}>
                            Ad Spend: ${Number(spendVal).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        )}
                        {acqVal != null && (
                          <p className="text-muted-foreground">
                            Acquisitions: {acqVal.toLocaleString()}
                          </p>
                        )}
                        {cpaVal != null && (
                          <p style={{ color: "var(--chart-2)" }}>
                            CPA: ${Number(cpaVal).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        )}
                      </div>
                    )
                  }}
                />
                <Bar yAxisId="spend" dataKey="spend" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="cpa"
                  dataKey="cpa"
                  type="monotone"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--chart-2)" }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {budgetChartData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Campaign Budget Analysis</CardTitle>
                <CardDescription>Actual {budgetPeriod === "daily" ? "daily" : "weekly"} spend vs estimated potential if budget caps were removed</CardDescription>
              </div>
              <Tabs value={budgetPeriod} onValueChange={(v) => setBudgetPeriod(v as "daily" | "weekly")}>
                <TabsList className="bg-muted h-9">
                  <TabsTrigger value="daily" className="px-4">Daily</TabsTrigger>
                  <TabsTrigger value="weekly" className="px-4">Weekly</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={budgetChartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 11 }} width={55} />
                <Tooltip
                  content={({ payload, label }) => {
                    if (!payload || payload.length === 0) return null
                    const row = payload[0]?.payload as typeof budgetChartData[0] | undefined
                    if (!row) return null
                    const missedEntries = budgetCampaigns
                      .map((camp) => ({ name: camp, value: row.missed[camp] || 0 }))
                      .filter((e) => e.value > 0)
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-sm text-sm space-y-1 max-w-xs">
                        <div className="font-semibold">{budgetPeriod === "weekly" ? `Week of ${label}` : label}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          <span className="text-muted-foreground">Actual Spend:</span>
                          <span className="font-mono font-semibold">{formatCurrency(row.actual)}</span>
                          {missedEntries.map((e) => (
                            <React.Fragment key={e.name}>
                              <span className="text-muted-foreground truncate">{e.name}:</span>
                              <span className="font-mono text-amber-500">+{formatCurrency(e.value)}</span>
                            </React.Fragment>
                          ))}
                          <span className="text-muted-foreground font-semibold border-t pt-1">Total Potential:</span>
                          <span className="font-mono font-semibold border-t pt-1">{formatCurrency(row.potential)}</span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  name="Actual Spend"
                  fill="var(--chart-1)"
                  stroke="var(--chart-1)"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="potential"
                  name="Total Potential"
                  fill="var(--chart-2)"
                  stroke="var(--chart-2)"
                  fillOpacity={0.3}
                  strokeDasharray="5 3"
                />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {hasData && scatterData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle>Ad Group Performance Quadrant</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <ListFilter className="h-4 w-4" />
                    {scatterCampaignFilter === "all" ? "All Campaigns" : scatterCampaignFilter}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-64 overflow-auto">
                  <DropdownMenuLabel>Filter by Campaign</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setScatterCampaignFilter("all")}>
                    All Campaigns
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {scatterCampaigns.map((c) => (
                    <DropdownMenuItem key={c} onClick={() => setScatterCampaignFilter(c)}>
                      {c}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={420}>
              <ScatterChart margin={{ top: 30, right: 30, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number"
                  dataKey="clicks"
                  name="Clicks"
                  tick={{ fontSize: 11 }}
                  label={{ value: "Total Clicks", position: "insideBottom", offset: -10, fontSize: 12 }}
                />
                <YAxis
                  type="number"
                  dataKey="cpc"
                  name="CPC"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `$${v.toFixed(2)}`}
                  label={{ value: "CPC ($)", angle: -90, position: "insideLeft", offset: 0, fontSize: 12 }}
                />
                <ZAxis type="number" dataKey="conversions" range={[256, 1600]} />
                <ReferenceLine x={medianClicks} stroke="#999" strokeDasharray="3 3">
                  <Label value={`${medianClicks} clicks`} position="top" fontSize={10} fill="#999" />
                </ReferenceLine>
                <ReferenceLine y={medianCpc} stroke="#999" strokeDasharray="3 3">
                  <Label value={`$${medianCpc.toFixed(2)} CPC`} position="right" fontSize={10} fill="#999" />
                </ReferenceLine>
                {/* Quadrant labels */}
                <ReferenceLine y={0} stroke="transparent" ifOverflow="visible">
                  <Label value="🟢 Traffic Drivers" position="insideTopRight" fontSize={10} fill="#22c55e" offset={20} />
                </ReferenceLine>
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.[0]?.payload) return null
                    const d = payload[0].payload as typeof scatterData[0]
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-sm text-sm space-y-1">
                        <div className="font-semibold">{d.name}</div>
                        <div className="text-muted-foreground text-xs">{d.campaign}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1">
                          <span className="text-muted-foreground">CPC:</span><span className="font-mono">${d.cpc.toFixed(2)}</span>
                          <span className="text-muted-foreground">Clicks:</span><span className="font-mono">{d.clicks.toLocaleString()}</span>
                          <span className="text-muted-foreground">Spend:</span><span className="font-mono">{formatCurrency(d.cost)}</span>
                          <span className="text-muted-foreground">Conversions:</span><span className="font-mono">{d.conversions}</span>
                          <span className="text-muted-foreground">Impr. Share:</span><span className="font-mono">{d.imprShare.toFixed(1)}%</span>
                          <span className="text-muted-foreground">Lost IS (Rank):</span><span className="font-mono">{d.lostIsRank.toFixed(1)}%</span>
                        </div>
                      </div>
                    )
                  }}
                />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Scatter data={scatterData} shape={(props: any): ReactElement => {
                  const d = props.payload as typeof scatterData[0]
                  const cx = (props.cx as number) || 0
                  const cy = (props.cy as number) || 0
                  const isFiltered = scatterCampaignFilter !== "all" && d.campaign !== scatterCampaignFilter
                  const hasConversions = d.conversions > 0
                  const radius = Math.max(8, 8 + d.conversions * 6)
                  const quadColor = getQuadrantColor(d.cpc, d.clicks)
                  const fill = isFiltered ? "#d1d5db" : hasConversions ? "#22c55e" : quadColor
                  const opacity = isFiltered ? 0.4 : 0.8
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={radius} fill={fill} opacity={opacity} stroke={isFiltered ? "#9ca3af" : "#fff"} strokeWidth={1.5} />
                      {hasConversions && !isFiltered && (
                        <text x={cx} y={cy - radius - 4} textAnchor="middle" fontSize={10} fill="#eab308" fontWeight="bold">
                          ⭐ {d.conversions}
                        </text>
                      )}
                    </g>
                  )
                }} />
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-green-500" /> Traffic Drivers (low CPC, high clicks)</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-amber-500" /> Watch (high CPC, high clicks)</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> Low Volume (low CPC, low clicks)</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-500" /> Cut / Restructure (high CPC, low clicks)</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {viewToggle}
              <Separator orientation="vertical" className="hidden sm:block h-6" />
              <div>
                <CardTitle>{isBudgetView ? "Campaign Budget Data" : isAdGroupView ? "Ad Group Performance" : "Ad Campaign Performance"}</CardTitle>
                {!isBudgetView && hasData && (
                  <CardDescription>
                    {sorted.length.toLocaleString()} of {rangeFilteredRows.length.toLocaleString()} rows
                    {range !== "all" && rangeFilteredRows.length !== rows.length && (
                      <> (filtered from {rows.length.toLocaleString()} total)</>
                    )}
                  </CardDescription>
                )}
                {isBudgetView && budgetDailyRaw.length > 0 && (
                  <CardDescription>{budgetDailyRaw.length} days</CardDescription>
                )}
              </div>
            </div>
            {!isBudgetView && hasData && (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <MultiSelectFilter
                  label="Campaign"
                  options={campaignOptions}
                  selected={selectedCampaigns}
                  onChange={setSelectedCampaigns}
                />
                {isAdGroupView && (
                  <MultiSelectFilter
                    label="Ad Group"
                    options={adGroupOptions}
                    selected={selectedAdGroups}
                    onChange={setSelectedAdGroups}
                  />
                )}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search campaigns..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isBudgetView ? (
            budgetDailyRaw.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">No budget data available</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actual Spend</TableHead>
                      <TableHead className="text-right">Total Potential</TableHead>
                      <TableHead className="text-right">Total Missed</TableHead>
                      {budgetCampaigns.map((c) => (
                        <TableHead key={c} className="text-right whitespace-nowrap">{c} Missed</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetDailyRaw.map((d) => (
                      <TableRow key={d.date}>
                        <TableCell className="whitespace-nowrap">{d.date}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(d.actual)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(d.potential)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(d.potential - d.actual)}</TableCell>
                        {budgetCampaigns.map((c) => (
                          <TableCell key={c} className="text-right font-mono">
                            {d.missed[c] ? formatCurrency(d.missed[c]) : "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : loading ? (
            <div className="py-16 text-center text-muted-foreground">
              Loading ad spend data...
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">
                No {isAdGroupView ? "ad group" : "ad campaign"} data
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Import an {isAdGroupView ? "Ad Group Performance" : "Ad Campaign Performance"} file from
                the Import page to get started
              </p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="date" active={sortField === "date"} dir={sortDir} onSort={handleSort}>
                    Day
                  </SortableHead>
                  <SortableHead field="campaign" active={sortField === "campaign"} dir={sortDir} onSort={handleSort}>
                    Campaign
                  </SortableHead>
                  {isAdGroupView && (
                    <SortableHead field="adGroup" active={sortField === "adGroup"} dir={sortDir} onSort={handleSort}>
                      Ad Group
                    </SortableHead>
                  )}
                  <SortableHead field="currency" active={sortField === "currency"} dir={sortDir} onSort={handleSort}>
                    Currency
                  </SortableHead>
                  <SortableHead field="cost" active={sortField === "cost"} dir={sortDir} onSort={handleSort} align="right">
                    Cost
                  </SortableHead>
                  <SortableHead field="clicks" active={sortField === "clicks"} dir={sortDir} onSort={handleSort} align="right">
                    Clicks
                  </SortableHead>
                  <SortableHead field="conversions" active={sortField === "conversions"} dir={sortDir} onSort={handleSort} align="right">
                    Conversions
                  </SortableHead>
                  {!isAdGroupView && (
                    <SortableHead field="searchLostIsBudget" active={sortField === "searchLostIsBudget"} dir={sortDir} onSort={handleSort} align="right">
                      Search Lost IS (Budget)
                    </SortableHead>
                  )}
                  <SortableHead field="searchLostIsRank" active={sortField === "searchLostIsRank"} dir={sortDir} onSort={handleSort} align="right">
                    Search Lost IS (Rank)
                  </SortableHead>
                  <SortableHead field="searchImprShare" active={sortField === "searchImprShare"} dir={sortDir} onSort={handleSort} align="right">
                    Search Impr. Share
                  </SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate">{r.campaign || "—"}</TableCell>
                    {isAdGroupView && (
                      <TableCell className="max-w-[240px] truncate">{r.adGroup || "—"}</TableCell>
                    )}
                    <TableCell>{r.currency || "—"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {r.cost != null ? formatCurrency(parseFloat(r.cost)) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.clicks != null ? formatNumber(r.clicks) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.conversions != null ? formatNumber(parseFloat(r.conversions), 2) : "—"}
                    </TableCell>
                    {!isAdGroupView && (
                      <TableCell className="text-right font-mono">
                        {r.searchLostIsBudget != null ? formatPct(parseFloat(r.searchLostIsBudget)) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-mono">
                      {r.searchLostIsRank != null ? formatPct(parseFloat(r.searchLostIsRank)) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.searchImprShare != null ? formatPct(parseFloat(r.searchImprShare)) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
