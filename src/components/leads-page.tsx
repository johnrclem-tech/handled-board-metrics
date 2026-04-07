"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InfoTooltip } from "@/components/info-tooltip"
import StatisticsTrendCard from "@/components/shadcn-studio/blocks/statistics-trend-card"
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
} from "recharts"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

// ── Types ──

export type LeadsPeriod = "monthly" | "quarterly" | "annually" | "ttm"

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

export function LeadsPage({ period }: { period: LeadsPeriod }) {
  const [leadRows, setLeadRows] = useState<LeadRow[]>([])
  const [oppRows, setOppRows] = useState<OppRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tableView, setTableView] = useState<TableView>("leads")
  const [search, setSearch] = useState("")
  const [leadSortField, setLeadSortField] = useState<LeadSortField>("createdTime")
  const [oppSortField, setOppSortField] = useState<OppSortField>("createdTime")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [page, setPage] = useState(1)
  const [leadsChartMode, setLeadsChartMode] = useState<LeadsChartMode>("source")
  const [filterSource, setFilterSource] = useState<Set<string>>(new Set())
  const [filterCampaign, setFilterCampaign] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<Set<string>>(new Set())
  const [filterStage, setFilterStage] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((data) => {
        setLeadRows(data.leads || [])
        setOppRows(data.opportunities || [])
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

  // Build trend data for StatisticsTrendCards
  const trendData = useMemo(() => {
    const leadsMap = new Map(leadsChartData.map((d) => [d.period, d.total]))
    const oppsMap = new Map(oppsChartData.map((d) => [d.period, d.total]))
    const convMap = new Map(convChartData.map((d) => [d.period, d.total]))
    const allPeriods = [...new Set([
      ...leadsChartData.map((d) => d.period),
      ...oppsChartData.map((d) => d.period),
      ...convChartData.map((d) => d.period),
    ])].sort()
    return allPeriods.map((p) => ({
      date: formatPeriodLabel(p, period),
      leads: leadsMap.get(p) || 0,
      opportunities: oppsMap.get(p) || 0,
      conversions: convMap.get(p) || 0,
    }))
  }, [leadsChartData, oppsChartData, convChartData, period])

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

  const periodLabel =
    period === "monthly" ? "Monthly" : period === "quarterly" ? "Quarterly" : period === "ttm" ? "TTM" : "Annual"

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
      <div className="grid gap-4 md:grid-cols-3">
        <StatisticsTrendCard
          title={`${periodLabel} Leads`}
          data={trendData}
          dateKey="date"
          dataKey="leads"
          format="compact"
        />
        <StatisticsTrendCard
          title={`${periodLabel} Opportunities`}
          data={trendData}
          dateKey="date"
          dataKey="opportunities"
          format="compact"
        />
        <StatisticsTrendCard
          title={`${periodLabel} Conversions`}
          data={trendData}
          dateKey="date"
          dataKey="conversions"
          format="compact"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Leads {leadsChartMode === "source" ? "by Source" : "by Status"}
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
      <SourceStackedChart
        title="Opportunities by Source"
        tooltip="Opportunities per period, stacked by source."
        data={oppsChartData}
      />
      <SourceStackedChart
        title="Conversions by Source"
        tooltip="Closed Won opportunities per period, stacked by source."
        data={convChartData}
      />

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
