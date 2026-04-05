"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Users, TableProperties, RefreshCw } from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import type { CohortDrillFilter } from "@/components/dashboard"

interface CohortEntry {
  month: number
  average: number
  customerCount: number
}

interface CohortResponse {
  cohortData: {
    storage: CohortEntry[]
    shipping: CohortEntry[]
    handling: CohortEntry[]
    total: CohortEntry[]
  }
  metadata: {
    totalCustomers: number
    excludedCustomers: number
    earliestPeriod: string | null
    latestPeriod: string | null
    maxBillingMonths: number
  }
}

type ViewMode = "chart" | "table" | "decay"

const CATEGORY_MAP: Record<string, string> = {
  storage: "Storage Revenue",
  shipping: "Shipping Revenue",
  handling: "Handling Revenue",
  total: "all",
}

const LABEL_MAP: Record<string, string> = {
  storage: "Storage Revenue",
  shipping: "Shipping Revenue",
  handling: "Handling Revenue",
  total: "Total Revenue",
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

interface CohortSummaryChartProps {
  onViewDetails: () => void
  onDrill?: (filter: CohortDrillFilter) => void
}

export function CohortSummaryChart({ onDrill }: CohortSummaryChartProps) {
  const [data, setData] = useState<CohortResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("chart")

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch("/api/metrics/cohort-revenue")
      const result = await res.json()
      setData(result)
    } catch (err) {
      console.error("Failed to fetch cohort data:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Average Revenue by Billing Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading cohort data...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.metadata.totalCustomers === 0) {
    return null
  }

  const { cohortData, metadata } = data

  // Lifetime averages
  const lifetimeStorage = cohortData.storage.reduce((sum, e) => sum + e.average, 0)
  const lifetimeShipping = cohortData.shipping.reduce((sum, e) => sum + e.average, 0)
  const lifetimeHandling = cohortData.handling.reduce((sum, e) => sum + e.average, 0)
  const lifetimeTotal = cohortData.total.reduce((sum, e) => sum + e.average, 0)

  // Chart data (first 12 months)
  const maxMonthsToShow = Math.min(12, metadata.maxBillingMonths)
  const chartMonths = Array.from({ length: maxMonthsToShow }, (_, i) => i + 1)

  const storageLookup = new Map(cohortData.storage.map((e) => [e.month, e]))
  const shippingLookup = new Map(cohortData.shipping.map((e) => [e.month, e]))
  const handlingLookup = new Map(cohortData.handling.map((e) => [e.month, e]))

  const barChartData = chartMonths.map((month) => ({
    month: `Mo ${month}`,
    monthNum: month,
    storage: storageLookup.get(month)?.average || 0,
    shipping: shippingLookup.get(month)?.average || 0,
    handling: handlingLookup.get(month)?.average || 0,
  }))

  // Full table/decay data (all months)
  const allMonths = Array.from({ length: metadata.maxBillingMonths }, (_, i) => i + 1)
  const categories = [
    { key: "storage" as const, label: "Storage Revenue", color: "var(--chart-3)" },
    { key: "shipping" as const, label: "Shipping Revenue", color: "var(--chart-2)" },
    { key: "handling" as const, label: "Handling Revenue", color: "var(--chart-1)" },
    { key: "total" as const, label: "Total Revenue", color: "var(--chart-5)" },
  ]

  const lookups = Object.fromEntries(
    categories.map(({ key }) => [
      key,
      new Map(cohortData[key].map((e) => [e.month, e])),
    ])
  ) as Record<string, Map<number, CohortEntry>>

  const decayChartData = allMonths.map((month) => {
    const entry: Record<string, unknown> = { month: `Month ${month}`, monthNum: month }
    for (const { key } of categories) {
      const d = lookups[key].get(month)
      entry[key] = d ? d.average : 0
    }
    return entry
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = (state: any) => {
    if (state?.activePayload?.[0]?.payload?.monthNum) {
      const month = state.activePayload[0].payload.monthNum as number
      onDrill?.({
        billingMonth: month,
        category: "all",
        label: `Total Revenue - Month ${month}`,
      })
    }
  }

  const handleCellClick = (key: string, month: number) => {
    onDrill?.({
      billingMonth: month,
      category: CATEGORY_MAP[key],
      label: `${LABEL_MAP[key]} - Month ${month}`,
    })
  }

  const viewLabels: Record<ViewMode, string> = {
    chart: "Chart",
    table: "Cohort Table",
    decay: "Decay Curves",
  }
  const nextView: Record<ViewMode, ViewMode> = {
    chart: "table",
    table: "decay",
    decay: "chart",
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Average Revenue by Billing Month
              <InfoTooltip text={
                viewMode === "chart"
                  ? `Stacked average revenue per new customer (${metadata.totalCustomers} customers). Click a bar to view records.`
                  : viewMode === "table"
                    ? `Avg revenue per billing month for ${metadata.totalCustomers} new customers (excl. ${metadata.excludedCustomers} pre-existing). Click any cell to drill down.`
                    : `Revenue decay curves showing customer lifecycle trends for ${metadata.totalCustomers} new customers.`
              } />
            </CardTitle>
            {viewMode === "chart" && (
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Avg Lifetime Total</span>
                  <span className="text-lg font-bold">{formatCurrency(lifetimeTotal)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Storage</span>
                  <span className="font-semibold" style={{ color: "var(--chart-3)" }}>{formatCurrency(lifetimeStorage)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Handling</span>
                  <span className="font-semibold" style={{ color: "var(--chart-1)" }}>{formatCurrency(lifetimeHandling)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-semibold" style={{ color: "var(--chart-2)" }}>{formatCurrency(lifetimeShipping)}</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {viewMode !== "chart" && (
              <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing} className="gap-1">
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            )}
            <Button
              variant={viewMode !== "chart" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode(nextView[viewMode])}
              className="gap-1"
            >
              <TableProperties className="h-4 w-4" />
              {viewLabels[nextView[viewMode]]}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === "chart" && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} onClick={handleChartClick} style={{ cursor: "pointer" }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis tickFormatter={(val) => `$${val}`} className="text-xs" />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar dataKey="handling" name="Handling" stackId="revenue" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="shipping" name="Shipping" stackId="revenue" fill="var(--chart-2)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="storage" name="Storage" stackId="revenue" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {viewMode === "table" && (
          <ScrollArea className="w-full">
            <div className="min-w-max">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">Category</TableHead>
                    {allMonths.map((month) => (
                      <TableHead key={month} className="text-center min-w-[100px]">
                        Month {month}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map(({ key, label }) => (
                    <TableRow key={key} className={key === "total" ? "font-semibold border-t-2" : ""}>
                      <TableCell className="sticky left-0 bg-background z-10">
                        <Badge variant={key === "total" ? "default" : "outline"}>{label}</Badge>
                      </TableCell>
                      {allMonths.map((month) => {
                        const entry = lookups[key].get(month)
                        return (
                          <TableCell
                            key={month}
                            className={`text-center ${entry ? "cursor-pointer hover:bg-muted/50 rounded transition-colors" : ""}`}
                            onClick={() => entry && handleCellClick(key, month)}
                          >
                            {entry ? (
                              <div>
                                <div className={`${key === "total" ? "font-semibold" : ""} text-primary underline-offset-2 hover:underline`}>
                                  {formatCurrency(entry.average)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  n={entry.customerCount}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}

        {viewMode === "decay" && (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={decayChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} onClick={handleChartClick} style={{ cursor: "pointer" }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis tickFormatter={(val) => `$${val}`} className="text-xs" />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              {categories.map(({ key, label, color }) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={label}
                  stroke={color}
                  strokeWidth={key === "total" ? 3 : 2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
