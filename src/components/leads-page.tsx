"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InfoTooltip } from "@/components/info-tooltip"
import { NewCustomersChart } from "@/components/new-customers-chart"
import { cn } from "@/lib/utils"
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronsUpDown,

  Package,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  Legend,
  PieChart,
  Pie,
  Cell,
  Label as ChartLabel,
} from "recharts"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

// ── Types ──

export type LeadsPeriod = "monthly" | "quarterly" | "annually" | "ttm"
export type LeadsTimeRange = "all" | "ttm" | "ytd"

interface LeadRow {
  id: number
  company: string | null
  fullName: string | null
  leadSource: string
  adCampaignName: string | null
  ad: string | null
  leadStatus: string | null
  createdTime: string | null
}

interface OppRow {
  id: number
  opportunityName: string | null
  leadSource: string
  leadSourceDetail: string | null
  stage: string | null
  closingDate: string | null
  createdTime: string | null
  ad: string | null
}

type TableView = "leads" | "opportunities"
type LeadSortField = "company" | "fullName" | "leadSource" | "leadStatus" | "createdTime"
type OppSortField = "opportunityName" | "leadSource" | "stage" | "closingDate" | "createdTime"
type SortDir = "asc" | "desc"

const PAGE_SIZE = 50

// ── Source category mapping ──

const SOURCE_CATEGORY_MAP: Record<string, string> = {
  Website: "Website",
  "Google AdWords": "PPC",
  "Agency Partner": "Partners",
  "Carrier Partner": "Partners",
  "Fulfillment Partner": "Partners",
  "Technology Partner": "Partners",
  "Customer Referral": "Referral",
  Employee: "Referral",
  Organization: "Other",
  Social: "Other",
  "Trade Show": "Other",
  Unknown: "Other",
}

const SOURCE_CATEGORIES = ["Website", "PPC", "Partners", "Referral", "Other"] as const

const SOURCE_CATEGORY_COLORS: Record<string, string> = {
  Website: "var(--chart-1)",
  PPC: "var(--chart-2)",
  Partners: "var(--chart-3)",
  Referral: "var(--chart-4)",
  Other: "var(--chart-5)",
}

function categorizeSource(source: string): string {
  return SOURCE_CATEGORY_MAP[source] || "Other"
}

// ── MultiSelect ──

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  width = "w-[160px]",
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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
    if (next.has(value)) next.delete(value)
    else next.add(value)
    if (next.size === options.length) onChange(new Set())
    else onChange(next)
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
            onClick={() => onChange(new Set())}
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

// ── Helpers ──

function getMonth(d: string | null): string | null {
  if (!d) return null
  const date = new Date(d)
  if (isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function getQuarter(d: string | null): string | null {
  if (!d) return null
  const date = new Date(d)
  if (isNaN(date.getTime())) return null
  const q = Math.ceil((date.getMonth() + 1) / 3)
  return `${date.getFullYear()}-Q${q}`
}

function getYear(d: string | null): string | null {
  if (!d) return null
  const date = new Date(d)
  if (isNaN(date.getTime())) return null
  return `${date.getFullYear()}`
}

function getPeriodKey(d: string | null, period: LeadsPeriod): string | null {
  if (period === "monthly" || period === "ttm") return getMonth(d)
  if (period === "quarterly") return getQuarter(d)
  return getYear(d)
}

function formatPeriodLabel(key: string, period: LeadsPeriod): string {
  if (period === "monthly" || period === "ttm") {
    const [year, m] = key.split("-")
    const date = new Date(Number(year), Number(m) - 1)
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
  }
  if (period === "quarterly") {
    return key // "2026-Q1"
  }
  return key // "2026"
}


function formatDate(d: string | null): string {
  if (!d) return "—"
  const date = new Date(d)
  if (isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

interface StackedData {
  period: string
  label: string
  total: number
  [source: string]: string | number
}

const CHART_START: Record<LeadsPeriod, string> = {
  monthly: "2025-02",
  quarterly: "2025-Q1",
  annually: "2025",
  ttm: "2025-02",
}

/** Generate sorted month keys from startMonth to endMonth inclusive (YYYY-MM format) */
function getMonthRange(start: string, end: string): string[] {
  const months: string[] = []
  const [sy, sm] = start.split("-").map(Number)
  const [ey, em] = end.split("-").map(Number)
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

function buildStackedData(
  items: { createdTime: string | null; source: string }[],
  period: LeadsPeriod,
): StackedData[] {
  const minPeriod = CHART_START[period]

  if (period === "ttm") {
    // First, bucket by month
    const monthMap = new Map<string, Map<string, number>>()
    for (const item of items) {
      const key = getMonth(item.createdTime)
      if (!key) continue
      if (!monthMap.has(key)) monthMap.set(key, new Map())
      const cats = monthMap.get(key)!
      const cat = categorizeSource(item.source)
      cats.set(cat, (cats.get(cat) || 0) + 1)
    }

    // Get all months sorted
    const allMonths = Array.from(monthMap.keys()).sort()
    if (allMonths.length === 0) return []

    // For each month, compute rolling 12-month sum
    const result: StackedData[] = []
    for (const endMonth of allMonths) {
      if (endMonth < minPeriod) continue
      // Compute start of 12-month window
      const [ey, em] = endMonth.split("-").map(Number)
      const startDate = new Date(ey, em - 12, 1) // 11 months back from start of endMonth
      const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`

      const windowMonths = getMonthRange(startMonth, endMonth)
      const entry: StackedData = {
        period: endMonth,
        label: formatPeriodLabel(endMonth, period),
        total: 0,
      }
      for (const cat of SOURCE_CATEGORIES) {
        let sum = 0
        for (const m of windowMonths) {
          sum += monthMap.get(m)?.get(cat) || 0
        }
        entry[cat] = sum
        entry.total += sum
      }
      result.push(entry)
    }
    return result
  }

  // Non-TTM: direct bucket by period
  const map = new Map<string, Map<string, number>>()
  for (const item of items) {
    const key = getPeriodKey(item.createdTime, period)
    if (!key || key < minPeriod) continue
    if (!map.has(key)) map.set(key, new Map())
    const cats = map.get(key)!
    const cat = categorizeSource(item.source)
    cats.set(cat, (cats.get(cat) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([key, cats]) => {
      const entry: StackedData = {
        period: key,
        label: formatPeriodLabel(key, period),
        total: Array.from(cats.values()).reduce((a, b) => a + b, 0),
      }
      for (const cat of SOURCE_CATEGORIES) {
        entry[cat] = cats.get(cat) || 0
      }
      return entry
    })
    .sort((a, b) => a.period.localeCompare(b.period))
}

type LeadsChartMode = "source" | "status"
type OppsChartMode = "source" | "status" | "converted"

const STATUS_COLORS: string[] = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function buildStackedByStatus(
  items: { createdTime: string | null; status: string }[],
  period: LeadsPeriod,
  allStatuses: string[],
): StackedData[] {
  const minPeriod = CHART_START[period]

  if (period === "ttm") {
    const monthMap = new Map<string, Map<string, number>>()
    for (const item of items) {
      const key = getMonth(item.createdTime)
      if (!key) continue
      if (!monthMap.has(key)) monthMap.set(key, new Map())
      const statuses = monthMap.get(key)!
      statuses.set(item.status, (statuses.get(item.status) || 0) + 1)
    }
    const allMonths = Array.from(monthMap.keys()).sort()
    if (allMonths.length === 0) return []
    const result: StackedData[] = []
    for (const endMonth of allMonths) {
      if (endMonth < minPeriod) continue
      const [ey, em] = endMonth.split("-").map(Number)
      const startDate = new Date(ey, em - 12, 1)
      const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`
      const windowMonths = getMonthRange(startMonth, endMonth)
      const entry: StackedData = { period: endMonth, label: formatPeriodLabel(endMonth, period), total: 0 }
      for (const s of allStatuses) {
        let sum = 0
        for (const m of windowMonths) sum += monthMap.get(m)?.get(s) || 0
        entry[s] = sum
        entry.total += sum
      }
      result.push(entry)
    }
    return result
  }

  const map = new Map<string, Map<string, number>>()
  for (const item of items) {
    const key = getPeriodKey(item.createdTime, period)
    if (!key || key < minPeriod) continue
    if (!map.has(key)) map.set(key, new Map())
    const statuses = map.get(key)!
    statuses.set(item.status, (statuses.get(item.status) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([key, statuses]) => {
      const entry: StackedData = { period: key, label: formatPeriodLabel(key, period), total: Array.from(statuses.values()).reduce((a, b) => a + b, 0) }
      for (const s of allStatuses) entry[s] = statuses.get(s) || 0
      return entry
    })
    .sort((a, b) => a.period.localeCompare(b.period))
}

// ── Component ──

export function LeadsPage({ period, timeRange = "all" }: { period: LeadsPeriod; timeRange?: LeadsTimeRange }) {
  const [leadRows, setLeadRows] = useState<LeadRow[]>([])
  const [oppRows, setOppRows] = useState<OppRow[]>([])
  const [billedByMonth, setBilledByMonth] = useState<{ period: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [tableView, setTableView] = useState<TableView>("leads")
  const [search, setSearch] = useState("")
  const [leadSortField, setLeadSortField] = useState<LeadSortField>("createdTime")
  const [oppSortField, setOppSortField] = useState<OppSortField>("createdTime")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [page, setPage] = useState(1)
  const [leadsChartMode, setLeadsChartMode] = useState<LeadsChartMode>("source")
  const [oppsChartMode, setOppsChartMode] = useState<OppsChartMode>("source")
  const [filterSource, setFilterSource] = useState<Set<string>>(new Set())
  const [filterCampaign, setFilterCampaign] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<Set<string>>(new Set())
  const [filterStage, setFilterStage] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      fetch("/api/leads").then((r) => r.json()),
      fetch("/api/metrics/cohort-revenue").then((r) => r.json()),
    ])
      .then(([leadsData, cohortData]) => {
        setLeadRows(leadsData.leads || [])
        setOppRows(leadsData.opportunities || [])
        setBilledByMonth(cohortData.newCustomers || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Reset page when period changes
  useEffect(() => setPage(1), [period])

  const EXCLUDED_STATUSES = new Set(["Junk", "Unknown"])

  // Combined items for "Leads" chart (leads + opportunities), excluding Junk/Unknown leads
  const allItems = useMemo(
    () => [
      ...leadRows
        .filter((l) => !EXCLUDED_STATUSES.has(l.leadStatus || ""))
        .map((l) => ({ createdTime: l.createdTime, source: l.leadSource })),
      ...oppRows.map((o) => ({ createdTime: o.createdTime, source: o.leadSource })),
    ],
    [leadRows, oppRows]
  )

  // Opportunity items
  const oppItems = useMemo(
    () => oppRows.map((o) => ({ createdTime: o.createdTime, source: o.leadSource })),
    [oppRows]
  )

  // Conversion items (Closed Won only)
  const conversionItems = useMemo(
    () =>
      oppRows
        .filter((o) => o.stage === "Closed Won")
        .map((o) => ({ createdTime: o.createdTime, source: o.leadSource })),
    [oppRows]
  )

  // Chart data
  const leadsChartData = useMemo(() => buildStackedData(allItems, period), [allItems, period])
  const oppsChartData = useMemo(() => buildStackedData(oppItems, period), [oppItems, period])
  const convChartData = useMemo(() => buildStackedData(conversionItems, period), [conversionItems, period])

  // Status-based items for "By Status" view, excluding closed/junk statuses
  const EXCLUDED_STATUS_VIEW = new Set(["Junk", "Unknown", "Junk Lead", "Closed Lost", "Closed Won"])

  const allItemsWithStatus = useMemo(
    () => [
      ...leadRows
        .filter((l) => !EXCLUDED_STATUS_VIEW.has(l.leadStatus || "Unknown"))
        .map((l) => ({ createdTime: l.createdTime, status: l.leadStatus || "Unknown" })),
      ...oppRows
        .filter((o) => !EXCLUDED_STATUS_VIEW.has(o.stage || "Unknown"))
        .map((o) => ({ createdTime: o.createdTime, status: o.stage || "Unknown" })),
    ],
    [leadRows, oppRows]
  )

  const allLeadStatuses = useMemo(() => {
    const set = new Set<string>()
    for (const item of allItemsWithStatus) set.add(item.status)
    return Array.from(set).sort()
  }, [allItemsWithStatus])

  const leadsByStatusData = useMemo(
    () => buildStackedByStatus(allItemsWithStatus, period, allLeadStatuses),
    [allItemsWithStatus, period, allLeadStatuses]
  )

  // Opportunities by status (exclude closed/junk statuses)
  const oppItemsWithStatus = useMemo(
    () => oppRows
      .filter((o) => !EXCLUDED_STATUS_VIEW.has(o.stage || "Unknown"))
      .map((o) => ({ createdTime: o.createdTime, status: o.stage || "Unknown" })),
    [oppRows]
  )

  const oppStatuses = useMemo(() => {
    const set = new Set<string>()
    for (const item of oppItemsWithStatus) set.add(item.status)
    return Array.from(set).sort()
  }, [oppItemsWithStatus])

  const oppsByStatusData = useMemo(
    () => buildStackedByStatus(oppItemsWithStatus, period, oppStatuses),
    [oppItemsWithStatus, period, oppStatuses]
  )

  // Conversion rate per period: opps / total leads * 100
  const oppsConvertedData = useMemo(() => {
    const leadsPerPeriod = new Map<string, number>()
    const oppsPerPeriod = new Map<string, number>()
    const minPeriod = CHART_START[period]

    for (const item of allItems) {
      const key = getPeriodKey(item.createdTime, period)
      if (!key || key < minPeriod) continue
      leadsPerPeriod.set(key, (leadsPerPeriod.get(key) || 0) + 1)
    }
    for (const o of oppRows) {
      const key = getPeriodKey(o.createdTime, period)
      if (!key || key < minPeriod) continue
      oppsPerPeriod.set(key, (oppsPerPeriod.get(key) || 0) + 1)
    }

    const allPeriodKeys = [...new Set([...leadsPerPeriod.keys(), ...oppsPerPeriod.keys()])].sort()
    return allPeriodKeys.map((key) => {
      const totalLeads = leadsPerPeriod.get(key) || 0
      const opps = oppsPerPeriod.get(key) || 0
      const rate = totalLeads > 0 ? Math.round((opps / totalLeads) * 100) : 0
      return { period: key, label: formatPeriodLabel(key, period), rate }
    })
  }, [allItems, oppRows, period])

  // Win Rate data — Closed Won vs Closed Lost
  const [winRateRange, setWinRateRange] = useState<"all" | "quarter" | "ttm">("all")

  const winRateSegments = useMemo(() => {
    const now = new Date()
    let filtered = oppRows.filter((o) => o.stage === "Closed Won" || o.stage === "Closed Lost")

    if (winRateRange === "quarter") {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1)
      const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 0)
      filtered = filtered.filter((o) => {
        if (!o.createdTime) return false
        const d = new Date(o.createdTime)
        return d >= qStart && d <= qEnd
      })
    } else if (winRateRange === "ttm") {
      const ttmStart = new Date(now.getFullYear(), now.getMonth() - 12, 1)
      filtered = filtered.filter((o) => {
        if (!o.createdTime) return false
        return new Date(o.createdTime) >= ttmStart
      })
    }

    const won = filtered.filter((o) => o.stage === "Closed Won").length
    const lost = filtered.filter((o) => o.stage === "Closed Lost").length
    return { won, lost, total: won + lost }
  }, [oppRows, winRateRange])

  // Lead Conversion Rate by source category
  const [convRateMode, setConvRateMode] = useState<"opportunities" | "conversions">("opportunities")

  const convRateData = useMemo(() => {
    // Count leads per source category (excluding junk/unknown)
    const leadsBySource = new Map<string, number>()
    for (const l of leadRows) {
      if (EXCLUDED_STATUSES.has(l.leadStatus || "")) continue
      const cat = categorizeSource(l.leadSource)
      leadsBySource.set(cat, (leadsBySource.get(cat) || 0) + 1)
    }
    // Also add opportunities to the lead count (total leads = leads + opps)
    for (const o of oppRows) {
      const cat = categorizeSource(o.leadSource)
      leadsBySource.set(cat, (leadsBySource.get(cat) || 0) + 1)
    }

    // Count opportunities per source category
    const oppsBySource = new Map<string, number>()
    for (const o of oppRows) {
      const cat = categorizeSource(o.leadSource)
      oppsBySource.set(cat, (oppsBySource.get(cat) || 0) + 1)
    }

    // Count conversions (Closed Won) per source category
    const convBySource = new Map<string, number>()
    for (const o of oppRows) {
      if (o.stage !== "Closed Won") continue
      const cat = categorizeSource(o.leadSource)
      convBySource.set(cat, (convBySource.get(cat) || 0) + 1)
    }

    return SOURCE_CATEGORIES
      .map((cat) => {
        const totalLeads = leadsBySource.get(cat) || 0
        const opps = oppsBySource.get(cat) || 0
        const conv = convBySource.get(cat) || 0
        const oppRate = totalLeads > 0 ? Math.round((opps / totalLeads) * 100) : 0
        const convRate = totalLeads > 0 ? Math.round((conv / totalLeads) * 100) : 0
        return { name: cat, value: convRateMode === "opportunities" ? oppRate : convRate }
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [leadRows, oppRows, convRateMode])

  // Sort + filter table
  const handleLeadSort = (field: LeadSortField) => {
    if (leadSortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setLeadSortField(field)
      setSortDir("asc")
    }
    setPage(1)
  }

  const handleOppSort = (field: OppSortField) => {
    if (oppSortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setOppSortField(field)
      setSortDir("asc")
    }
    setPage(1)
  }

  const LeadSortIcon = ({ field }: { field: LeadSortField }) => {
    if (leadSortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
  }

  const OppSortIcon = ({ field }: { field: OppSortField }) => {
    if (oppSortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
  }

  // Filter options derived from data
  const leadSourceOptions = useMemo(() => [...new Set(leadRows.map((r) => r.leadSource))].sort(), [leadRows])
  const leadCampaignOptions = useMemo(() => [...new Set(leadRows.map((r) => r.adCampaignName || "—").filter(Boolean))].sort(), [leadRows])
  const leadStatusOptions = useMemo(() => [...new Set(leadRows.map((r) => r.leadStatus || "Unknown"))].sort(), [leadRows])
  const oppSourceOptions = useMemo(() => [...new Set(oppRows.map((r) => r.leadSource))].sort(), [oppRows])
  const oppStageOptions = useMemo(() => [...new Set(oppRows.map((r) => r.stage || "Unknown"))].sort(), [oppRows])

  const filteredLeads = useMemo(() => {
    let rows = leadRows
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (r) =>
          (r.company || "").toLowerCase().includes(q) ||
          (r.fullName || "").toLowerCase().includes(q) ||
          r.leadSource.toLowerCase().includes(q) ||
          (r.adCampaignName || "").toLowerCase().includes(q)
      )
    }
    if (filterSource.size > 0) rows = rows.filter((r) => filterSource.has(r.leadSource))
    if (filterCampaign.size > 0) rows = rows.filter((r) => filterCampaign.has(r.adCampaignName || "—"))
    if (filterStatus.size > 0) rows = rows.filter((r) => filterStatus.has(r.leadStatus || "Unknown"))
    return [...rows].sort((a, b) => {
      const av = a[leadSortField] || ""
      const bv = b[leadSortField] || ""
      const cmp = String(av).localeCompare(String(bv))
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [leadRows, search, leadSortField, sortDir, filterSource, filterCampaign, filterStatus])

  const filteredOpps = useMemo(() => {
    let rows = oppRows
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (r) =>
          (r.opportunityName || "").toLowerCase().includes(q) ||
          r.leadSource.toLowerCase().includes(q) ||
          (r.stage || "").toLowerCase().includes(q) ||
          (r.leadSourceDetail || "").toLowerCase().includes(q)
      )
    }
    if (filterSource.size > 0) rows = rows.filter((r) => filterSource.has(r.leadSource))
    if (filterStage.size > 0) rows = rows.filter((r) => filterStage.has(r.stage || "Unknown"))
    return [...rows].sort((a, b) => {
      const av = a[oppSortField] || ""
      const bv = b[oppSortField] || ""
      const cmp = String(av).localeCompare(String(bv))
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [oppRows, search, oppSortField, sortDir, filterSource, filterStage])

  const activeRows = tableView === "leads" ? filteredLeads : filteredOpps
  const totalPages = Math.ceil(activeRows.length / PAGE_SIZE)
  const leadPageRows = filteredLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const oppPageRows = filteredOpps.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Time-range filter for KPI totals
  const kpiTotals = useMemo(() => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const ttmStart = new Date(now.getFullYear(), now.getMonth() - 12, 1)
    const ytdStart = new Date(now.getFullYear(), 0, 1)

    const inRange = (d: string | null): boolean => {
      if (!d) return false
      const date = new Date(d)
      if (isNaN(date.getTime())) return false
      if (timeRange === "all") return true
      if (timeRange === "ytd") return date >= ytdStart
      return date >= ttmStart && date < new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const totalLeads = leadRows.filter((l) => inRange(l.createdTime)).length
      + oppRows.filter((o) => inRange(o.createdTime)).length
    const totalOpps = oppRows.filter((o) => inRange(o.createdTime)).length
    const totalConversions = oppRows.filter((o) => o.stage === "Closed Won" && inRange(o.closingDate || o.createdTime)).length

    // Billed: count customers whose first billing month falls in the range
    let totalBilled = 0
    for (const b of billedByMonth) {
      const [y, m] = b.period.split("-").map(Number)
      const firstOfMonth = new Date(y, m - 1, 1)
      if (timeRange === "all") {
        totalBilled += b.count
      } else if (timeRange === "ytd" && firstOfMonth >= ytdStart && b.period < currentMonth) {
        totalBilled += b.count
      } else if (timeRange === "ttm" && firstOfMonth >= ttmStart && b.period < currentMonth) {
        totalBilled += b.count
      }
    }

    return { totalLeads, totalOpps, totalConversions, totalBilled }
  }, [leadRows, oppRows, billedByMonth, timeRange])

  const EXCLUDED_LEAD_STATUSES = new Set(["Junk", "Unknown", "Junk Lead", "Closed Lost"])

  const openLeadsData = useMemo(() => {
    const statusMap = new Map<string, number>()
    for (const l of leadRows) {
      const status = l.leadStatus || "Unknown"
      if (EXCLUDED_LEAD_STATUSES.has(status)) continue
      statusMap.set(status, (statusMap.get(status) || 0) + 1)
    }
    return Array.from(statusMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [leadRows])

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><CardDescription>Loading...</CardDescription></CardHeader>
              <CardContent><div className="h-8 w-24 animate-pulse rounded bg-muted" /></CardContent>
            </Card>
          ))}
        </div>
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6"><div className="h-[300px] animate-pulse rounded bg-muted" /></CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // ── Empty ──
  if (leadRows.length === 0 && oppRows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No leads data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Import leads and opportunities from the Import page to get started
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {(() => {
        const { totalLeads, totalOpps, totalConversions, totalBilled } = kpiTotals
        const oppRate = totalLeads > 0 ? (totalOpps / totalLeads) * 100 : 0
        const convRate = totalOpps > 0 ? (totalConversions / totalOpps) * 100 : 0
        const billedRate = totalConversions > 0 ? (totalBilled / totalConversions) * 100 : 0
        const rangeLabel = timeRange === "all" ? "All time" : timeRange === "ttm" ? "TTM" : "YTD"
        const kpis: { title: string; value: number; rateLabel?: string; rate?: number }[] = [
          { title: "Leads", value: totalLeads },
          { title: "Opportunities", value: totalOpps, rateLabel: "of total leads", rate: oppRate },
          { title: "Conversions", value: totalConversions, rateLabel: "of total opportunities", rate: convRate },
          { title: "Billed", value: totalBilled, rateLabel: "of total conversions", rate: billedRate },
        ]
        return (
          <div className="grid gap-4 md:grid-cols-4">
            {kpis.map((kpi) => (
              <Card key={kpi.title}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-sm font-medium">{kpi.title}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{kpi.value.toLocaleString()}</div>
                  {kpi.rate != null ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-semibold text-foreground">{kpi.rate.toFixed(1)}%</span> {kpi.rateLabel} ({rangeLabel})
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">{rangeLabel}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      })()}

      {/* New Customers Billed */}
      <NewCustomersChart period={period === "annually" ? "ttm" : period} />

      {/* Charts */}
      <div className="grid gap-6 grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Leads Created {leadsChartMode === "source" ? "by Source" : "by Status"}
                <InfoTooltip text="Leads + Opportunities per period. By Source excludes Junk and Unknown leads. By Status also excludes Closed Won, Junk Lead, and Closed Lost." />
              </CardTitle>
              <Tabs value={leadsChartMode} onValueChange={(v) => setLeadsChartMode(v as LeadsChartMode)}>
                <TabsList className="bg-muted h-9">
                  <TabsTrigger value="source" className="px-4">By Source</TabsTrigger>
                  <TabsTrigger value="status" className="px-4">By Status</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {leadsChartMode === "source" ? (
              leadsChartData.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">No data for this period</div>
              ) : (
                <ChartContainer config={CHART_CONFIG} className="aspect-auto h-[300px] w-full">
                  <BarChart data={leadsChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="5 4" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent className="min-w-[200px]" filterZero />} />
                    <Legend />
                    {SOURCE_CATEGORIES.map((cat, i) => (
                      <Bar key={cat} dataKey={cat} name={cat} stackId="a" fill={SOURCE_CATEGORY_COLORS[cat]} radius={i === SOURCE_CATEGORIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ChartContainer>
              )
            ) : (
              leadsByStatusData.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">No data for this period</div>
              ) : (
                <ChartContainer
                  config={Object.fromEntries(allLeadStatuses.map((s, i) => [s, { label: s, color: STATUS_COLORS[i % STATUS_COLORS.length] }])) satisfies ChartConfig}
                  className="aspect-auto h-[300px] w-full"
                >
                  <BarChart data={leadsByStatusData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="5 4" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent className="min-w-[200px]" filterZero />} />
                    <Legend />
                    {allLeadStatuses.map((s, i) => (
                      <Bar key={s} dataKey={s} name={s} stackId="a" fill={STATUS_COLORS[i % STATUS_COLORS.length]} radius={i === allLeadStatuses.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ChartContainer>
              )
            )}
          </CardContent>
        </Card>
        <Card className="col-span-1 flex flex-col">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              Open Leads
              <InfoTooltip text="Active leads by status. Excludes Junk, Unknown, Junk Lead, and Closed Lost." />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 pt-4 pb-2">
            {openLeadsData.length > 0 ? (
              <ChartContainer
                config={{ count: { label: "Leads", color: "var(--primary)" } } satisfies ChartConfig}
                className="w-full flex-1"
              >
                <BarChart
                  data={openLeadsData}
                  layout="vertical"
                  margin={{ left: -10, right: 50, top: 5, bottom: 5 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="4" stroke="var(--border)" />
                  <XAxis type="number" dataKey="value" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    tickMargin={8}
                    axisLine={false}
                    width={100}
                    tick={{ fontSize: 13 }}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="value" name="Leads" fill="var(--primary)" radius={6}>
                    <LabelList
                      dataKey="value"
                      offset={8}
                      position="right"
                      className="fill-foreground text-xs"
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No open leads</p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 grid-cols-3">
        {/* Lead Conversion Rate */}
        <Card className="col-span-1 flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Lead Conversion Rate
                <InfoTooltip text="Percentage of leads per source that became opportunities or converted (Closed Won). Total leads = leads + opportunities." />
              </CardTitle>
              <Tabs value={convRateMode} onValueChange={(v) => setConvRateMode(v as "opportunities" | "conversions")}>
                <TabsList className="bg-muted h-9">
                  <TabsTrigger value="opportunities" className="px-3">Opps</TabsTrigger>
                  <TabsTrigger value="conversions" className="px-3">Won</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 pt-4 pb-2">
            {convRateData.length > 0 ? (
              <ChartContainer
                config={{ rate: { label: convRateMode === "opportunities" ? "Opp Rate" : "Win Rate", color: "var(--primary)" } } satisfies ChartConfig}
                className="w-full flex-1"
              >
                <BarChart
                  data={convRateData}
                  layout="vertical"
                  margin={{ left: -10, right: 50, top: 5, bottom: 5 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="4" stroke="var(--border)" />
                  <XAxis type="number" dataKey="value" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    tickMargin={8}
                    axisLine={false}
                    width={100}
                    tick={{ fontSize: 13 }}
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel formatter={(v) => `${v}%`} />} />
                  <Bar dataKey="value" name={convRateMode === "opportunities" ? "Opp Rate" : "Win Rate"} fill="var(--primary)" radius={6}>
                    <LabelList
                      dataKey="value"
                      offset={8}
                      position="right"
                      className="fill-foreground text-xs"
                      formatter={(v) => `${v}%`}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No conversion data</p>
            )}
          </CardContent>
        </Card>
        {/* Opportunities Chart with Converted toggle */}
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {oppsChartMode === "converted" ? "Opportunity Conversion Rate" : `Opportunities Created ${oppsChartMode === "source" ? "by Source" : "by Status"}`}
                  <InfoTooltip text="Opportunities per period. Converted shows the % of leads that became opportunities each period." />
                </CardTitle>
                <Tabs value={oppsChartMode} onValueChange={(v) => setOppsChartMode(v as OppsChartMode)}>
                  <TabsList className="bg-muted h-9">
                    <TabsTrigger value="source" className="px-4">By Source</TabsTrigger>
                    <TabsTrigger value="status" className="px-4">By Status</TabsTrigger>
                    <TabsTrigger value="converted" className="px-4">Converted</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {oppsChartMode === "converted" ? (
                oppsConvertedData.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">No data for this period</div>
                ) : (
                  <ChartContainer config={{ rate: { label: "Conversion %", color: "var(--primary)" } } satisfies ChartConfig} className="aspect-auto h-[300px] w-full">
                    <BarChart data={oppsConvertedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="5 4" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                      <YAxis tickLine={false} axisLine={false} className="text-xs" tickFormatter={(v) => `${v}%`} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent className="min-w-[200px]" formatter={(v) => `${v}%`} />} />
                      <Bar dataKey="rate" name="Conversion %" fill="var(--primary)" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="rate" position="top" className="fill-foreground text-xs" formatter={(v) => `${v}%`} />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )
              ) : oppsChartMode === "source" ? (
                oppsChartData.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">No data for this period</div>
                ) : (
                  <ChartContainer config={CHART_CONFIG} className="aspect-auto h-[300px] w-full">
                    <BarChart data={oppsChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="5 4" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                      <YAxis tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent className="min-w-[200px]" filterZero />} />
                      <Legend />
                      {SOURCE_CATEGORIES.map((cat, i) => (
                        <Bar key={cat} dataKey={cat} name={cat} stackId="a" fill={SOURCE_CATEGORY_COLORS[cat]} radius={i === SOURCE_CATEGORIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ChartContainer>
                )
              ) : (
                oppsByStatusData.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">No data for this period</div>
                ) : (
                  <ChartContainer
                    config={Object.fromEntries(oppStatuses.map((s, i) => [s, { label: s, color: STATUS_COLORS[i % STATUS_COLORS.length] }])) satisfies ChartConfig}
                    className="aspect-auto h-[300px] w-full"
                  >
                    <BarChart data={oppsByStatusData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="5 4" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
                      <YAxis tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent className="min-w-[200px]" filterZero />} />
                      <Legend />
                      {oppStatuses.map((s, i) => (
                        <Bar key={s} dataKey={s} name={s} stackId="a" fill={STATUS_COLORS[i % STATUS_COLORS.length]} radius={i === oppStatuses.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ChartContainer>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="grid gap-6 grid-cols-3">
        {/* Opportunity Win Rate */}
        <Card className="col-span-1 flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Opportunity Win Rate
                <InfoTooltip text="Ratio of Closed Won to total closed opportunities (Closed Won + Closed Lost)." />
              </CardTitle>
              <Tabs value={winRateRange} onValueChange={(v) => setWinRateRange(v as "all" | "quarter" | "ttm")}>
                <TabsList className="bg-muted h-9">
                  <TabsTrigger value="all" className="px-3">All</TabsTrigger>
                  <TabsTrigger value="quarter" className="px-3">Last Qtr</TabsTrigger>
                  <TabsTrigger value="ttm" className="px-3">TTM</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 items-center justify-center">
            {winRateSegments.total > 0 ? (
              <ChartContainer
                config={{ won: { label: "Won" }, lost: { label: "Lost" } } satisfies ChartConfig}
                className="aspect-square w-full max-w-[280px]"
              >
                <PieChart margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={[
                      { name: "Closed Won", value: winRateSegments.won },
                      { name: "Closed Lost", value: winRateSegments.lost },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    <Cell fill="var(--chart-5)" />
                    <Cell fill="var(--chart-1)" />
                    <ChartLabel
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          const rate = winRateSegments.total > 0 ? ((winRateSegments.won / winRateSegments.total) * 100).toFixed(1) : "0"
                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="auto">
                              <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-semibold">
                                {rate}%
                              </tspan>
                              <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground text-sm">
                                win rate
                              </tspan>
                            </text>
                          )
                        }
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8">No closed opportunities</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Tabs value={tableView} onValueChange={(v) => { setTableView(v as TableView); setSearch(""); setPage(1); setFilterSource(new Set()); setFilterCampaign(new Set()); setFilterStatus(new Set()); setFilterStage(new Set()) }}>
                <TabsList className="bg-muted h-9">
                  <TabsTrigger value="leads" className="px-4">Leads</TabsTrigger>
                  <TabsTrigger value="opportunities" className="px-4">Opportunities</TabsTrigger>
                </TabsList>
              </Tabs>
              <CardDescription>
                {activeRows.length.toLocaleString()} {tableView === "leads" ? "leads" : "opportunities"}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${tableView}...`}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <MultiSelect
              options={tableView === "leads" ? leadSourceOptions : oppSourceOptions}
              selected={filterSource}
              onChange={(s) => { setFilterSource(s); setPage(1) }}
              placeholder="Sources"
            />
            {tableView === "leads" ? (
              <>
                <MultiSelect
                  options={leadCampaignOptions}
                  selected={filterCampaign}
                  onChange={(s) => { setFilterCampaign(s); setPage(1) }}
                  placeholder="Campaigns"
                  width="w-[200px]"
                />
                <MultiSelect
                  options={leadStatusOptions}
                  selected={filterStatus}
                  onChange={(s) => { setFilterStatus(s); setPage(1) }}
                  placeholder="Statuses"
                />
              </>
            ) : (
              <MultiSelect
                options={oppStageOptions}
                selected={filterStage}
                onChange={(s) => { setFilterStage(s); setPage(1) }}
                placeholder="Stages"
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {tableView === "leads" ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleLeadSort("company")}>
                      <div className="flex items-center gap-1">Company <LeadSortIcon field="company" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleLeadSort("fullName")}>
                      <div className="flex items-center gap-1">Full Name <LeadSortIcon field="fullName" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleLeadSort("leadSource")}>
                      <div className="flex items-center gap-1">Source <LeadSortIcon field="leadSource" /></div>
                    </TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleLeadSort("leadStatus")}>
                      <div className="flex items-center gap-1">Status <LeadSortIcon field="leadStatus" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleLeadSort("createdTime")}>
                      <div className="flex items-center gap-1">Created <LeadSortIcon field="createdTime" /></div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadPageRows.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.company || "—"}</TableCell>
                      <TableCell>{lead.fullName || "—"}</TableCell>
                      <TableCell>{lead.leadSource}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{lead.adCampaignName || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{lead.leadStatus || "Unknown"}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(lead.createdTime)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleOppSort("opportunityName")}>
                      <div className="flex items-center gap-1">Opportunity <OppSortIcon field="opportunityName" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleOppSort("leadSource")}>
                      <div className="flex items-center gap-1">Source <OppSortIcon field="leadSource" /></div>
                    </TableHead>
                    <TableHead>Source Detail</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleOppSort("stage")}>
                      <div className="flex items-center gap-1">Stage <OppSortIcon field="stage" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleOppSort("closingDate")}>
                      <div className="flex items-center gap-1">Closing Date <OppSortIcon field="closingDate" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleOppSort("createdTime")}>
                      <div className="flex items-center gap-1">Created <OppSortIcon field="createdTime" /></div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {oppPageRows.map((opp) => (
                    <TableRow key={opp.id}>
                      <TableCell className="font-medium">{opp.opportunityName || "—"}</TableCell>
                      <TableCell>{opp.leadSource}</TableCell>
                      <TableCell>{opp.leadSourceDetail || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={opp.stage === "Closed Won" ? "default" : "secondary"}>
                          {opp.stage || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(opp.closingDate)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(opp.createdTime)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Reusable stacked bar chart ──

const CHART_CONFIG = Object.fromEntries(
  SOURCE_CATEGORIES.map((cat) => [
    cat,
    { label: cat, color: SOURCE_CATEGORY_COLORS[cat] },
  ])
) satisfies ChartConfig

function SourceStackedChart({
  title,
  tooltip,
  data,
  className,
}: {
  title: string
  tooltip: string
  data: StackedData[]
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <InfoTooltip text={tooltip} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No data for this period
          </div>
        ) : (
          <ChartContainer config={CHART_CONFIG} className="aspect-auto h-[300px] w-full">
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="5 4" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
              <YAxis tickLine={false} axisLine={false} className="text-xs" allowDecimals={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    className="min-w-[200px]"
                    filterZero
                  />
                }
              />
              <Legend />
              {SOURCE_CATEGORIES.map((cat, i) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  name={cat}
                  stackId="a"
                  fill={SOURCE_CATEGORY_COLORS[cat]}
                  radius={i === SOURCE_CATEGORIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

