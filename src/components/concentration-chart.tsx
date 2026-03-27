"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { PieChart as PieChartIcon } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts"

interface ConcentrationEntry {
  period: string
  totalRevenue: number
  customerCount: number
  top1: { pct: number; revenue: number; name: string }
  top3: { pct: number; revenue: number; names: string[] }
  top5: { pct: number; revenue: number; names: string[] }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

export function ConcentrationChart() {
  const [data, setData] = useState<ConcentrationEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/metrics/concentration")
      .then((res) => res.json())
      .then((result) => setData(result.data || []))
      .catch((err) => console.error("Failed to fetch concentration data:", err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer Concentration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading concentration data...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <PieChartIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No concentration data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Import revenue files to see customer concentration analysis
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartData = data.map((entry) => ({
    period: entry.period,
    "Top 1": entry.top1.pct,
    "Top 3": entry.top3.pct,
    "Top 5": entry.top5.pct,
  }))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer Revenue Concentration</CardTitle>
          <CardDescription>
            Percentage of total revenue from top 1, 3, and 5 customers by calendar month.
            Lower concentration = healthier, more diversified revenue base.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="period" className="text-xs" />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
                className="text-xs"
              />
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(1)}%`}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <ReferenceLine y={50} stroke="#999" strokeDasharray="3 3" label={{ value: "50%", position: "right", fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="Top 1"
                stroke="#e76e50"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Top 3"
                stroke="#2a9d8f"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="Top 5"
                stroke="#264653"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Concentration Details</CardTitle>
          <CardDescription>Monthly breakdown of top customer revenue share</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="min-w-max">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[100px]">Period</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                    <TableHead className="text-center">Customers</TableHead>
                    <TableHead className="text-right">Top 1 %</TableHead>
                    <TableHead>Top 1 Customer</TableHead>
                    <TableHead className="text-right">Top 3 %</TableHead>
                    <TableHead className="text-right">Top 5 %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((entry) => (
                    <TableRow key={entry.period}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">{entry.period}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(entry.totalRevenue)}</TableCell>
                      <TableCell className="text-center">{entry.customerCount}</TableCell>
                      <TableCell className={`text-right font-mono ${entry.top1.pct > 25 ? "text-red-600 font-semibold" : ""}`}>
                        {formatPct(entry.top1.pct)}
                      </TableCell>
                      <TableCell className="text-sm">{entry.top1.name}</TableCell>
                      <TableCell className={`text-right font-mono ${entry.top3.pct > 50 ? "text-red-600 font-semibold" : ""}`}>
                        {formatPct(entry.top3.pct)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${entry.top5.pct > 70 ? "text-red-600 font-semibold" : ""}`}>
                        {formatPct(entry.top5.pct)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
