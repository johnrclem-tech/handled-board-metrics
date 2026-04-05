"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { Progress } from "@/components/ui/progress"
import { DollarSign, TrendingUp, Users, BarChart3 } from "lucide-react"
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
  ReferenceLine,
} from "recharts"
import type { ChurnSegment, ChurnPeriod } from "@/components/dashboard"

interface PeriodEntry {
  period: string
  label: string
  storage: number
  shipping: number
  handling: number
  total: number
  customerCount: number
  yoyStorage: number | null
  yoyShipping: number | null
  yoyHandling: number | null
  yoyTotal: number | null
}

interface RevenueMetricsResponse {
  monthly: PeriodEntry[]
  quarterly: PeriodEntry[]
  annual: PeriodEntry[]
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
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
}

interface RevenueMetricsPageProps {
  segment: ChurnSegment
  period: ChurnPeriod
}

export function RevenueMetricsPage({ segment, period }: RevenueMetricsPageProps) {
  const [data, setData] = useState<RevenueMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/metrics/revenue-metrics?segment=${segment}`)
      .then((res) => res.json())
      .then((result) => setData(result))
      .catch((err) => console.error("Failed to fetch revenue metrics:", err))
      .finally(() => setLoading(false))
  }, [segment])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          Loading revenue metrics...
        </CardContent>
      </Card>
    )
  }

  if (!data || (data.monthly.length === 0 && data.quarterly.length === 0 && data.annual.length === 0)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No revenue data</h3>
          <p className="text-sm text-muted-foreground mt-1">Import revenue files to see metrics</p>
        </CardContent>
      </Card>
    )
  }

  // Select dataset based on period
  const dataset = period === "monthly" ? data.monthly : period === "quarterly" ? data.quarterly : data.annual
  const latest = dataset.length > 0 ? dataset[dataset.length - 1] : null

  // YoY data (only entries with yoyTotal !== null)
  const yoyData = dataset.filter((d) => d.yoyTotal !== null)

  // Service mix for latest period
  const serviceMix = latest
    ? [
        { name: "Storage", amount: latest.storage, pct: latest.total > 0 ? (latest.storage / latest.total) * 100 : 0, color: "#e76e50" },
        { name: "Shipping", amount: latest.shipping, pct: latest.total > 0 ? (latest.shipping / latest.total) * 100 : 0, color: "#2a9d8f" },
        { name: "Handling", amount: latest.handling, pct: latest.total > 0 ? (latest.handling / latest.total) * 100 : 0, color: "#264653" },
      ]
    : []

  const tooltipStyle = { backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }

  // KPI cards
  const kpiCards = [
    {
      title: "Total Revenue",
      value: latest ? formatCurrency(latest.total) : "$0",
      sub: latest ? `${latest.label} — ${latest.customerCount} active customers` : "",
      icon: DollarSign,
      warn: false,
    },
    {
      title: "YoY Growth",
      value: latest?.yoyTotal != null ? formatPct(latest.yoyTotal) : "N/A",
      sub: latest?.yoyTotal != null ? `${latest.label} vs prior year` : "Not enough historical data",
      icon: TrendingUp,
      warn: latest?.yoyTotal != null && latest.yoyTotal < 0,
    },
    {
      title: "Revenue per Customer",
      value: latest && latest.customerCount > 0 ? formatCurrency(latest.total / latest.customerCount) : "$0",
      sub: latest ? `${latest.label} — ${latest.customerCount} customers` : "",
      icon: Users,
      warn: false,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription className="text-sm font-medium">{kpi.title}</CardDescription>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpi.warn ? "text-red-600" : ""}`}>{kpi.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Revenue by Service Type
            <InfoTooltip text="Stacked revenue breakdown by Storage, Shipping, and Handling for each period." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={dataset} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
              <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={55} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="storage" name="Storage" stackId="a" fill="#e76e50" radius={[0, 0, 0, 0]} />
              <Bar dataKey="handling" name="Handling" stackId="a" fill="#264653" radius={[0, 0, 0, 0]} />
              <Bar dataKey="shipping" name="Shipping" stackId="a" fill="#2a9d8f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {yoyData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Year-over-Year Growth
              <InfoTooltip text="Revenue growth compared to the same period in the prior year. Only periods with prior-year data are shown. Total line is solid, category lines are dashed." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={yoyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} />
                <Tooltip
                  formatter={(value) => [`${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(1)}%`]}
                  contentStyle={tooltipStyle}
                />
                <Legend />
                <ReferenceLine y={0} stroke="#999" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="yoyTotal" name="Total" stroke="#264653" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="yoyStorage" name="Storage" stroke="#e76e50" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} />
                <Line type="monotone" dataKey="yoyShipping" name="Shipping" stroke="#2a9d8f" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} />
                <Line type="monotone" dataKey="yoyHandling" name="Handling" stroke="#e9c46a" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Year-over-Year Growth
              <InfoTooltip text="Revenue growth compared to the same period in the prior year." />
            </CardTitle>
          </CardHeader>
          <CardContent className="py-12 text-center text-muted-foreground">
            Not enough historical data for year-over-year comparison yet. YoY data will appear once 12+ months of data are available.
          </CardContent>
        </Card>
      )}

      {serviceMix.length > 0 && latest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Service Mix — {latest.label}
              <InfoTooltip text="Percentage breakdown of revenue by service type for the most recent period." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {serviceMix.map((item) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground">
                      {item.pct.toFixed(1)}% — {formatCurrency(item.amount)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                <span>Total</span>
                <span>{formatCurrency(latest.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
