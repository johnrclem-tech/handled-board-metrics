"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { InfoTooltip } from "@/components/info-tooltip"
import {
  Users,
  Handshake,
  Trophy,
  TrendingUp,
  TrendingDown,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

// ── Types ──

export type LeadsPeriod = "monthly" | "quarterly" | "annually"

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

type SortField = "company" | "fullName" | "leadSource" | "leadStatus" | "createdTime"
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
  if (period === "monthly") return getMonth(d)
  if (period === "quarterly") return getQuarter(d)
  return getYear(d)
}

function formatPeriodLabel(key: string, period: LeadsPeriod): string {
  if (period === "monthly") {
    const [year, m] = key.split("-")
    const date = new Date(Number(year), Number(m) - 1)
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
  }
  if (period === "quarterly") {
    return key // "2026-Q1"
  }
  return key // "2026"
}

/** Get the last complete period key before "now" */
function getLastCompletePeriod(period: LeadsPeriod): string {
  const now = new Date()
  if (period === "monthly") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }
  if (period === "quarterly") {
    const currentQ = Math.ceil((now.getMonth() + 1) / 3)
    if (currentQ === 1) return `${now.getFullYear() - 1}-Q4`
    return `${now.getFullYear()}-Q${currentQ - 1}`
  }
  return `${now.getFullYear() - 1}`
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
}

function buildStackedData(
  items: { createdTime: string | null; source: string }[],
  period: LeadsPeriod,
): StackedData[] {
  const minPeriod = CHART_START[period]
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

// ── Component ──

export function LeadsPage({ period }: { period: LeadsPeriod }) {
  const [leadRows, setLeadRows] = useState<LeadRow[]>([])
  const [oppRows, setOppRows] = useState<OppRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("createdTime")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [page, setPage] = useState(1)

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

  // Combined items for "Leads" chart (leads + opportunities)
  const allItems = useMemo(
    () => [
      ...leadRows.map((l) => ({ createdTime: l.createdTime, source: l.leadSource })),
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

  // KPI cards — last complete period
  const lastPeriod = getLastCompletePeriod(period)
  const lastPeriodLeads = leadsChartData.find((d) => d.period === lastPeriod)?.total ?? 0
  const lastPeriodOpps = oppsChartData.find((d) => d.period === lastPeriod)?.total ?? 0
  const lastPeriodConv = convChartData.find((d) => d.period === lastPeriod)?.total ?? 0

  // Sort + filter table
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
    setPage(1)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
  }

  const filtered = useMemo(() => {
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
    return [...rows].sort((a, b) => {
      const av = a[sortField] || ""
      const bv = b[sortField] || ""
      const cmp = String(av).localeCompare(String(bv))
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [leadRows, search, sortField, sortDir])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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

  const periodLabel =
    period === "monthly" ? "Month" : period === "quarterly" ? "Quarter" : "Year"
  const lastPeriodLabel = formatPeriodLabel(lastPeriod, period)

  const kpis = [
    {
      title: "Leads",
      value: lastPeriodLeads.toLocaleString(),
      description: `${lastPeriodLabel} (last complete ${periodLabel.toLowerCase()})`,
      icon: Users,
      color: "text-chart-1",
      bg: "bg-chart-1/15",
    },
    {
      title: "Opportunities",
      value: lastPeriodOpps.toLocaleString(),
      description: `${lastPeriodLabel} (last complete ${periodLabel.toLowerCase()})`,
      icon: Handshake,
      color: "text-chart-2",
      bg: "bg-chart-2/15",
    },
    {
      title: "Conversions",
      value: lastPeriodConv.toLocaleString(),
      description: `${lastPeriodLabel} — Closed Won`,
      icon: Trophy,
      color: "text-chart-3",
      bg: "bg-chart-3/15",
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
              <span className="text-xs text-muted-foreground">{kpi.description}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <SourceStackedChart
        title="Leads by Source"
        tooltip="Leads + Opportunities per period, stacked by source."
        data={leadsChartData}
      />
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
            <div>
              <CardTitle>All Leads</CardTitle>
              <CardDescription>
                {filtered.length.toLocaleString()} leads from imported data
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("company")}>
                    <div className="flex items-center gap-1">Company <SortIcon field="company" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("fullName")}>
                    <div className="flex items-center gap-1">Full Name <SortIcon field="fullName" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("leadSource")}>
                    <div className="flex items-center gap-1">Source <SortIcon field="leadSource" /></div>
                  </TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("leadStatus")}>
                    <div className="flex items-center gap-1">Status <SortIcon field="leadStatus" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("createdTime")}>
                    <div className="flex items-center gap-1">Created <SortIcon field="createdTime" /></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((lead) => (
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
}: {
  title: string
  tooltip: string
  data: StackedData[]
}) {
  return (
    <Card>
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
