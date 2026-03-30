"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { PieChart as PieChartIcon, TableProperties, ChevronLeft, ChevronRight } from "lucide-react"
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

const DETAIL_PAGE_SIZE = 6

export function ConcentrationChart() {
  const [data, setData] = useState<ConcentrationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [detailPage, setDetailPage] = useState(1)

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
            <div className="animate-pulse text-muted-foreground">Loading...</div>
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

  const chartData = data.map((entry) => {
    const [year, month] = entry.period.split("-")
    const monthName = new Date(Number(year), Number(month) - 1).toLocaleString("en-US", { month: "short" })
    return {
      period: entry.period,
      label: `${monthName} ${year.slice(2)}`,
      "Top 1": entry.top1.pct,
      "Top 3": entry.top3.pct,
      "Top 5": entry.top5.pct,
    }
  })

  const totalDetailPages = Math.max(1, Math.ceil(data.length / DETAIL_PAGE_SIZE))
  const paginatedDetails = data.slice(
    (detailPage - 1) * DETAIL_PAGE_SIZE,
    detailPage * DETAIL_PAGE_SIZE
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Customer Revenue Concentration
              <InfoTooltip text="% of total revenue from top 1, 3, and 5 customers by month. Lower concentration = healthier, more diversified revenue base." />
            </CardTitle>
          </div>
          <Button
            variant={showDetails ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowDetails(!showDetails); setDetailPage(1) }}
            className="gap-1"
          >
            <TableProperties className="h-4 w-4" />
            {showDetails ? "Chart" : "Details"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!showDetails ? (
          <ResponsiveContainer width="100%" height={225}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={50}
                interval={0}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
                tick={{ fontSize: 11 }}
                width={40}
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
              <Line type="monotone" dataKey="Top 1" stroke="#e76e50" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Top 3" stroke="#2a9d8f" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Top 5" stroke="#264653" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Top 1 %</TableHead>
                  <TableHead>Top Customer</TableHead>
                  <TableHead className="text-right">Top 3 %</TableHead>
                  <TableHead className="text-right">Top 5 %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedDetails.map((entry) => (
                  <TableRow key={entry.period}>
                    <TableCell className="font-medium">{entry.period}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(entry.totalRevenue)}</TableCell>
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
            {data.length > DETAIL_PAGE_SIZE && (
              <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                <span>{data.length} months</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={detailPage <= 1} onClick={() => setDetailPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span>{detailPage}/{totalDetailPages}</span>
                  <Button variant="outline" size="sm" disabled={detailPage >= totalDetailPages} onClick={() => setDetailPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
