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
  UserPlus,
  Globe,
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
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts"

interface LeadRow {
  id: number
  company: string | null
  fullName: string | null
  leadSource: string | null
  adCampaignName: string | null
  ad: string | null
  leadStatus: string | null
  createdTime: string | null
}

interface LeadsSummary {
  totalLeads: number
  totalOpportunities: number
  currentMonthLeads: number
  priorMonthLeads: number
  conversionRate: number
  topSource: { source: string; count: number } | null
}

interface LeadsResponse {
  summary: LeadsSummary
  bySource: { source: string; count: number }[]
  byMonth: Record<string, unknown>[]
  allSources: string[]
  leads: LeadRow[]
}

type SortField = "company" | "fullName" | "leadSource" | "leadStatus" | "createdTime"
type SortDir = "asc" | "desc"

const PAGE_SIZE = 50

const SOURCE_COLORS: Record<string, string> = {
  Website: "var(--chart-1)",
  "Google AdWords": "var(--chart-2)",
  "Customer Referral": "var(--chart-3)",
  Unknown: "var(--chart-4)",
}

function getSourceColor(source: string, index: number): string {
  if (SOURCE_COLORS[source]) return SOURCE_COLORS[source]
  const fallbacks = [
    "var(--chart-5)",
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
  ]
  return fallbacks[index % fallbacks.length]
}

function formatDate(d: string | null): string {
  if (!d) return "—"
  const date = new Date(d)
  if (isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-")
  const date = new Date(Number(year), Number(m) - 1)
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
}

export function LeadsPage() {
  const [data, setData] = useState<LeadsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("createdTime")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
    if (!data) return []
    let rows = data.leads
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (r) =>
          (r.company || "").toLowerCase().includes(q) ||
          (r.fullName || "").toLowerCase().includes(q) ||
          (r.leadSource || "").toLowerCase().includes(q) ||
          (r.adCampaignName || "").toLowerCase().includes(q)
      )
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortField] || ""
      const bv = b[sortField] || ""
      const cmp = String(av).localeCompare(String(bv))
      return sortDir === "asc" ? cmp : -cmp
    })
    return rows
  }, [data, search, sortField, sortDir])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardDescription>Loading...</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-24 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-[300px] animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // ── Empty ──
  if (!data || data.summary.totalLeads === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No leads data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Import leads data from the Import page to get started
          </p>
        </CardContent>
      </Card>
    )
  }

  const { summary, bySource, byMonth, allSources } = data

  const momChange =
    summary.priorMonthLeads > 0
      ? ((summary.currentMonthLeads - summary.priorMonthLeads) / summary.priorMonthLeads) * 100
      : null

  const kpis = [
    {
      title: "Total Leads",
      value: summary.totalLeads.toLocaleString(),
      description: `${summary.totalLeads - summary.totalOpportunities} unconverted, ${summary.totalOpportunities} opportunities`,
      icon: Users,
      color: "text-chart-1",
      bg: "bg-chart-1/15",
    },
    {
      title: "This Month",
      value: summary.currentMonthLeads.toLocaleString(),
      description: momChange !== null ? `${momChange >= 0 ? "+" : ""}${momChange.toFixed(1)}% vs prior month` : "First month of data",
      icon: UserPlus,
      color: "text-chart-2",
      bg: "bg-chart-2/15",
      trend: momChange !== null ? (momChange >= 0 ? "up" : "down") : null,
    },
    {
      title: "Top Source",
      value: summary.topSource ? summary.topSource.source : "—",
      description: summary.topSource ? `${summary.topSource.count.toLocaleString()} leads` : "",
      icon: Globe,
      color: "text-chart-3",
      bg: "bg-chart-3/15",
    },
    {
      title: "Conversion Rate",
      value: `${summary.conversionRate.toFixed(1)}%`,
      description: `${summary.totalOpportunities} of ${summary.totalLeads} became opportunities`,
      icon: TrendingUp,
      color: "text-chart-4",
      bg: "bg-chart-4/15",
    },
  ]

  // Chart data
  const chartMonths = byMonth.map((entry) => ({
    ...entry,
    month: formatMonthLabel(entry.month as string),
  }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <div className="flex items-center gap-1 mt-1">
                {kpi.trend === "up" && (
                  <Badge variant="secondary" className="text-green-600 bg-green-50">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Up
                  </Badge>
                )}
                {kpi.trend === "down" && (
                  <Badge variant="secondary" className="text-red-600 bg-red-50">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    Down
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{kpi.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Leads Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Leads Over Time
              <InfoTooltip text="Monthly lead count by source, combining leads and opportunities." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartMonths} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
                <YAxis className="text-xs" tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                {allSources.map((src, i) => (
                  <Bar
                    key={src}
                    dataKey={src}
                    name={src}
                    stackId="a"
                    fill={getSourceColor(src, i)}
                    radius={i === allSources.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Leads by Source */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Leads by Source
              <InfoTooltip text="Total lead count per source across all time, combining leads and opportunities." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bySource} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" className="text-xs" tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis dataKey="source" type="category" className="text-xs" width={130} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]}>
                  {bySource.map((_, i) => (
                    <Cell key={i} fill={getSourceColor(bySource[i].source, i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

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
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
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
                    <TableCell>{lead.leadSource || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{lead.adCampaignName || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{lead.leadStatus || "Unknown"}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(lead.createdTime)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
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
