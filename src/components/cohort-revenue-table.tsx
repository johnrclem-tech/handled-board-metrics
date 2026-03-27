"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Users, RefreshCw } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function CohortRevenueTable() {
  const [data, setData] = useState<CohortResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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
          <CardTitle>Customer Cohort Revenue Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading cohort data...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.metadata.totalCustomers === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No cohort data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Import all three revenue files (Storage, Shipping, Handling) to see cohort analysis
          </p>
        </CardContent>
      </Card>
    )
  }

  const { cohortData, metadata } = data
  const maxMonths = metadata.maxBillingMonths
  const monthHeaders = Array.from({ length: maxMonths }, (_, i) => i + 1)

  const categories = [
    { key: "storage" as const, label: "Storage Revenue", color: "#e76e50" },
    { key: "shipping" as const, label: "Shipping Revenue", color: "#2a9d8f" },
    { key: "handling" as const, label: "Handling Revenue", color: "#264653" },
    { key: "total" as const, label: "Total Revenue", color: "#e9c46a" },
  ]

  // Build a lookup for each category by month number
  const lookups = Object.fromEntries(
    categories.map(({ key }) => [
      key,
      new Map(cohortData[key].map((e) => [e.month, e])),
    ])
  ) as Record<string, Map<number, CohortEntry>>

  // Build chart data
  const chartData = monthHeaders.map((month) => {
    const entry: Record<string, unknown> = { month: `Month ${month}` }
    for (const { key } of categories) {
      const d = lookups[key].get(month)
      entry[key] = d ? d.average : 0
    }
    return entry
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Customer Cohort Revenue Analysis</CardTitle>
              <CardDescription>
                Average revenue per billing month for new customers (excluding {metadata.excludedCustomers} pre-existing customers).
                Tracking {metadata.totalCustomers} new customers from {metadata.earliestPeriod} to {metadata.latestPeriod}.
                $0 months after first billing are included to reflect churn.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing} className="gap-1">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="min-w-max">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">Category</TableHead>
                    {monthHeaders.map((month) => (
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
                      {monthHeaders.map((month) => {
                        const entry = lookups[key].get(month)
                        return (
                          <TableCell key={month} className="text-center">
                            {entry ? (
                              <div>
                                <div className={key === "total" ? "font-semibold" : ""}>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Decay Curves</CardTitle>
          <CardDescription>Average revenue by billing month showing customer lifecycle trends</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
        </CardContent>
      </Card>
    </div>
  )
}
