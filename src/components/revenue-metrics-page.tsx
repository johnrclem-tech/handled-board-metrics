"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InfoTooltip } from "@/components/info-tooltip"
import { DollarSign, TrendingUp, TrendingDown, BarChart3, Package, Truck, Warehouse } from "lucide-react"
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  LabelList,
} from "recharts"
import type { ChurnSegment } from "@/components/dashboard"

type ServicePeriod = "monthly" | "quarterly" | "ttm"

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
  ttm: PeriodEntry[]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPct(value: number | null): string {
  if (value == null) return "N/A"
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
}

interface RevenueMetricsPageProps {
  segment: ChurnSegment
}

const PERIOD_OPTIONS: { value: ServicePeriod; label: string }[] = [
  { value: "monthly", label: "Month" },
  { value: "quarterly", label: "Quarter" },
  { value: "ttm", label: "TTM" },
]

const COLORS = {
  storage: "#e76e50",
  shipping: "#2a9d8f",
  handling: "#264653",
}

export function RevenueMetricsPage({ segment }: RevenueMetricsPageProps) {
  const [data, setData] = useState<RevenueMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<ServicePeriod>("monthly")

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

  if (!data || (data.monthly.length === 0 && data.quarterly.length === 0 && data.ttm.length === 0)) {
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

  const dataset = period === "monthly" ? data.monthly : period === "quarterly" ? data.quarterly : data.ttm
  const latest = dataset.length > 0 ? dataset[dataset.length - 1] : null

  // Compute 100% stacked mix data
  const mixData = dataset.map((d) => {
    const t = d.total || 1
    return {
      label: d.label,
      storagePct: (d.storage / t) * 100,
      shippingPct: (d.shipping / t) * 100,
      handlingPct: (d.handling / t) * 100,
      storage: d.storage,
      shipping: d.shipping,
      handling: d.handling,
      total: d.total,
    }
  })

  const tooltipStyle = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
  }

  // KPI cards
  const kpiCards = [
    {
      title: "Total Revenue",
      value: latest ? formatCurrency(latest.total) : "$0",
      yoy: latest?.yoyTotal ?? null,
      icon: DollarSign,
    },
    {
      title: "Handling Revenue",
      value: latest ? formatCurrency(latest.handling) : "$0",
      yoy: latest?.yoyHandling ?? null,
      icon: Package,
    },
    {
      title: "Shipping Revenue",
      value: latest ? formatCurrency(latest.shipping) : "$0",
      yoy: latest?.yoyShipping ?? null,
      icon: Truck,
    },
    {
      title: "Storage Revenue",
      value: latest ? formatCurrency(latest.storage) : "$0",
      yoy: latest?.yoyStorage ?? null,
      icon: Warehouse,
    },
  ]

  // Per-service chart configs
  const serviceCharts = [
    { key: "handling" as const, yoyKey: "yoyHandling" as const, title: "Handling Revenue", color: COLORS.handling },
    { key: "shipping" as const, yoyKey: "yoyShipping" as const, title: "Shipping Revenue", color: COLORS.shipping },
    { key: "storage" as const, yoyKey: "yoyStorage" as const, title: "Storage Revenue", color: COLORS.storage },
  ]

  return (
    <div className="space-y-6">
      {/* Period toggle */}
      <div className="flex items-center gap-1">
        {PERIOD_OPTIONS.map((p) => (
          <Button
            key={p.value}
            variant={period === p.value ? "default" : "ghost"}
            size="sm"
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {kpiCards.map((kpi) => {
          const yoyPositive = kpi.yoy != null && kpi.yoy >= 0
          const yoyNegative = kpi.yoy != null && kpi.yoy < 0
          return (
            <Card key={kpi.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardDescription className="text-sm font-medium">{kpi.title}</CardDescription>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  {yoyPositive && <TrendingUp className="h-3 w-3 text-green-600" />}
                  {yoyNegative && <TrendingDown className="h-3 w-3 text-red-600" />}
                  <span
                    className={`text-xs font-medium ${
                      yoyPositive ? "text-green-600" : yoyNegative ? "text-red-600" : "text-muted-foreground"
                    }`}
                  >
                    {formatPct(kpi.yoy)} YoY
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 100% Stacked Service Mix Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Service Mix
            <InfoTooltip text="Percentage breakdown of revenue by service type. Each bar represents 100% of that period's revenue." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={mixData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
              <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} domain={[0, 100]} />
              <Legend />
              <Bar dataKey="storagePct" name="Storage" stackId="a" fill={COLORS.storage} radius={[0, 0, 0, 0]}>
                <LabelList dataKey="storagePct" position="center" fill="#fff" fontSize={10} fontWeight={600} formatter={(v: unknown) => { const n = Number(v); return n >= 5 ? `${Math.round(n)}%` : "" }} />
              </Bar>
              <Bar dataKey="handlingPct" name="Handling" stackId="a" fill={COLORS.handling} radius={[0, 0, 0, 0]}>
                <LabelList dataKey="handlingPct" position="center" fill="#fff" fontSize={10} fontWeight={600} formatter={(v: unknown) => { const n = Number(v); return n >= 5 ? `${Math.round(n)}%` : "" }} />
              </Bar>
              <Bar dataKey="shippingPct" name="Shipping" stackId="a" fill={COLORS.shipping} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="shippingPct" position="center" fill="#fff" fontSize={10} fontWeight={600} formatter={(v: unknown) => { const n = Number(v); return n >= 5 ? `${Math.round(n)}%` : "" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Individual Service Charts */}
      {serviceCharts.map((svc) => {
        const chartData = dataset.map((d) => ({
          label: d.label,
          revenue: d[svc.key],
          yoy: d[svc.yoyKey],
        }))
        const hasYoy = chartData.some((d) => d.yoy != null)

        return (
          <Card key={svc.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {svc.title}
                <InfoTooltip text={`${svc.title} per period with year-over-year growth rate.`} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                    width={55}
                  />
                  {hasYoy && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(val) => `${val}%`}
                      tick={{ fontSize: 11 }}
                      width={50}
                    />
                  )}
                  <Tooltip
                    formatter={(value, name) => {
                      const v = Number(value)
                      const n = String(name)
                      if (n === "YoY Growth") return [`${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, n]
                      return [formatCurrency(v), "Revenue"]
                    }}
                    contentStyle={tooltipStyle}
                  />
                  <Legend />
                  {hasYoy && <ReferenceLine yAxisId="right" y={0} stroke="#999" strokeDasharray="3 3" />}
                  <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill={svc.color} radius={[4, 4, 0, 0]} />
                  {hasYoy && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="yoy"
                      name="YoY Growth"
                      stroke="#666"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
