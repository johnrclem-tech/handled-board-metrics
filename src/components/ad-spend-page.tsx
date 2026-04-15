"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Search, Package, Megaphone, MousePointerClick, Target, PieChart } from "lucide-react"

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
  searchLostIsRank: string | null
  searchImprShare: string | null
}

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

export function AdSpendPage() {
  const [rows, setRows] = useState<AdRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetch("/api/ad-spend")
      .then((r) => r.json())
      .then((data) => setRows(data.rows || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(
      (r) =>
        (r.campaign || "").toLowerCase().includes(q) ||
        (r.adGroup || "").toLowerCase().includes(q)
    )
  }, [rows, search])

  const totals = useMemo(() => {
    let cost = 0
    let clicks = 0
    let conversions = 0
    let impressionShareSum = 0
    let impressionShareCount = 0
    for (const r of rows) {
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
  }, [rows])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          Loading ad spend data...
        </CardContent>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No ad campaign data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Import an Ad Campaign Performance file from the Import page to get started
          </p>
        </CardContent>
      </Card>
    )
  }

  const kpis = [
    { title: "Total Spend", value: formatCurrency(totals.cost), icon: Megaphone, color: "text-chart-1", bg: "bg-chart-1/15" },
    { title: "Total Clicks", value: formatNumber(totals.clicks), sub: `${formatCurrency(totals.cpc)} avg CPC`, icon: MousePointerClick, color: "text-chart-2", bg: "bg-chart-2/15" },
    { title: "Conversions", value: formatNumber(totals.conversions, 1), sub: `${formatCurrency(totals.costPerConv)} / conv`, icon: Target, color: "text-chart-3", bg: "bg-chart-3/15" },
    { title: "Avg Impr. Share", value: formatPct(totals.avgImprShare), sub: "Search impression share", icon: PieChart, color: "text-chart-4", bg: "bg-chart-4/15" },
  ]

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Ad Campaign Performance</CardTitle>
              <CardDescription>
                {filtered.length.toLocaleString()} rows
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                  <TableHead>Day</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Ad Group</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">Search Lost IS (Rank)</TableHead>
                  <TableHead className="text-right">Search Impr. Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate">{r.campaign || "—"}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{r.adGroup || "—"}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  )
}
