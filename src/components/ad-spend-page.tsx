"use client"

import { useEffect, useState, useMemo } from "react"
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

type AdSpendView = "campaigns" | "ad-groups"
export type AdSpendRange = "all" | "ytd" | "ttm" | "last-mo" | "last-qtr"
export type AdSpendChannel = "all" | "ppc-website" | "ppc-only"

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
  createdTime: string | null
  leadSource: string | null
}

export function AdSpendPage({
  range = "all",
  channel = "all",
}: {
  range?: AdSpendRange
  channel?: AdSpendChannel
}) {
  const [view, setView] = useState<AdSpendView>("ad-groups")
  const isAdGroupView = view === "ad-groups"
  const [rows, setRows] = useState<AdRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set())
  const [selectedAdGroups, setSelectedAdGroups] = useState<Set<string>>(new Set())
  const [acquisitions, setAcquisitions] = useState<AcquisitionRow[]>([])

  useEffect(() => {
    setLoading(true)
    setRows([])
    // Reset filters/search when switching views — option lists change
    setSelectedCampaigns(new Set())
    setSelectedAdGroups(new Set())
    setSearch("")
    fetch(`/api/ad-spend?view=${view}`)
      .then((r) => r.json())
      .then((data) => setRows(data.rows || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [view])

  // Leads feed the CPA denominator ("acquisitions"). Fetch them once and
  // filter client-side by range + channel.
  useEffect(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((data) => {
        const leadsRows: AcquisitionRow[] = (data.leads || []).map((l: { createdTime: string | null; leadSource: string | null }) => ({
          createdTime: l.createdTime,
          leadSource: l.leadSource,
        }))
        setAcquisitions(leadsRows)
      })
      .catch(console.error)
  }, [])

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

  // Total acquisitions = leads whose createdTime is within the selected range
  // AND whose source matches the selected Channel.
  const acquisitionsInRange = useMemo(() => {
    const { start, end } = rangeBounds(range)
    let count = 0
    for (const a of acquisitions) {
      if (!a.createdTime) continue
      const d = new Date(a.createdTime)
      if (isNaN(d.getTime())) continue
      if (start && d < start) continue
      if (end && d > end) continue
      if (!sourceMatchesChannel(a.leadSource, channel)) continue
      count++
    }
    return count
  }, [acquisitions, range, channel])

  const cpa = acquisitionsInRange > 0 ? totals.cost / acquisitionsInRange : 0

  const hasData = !loading && rows.length > 0

  const kpis = hasData
    ? [
        { title: "Total Spend", value: formatCurrency(totals.cost), icon: Megaphone, color: "text-chart-1", bg: "bg-chart-1/15" },
        {
          title: "CPA",
          value: acquisitionsInRange > 0 ? formatCurrency(cpa) : "—",
          sub: `${formatNumber(acquisitionsInRange)} acquisition${acquisitionsInRange === 1 ? "" : "s"}`,
          icon: UserPlus,
          color: "text-chart-2",
          bg: "bg-chart-2/15",
        },
        { title: "Conversions", value: formatNumber(totals.conversions, 1), sub: `${formatCurrency(totals.costPerConv)} / conv`, icon: Target, color: "text-chart-3", bg: "bg-chart-3/15" },
        { title: "Avg Impr. Share", value: formatPct(totals.avgImprShare), sub: "Search impression share", icon: PieChart, color: "text-chart-4", bg: "bg-chart-4/15" },
      ]
    : []

  const viewToggle = (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">View:</span>
      <Tabs value={view} onValueChange={(v) => setView(v as AdSpendView)}>
        <TabsList className="bg-muted h-9">
          <TabsTrigger value="campaigns" className="px-4">Campaigns</TabsTrigger>
          <TabsTrigger value="ad-groups" className="px-4">Ad Groups</TabsTrigger>
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {viewToggle}
              <Separator orientation="vertical" className="hidden sm:block h-6" />
              <div>
                <CardTitle>{isAdGroupView ? "Ad Group Performance" : "Ad Campaign Performance"}</CardTitle>
                {hasData && (
                  <CardDescription>
                    {sorted.length.toLocaleString()} of {rangeFilteredRows.length.toLocaleString()} rows
                    {range !== "all" && rangeFilteredRows.length !== rows.length && (
                      <> (filtered from {rows.length.toLocaleString()} total)</>
                    )}
                  </CardDescription>
                )}
              </div>
            </div>
            {hasData && (
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
          {loading ? (
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
