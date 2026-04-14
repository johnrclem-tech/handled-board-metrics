"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { Button } from "@/components/ui/button"
import { Users, PieChart as PieChartIcon, TrendingUp } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, ReferenceLine, BarChart, Bar, LabelList, Legend, YAxis } from "recharts"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

export type ConcentrationPeriod = "monthly" | "quarterly" | "ttm"

interface ConcentrationEntry {
  period: string
  label: string
  totalRevenue: number
  customerCount: number
  top1: { pct: number; revenue: number; name: string }
  top3: { pct: number; revenue: number; names: string[] }
  top5: { pct: number; revenue: number; names: string[] }
}

interface ConcentrationResponse {
  monthly: ConcentrationEntry[]
  quarterly: ConcentrationEntry[]
  ttm: ConcentrationEntry[]
}

interface SegmentEntry {
  period: string
  label: string
  newRevenue: number
  existingRevenue: number
  total: number
  newCount: number
  existingCount: number
}

interface SegmentResponse {
  monthly: SegmentEntry[]
  quarterly: SegmentEntry[]
  ttm: SegmentEntry[]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}


interface CustomerRevenueEntry {
  name: string
  revenue: number
  priorRevenue: number | null
  growth: number | null
  isNew: boolean
}

interface CustomerRevenueResponse {
  customers: CustomerRevenueEntry[]
  periodLabel: string
}

export function ConcentrationChart({ children, period }: { children?: React.ReactNode; period: ConcentrationPeriod }) {
  const [data, setData] = useState<ConcentrationResponse | null>(null)
  const [segmentData, setSegmentData] = useState<SegmentResponse | null>(null)
  const [customerRevData, setCustomerRevData] = useState<CustomerRevenueResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/metrics/concentration").then((r) => r.json()),
      fetch("/api/metrics/customer-segments").then((r) => r.json()),
    ])
      .then(([concResult, segResult]: [ConcentrationResponse, SegmentResponse]) => {
        setData(concResult)
        setSegmentData(segResult)
      })
      .catch((err) => console.error("Failed to fetch data:", err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch(`/api/metrics/customer-revenue?period=${period}`)
      .then((r) => r.json())
      .then((result: CustomerRevenueResponse) => setCustomerRevData(result))
      .catch((err) => console.error("Failed to fetch customer revenue:", err))
  }, [period])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          Loading customer metrics...
        </CardContent>
      </Card>
    )
  }

  if (!data || (data.monthly.length === 0 && data.quarterly.length === 0 && data.ttm.length === 0)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <PieChartIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No customer data</h3>
          <p className="text-sm text-muted-foreground mt-1">Import revenue files to see customer metrics</p>
        </CardContent>
      </Card>
    )
  }

  const fullDataset = period === "monthly" ? data.monthly : period === "quarterly" ? data.quarterly : data.ttm
  const dataset = fullDataset.slice(-18)
  const latest = dataset.length > 0 ? dataset[dataset.length - 1] : null

  // Find prior year top5 for comparison
  let priorTop5: number | null = null
  if (latest) {
    let priorPeriod: string | null = null
    if (period === "monthly" || period === "ttm") {
      const [y, m] = latest.period.split("-").map(Number)
      priorPeriod = `${y - 1}-${String(m).padStart(2, "0")}`
    } else {
      // quarterly: "2025-Q1" → "2024-Q1"
      const [y, qPart] = latest.period.split("-Q")
      priorPeriod = `${Number(y) - 1}-Q${qPart}`
    }
    const priorEntry = fullDataset.find((d) => d.period === priorPeriod)
    if (priorEntry) priorTop5 = priorEntry.top5.pct
  }

  // Area chart data: each value is the cumulative % (not incremental)
  const chartData = dataset.map((d) => ({
    label: d.label,
    top1: d.top1.pct,
    top3: d.top3.pct,
    top5: d.top5.pct,
  }))

  const concentrationChartConfig = {
    top1: {
      label: "Top 1",
      color: "var(--chart-1)",
    },
    top3: {
      label: "Top 3",
      color: "var(--chart-2)",
    },
    top5: {
      label: "Top 5",
      color: "var(--chart-3)",
    },
  } satisfies ChartConfig

  const segmentChartConfig = {
    newRevenue: { label: "New Customers", color: "var(--chart-1)" },
    existingRevenue: { label: "Existing Customers", color: "var(--chart-3)" },
  } satisfies ChartConfig

  const avgRevenueChartConfig = {
    avgRevenue: { label: "Avg Revenue", color: "var(--chart-2)" },
  } satisfies ChartConfig

  const avgRevenueChartData = dataset.map((d) => ({
    label: d.label,
    avgRevenue: d.customerCount > 0 ? Math.round(d.totalRevenue / d.customerCount) : 0,
  }))

  // New customer revenue % from segment data
  const segFullDataset = segmentData
    ? period === "monthly" ? segmentData.monthly : period === "quarterly" ? segmentData.quarterly : segmentData.ttm
    : []
  const latestSeg = segFullDataset.length > 0 ? segFullDataset[segFullDataset.length - 1] : null
  const newRevPct = latestSeg && latestSeg.total > 0 ? (latestSeg.newRevenue / latestSeg.total) * 100 : null

  let priorNewRevPct: number | null = null
  if (latestSeg) {
    let priorSegPeriod: string | null = null
    if (period === "monthly" || period === "ttm") {
      const [y, m] = latestSeg.period.split("-").map(Number)
      priorSegPeriod = `${y - 1}-${String(m).padStart(2, "0")}`
    } else {
      const [y, qPart] = latestSeg.period.split("-Q")
      priorSegPeriod = `${Number(y) - 1}-Q${qPart}`
    }
    const priorSeg = segFullDataset.find((d) => d.period === priorSegPeriod)
    if (priorSeg && priorSeg.total > 0) {
      priorNewRevPct = (priorSeg.newRevenue / priorSeg.total) * 100
    }
  }

  // Prior year avg revenue per customer
  let priorAvgRevPerCustomer: number | null = null
  if (latest) {
    let priorPeriodForAvg: string | null = null
    if (period === "monthly" || period === "ttm") {
      const [y, m] = latest.period.split("-").map(Number)
      priorPeriodForAvg = `${y - 1}-${String(m).padStart(2, "0")}`
    } else {
      const [y, qPart] = latest.period.split("-Q")
      priorPeriodForAvg = `${Number(y) - 1}-Q${qPart}`
    }
    const priorEntry = fullDataset.find((d) => d.period === priorPeriodForAvg)
    if (priorEntry && priorEntry.customerCount > 0) {
      priorAvgRevPerCustomer = priorEntry.totalRevenue / priorEntry.customerCount
    }
  }

  // KPI cards
  const avgRevenuePerCustomer = latest && latest.customerCount > 0 ? latest.totalRevenue / latest.customerCount : 0

  const kpiCards = [
    {
      title: "Top 5 Customer Concentration",
      value: latest ? `${latest.top5.pct.toFixed(1)}%` : "N/A",
      sub: priorTop5 != null && latest
        ? `${latest.top5.pct > priorTop5 ? "+" : ""}${(latest.top5.pct - priorTop5).toFixed(1)}pp vs prior year (${priorTop5.toFixed(1)}%)`
        : "No prior year data",
      icon: PieChartIcon,
      warn: latest ? latest.top5.pct > 70 : false,
    },
    {
      title: "Avg Revenue Per Customer",
      value: latest ? formatCurrency(avgRevenuePerCustomer) : "N/A",
      sub: priorAvgRevPerCustomer != null && avgRevenuePerCustomer > 0
        ? `${avgRevenuePerCustomer > priorAvgRevPerCustomer ? "+" : ""}${(((avgRevenuePerCustomer - priorAvgRevPerCustomer) / priorAvgRevPerCustomer) * 100).toFixed(1)}% vs prior year (${formatCurrency(priorAvgRevPerCustomer)})`
        : "No prior year data",
      icon: Users,
    },
    {
      title: "New Customer Revenue",
      value: newRevPct != null ? `${newRevPct.toFixed(1)}%` : "N/A",
      sub: priorNewRevPct != null && newRevPct != null
        ? `${newRevPct > priorNewRevPct ? "+" : ""}${(newRevPct - priorNewRevPct).toFixed(1)}pp vs prior year (${priorNewRevPct.toFixed(1)}%)`
        : "No prior year data",
      icon: TrendingUp,
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription className="text-sm font-medium">{kpi.title}</CardDescription>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-1/15">
                <kpi.icon className="h-4 w-4 text-chart-1" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpi.warn ? "text-red-600" : ""}`}>{kpi.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {children}

      <div className="grid gap-6 md:grid-cols-2">
      {/* Concentration Area Chart */}
      <Card className="gap-4">
        <CardHeader className="flex justify-between border-b">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">Customer Revenue Concentration</span>
            <InfoTooltip text="Shows how concentrated revenue is among top customers. Lower Top 1 concentration = healthier, more diversified revenue." />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="bg-chart-1 h-10 w-1 rounded-sm" />
              <div className="flex flex-col">
                <span className="text-lg font-medium">{latest ? `${latest.top1.pct.toFixed(0)}%` : "—"}</span>
                <span className="text-muted-foreground text-sm">Top 1</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-chart-2 h-10 w-1 rounded-sm" />
              <div className="flex flex-col">
                <span className="text-lg font-medium">{latest ? `${latest.top3.pct.toFixed(0)}%` : "—"}</span>
                <span className="text-muted-foreground text-sm">Top 3</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-chart-3 h-10 w-1 rounded-sm" />
              <div className="flex flex-col">
                <span className="text-lg font-medium">{latest ? `${latest.top5.pct.toFixed(0)}%` : "—"}</span>
                <span className="text-muted-foreground text-sm">Top 5</span>
              </div>
            </div>
          </div>

          <ChartContainer config={concentrationChartConfig} className="aspect-auto h-[275px] w-full">
            <AreaChart
              data={chartData}
              margin={{ left: 10, right: 10, top: 10, bottom: 5 }}
              className="stroke-2"
            >
              <defs>
                <linearGradient id="fillTop1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-top1)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-top1)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillTop3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-top3)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-top3)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillTop5" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-top5)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-top5)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="5 4" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={30} tick={{ fontSize: 11 }} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent labelFormatter={(label) => label} formatter={(value) => [`${Number(value).toFixed(1)}%`]} />}
              />
              <ReferenceLine y={50} stroke="#999" strokeDasharray="3 3" />
              <Area dataKey="top5" type="monotone" fill="url(#fillTop5)" stroke="var(--color-top5)" />
              <Area dataKey="top3" type="monotone" fill="url(#fillTop3)" stroke="var(--color-top3)" />
              <Area dataKey="top1" type="monotone" fill="url(#fillTop1)" stroke="var(--color-top1)" />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Average Revenue Per Customer */}
      {dataset.length > 0 && (
        <Card className="gap-4">
          <CardHeader className="flex justify-between border-b">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">Average Revenue Per Customer</span>
              <InfoTooltip text="Total revenue divided by number of active customers for each period." />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ChartContainer config={avgRevenueChartConfig} className="aspect-auto h-[325px] w-full">
              <AreaChart
                data={avgRevenueChartData}
                margin={{ left: 10, right: 10, top: 10, bottom: 5 }}
                className="stroke-2"
              >
                <defs>
                  <linearGradient id="fillAvgRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-avgRevenue)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-avgRevenue)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="5 4" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={30} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={45} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent className="min-w-[200px]" labelFormatter={(label) => label} formatter={(value) => [formatCurrency(Number(value))]} />}
                />
                <Area dataKey="avgRevenue" type="monotone" fill="url(#fillAvgRevenue)" stroke="var(--color-avgRevenue)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Revenue by Customer Type */}
      {segmentData && (() => {
        const segFullDataset = period === "monthly" ? segmentData.monthly : period === "quarterly" ? segmentData.quarterly : segmentData.ttm
        const segDataset = segFullDataset.slice(-18)

        if (segDataset.length === 0) return null

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Revenue by Customer Type
                <InfoTooltip text="Revenue split between existing customers (any revenue before 2025) and new customers (all others)." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={segmentChartConfig} className="aspect-auto h-[350px] w-full">
                <BarChart data={segDataset} margin={{ top: 15, right: 20, left: 15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="5 4" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis
                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                    width={55}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent className="min-w-[200px]" labelFormatter={(label) => label} formatter={(value) => [formatCurrency(Number(value))]} />}
                  />
                  <Legend />
                  <Bar dataKey="newRevenue" name="New Customers" stackId="a" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="existingRevenue" name="Existing Customers" stackId="a" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )
      })()}

      {/* Revenue by Customer */}
      {customerRevData && customerRevData.customers.length > 0 && (() => {
        const customers = customerRevData.customers.slice(0, 20)
        const maxRevenue = Math.max(...customers.map((c) => c.revenue))

        const customerChartConfig = {
          revenue: { label: "Revenue", color: "var(--chart-1)" },
        } satisfies ChartConfig

        return (
          <Card className="gap-4">
            <CardHeader className="flex justify-between border-b">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">Revenue by Customer</span>
                <InfoTooltip text="Total revenue per customer for the selected period with year-over-year growth. Top 20 customers shown." />
              </div>
              <span className="text-muted-foreground text-sm">{customerRevData.periodLabel}</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ChartContainer config={customerChartConfig} className="aspect-auto w-full" style={{ height: `${Math.max(300, customers.length * 36)}px` }}>
                <BarChart
                  data={customers}
                  layout="vertical"
                  barSize={22}
                  margin={{ left: 10, right: 120, top: 5, bottom: 5 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="4" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    dataKey="revenue"
                    domain={[0, Math.ceil(maxRevenue / 1000) * 1000]}
                    tickFormatter={(val) => val === 0 ? "$0" : `$${(val / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    width={120}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        className="min-w-[220px]"
                        hideLabel
                        formatter={(value, _name, item) => {
                          const customer = item.payload as CustomerRevenueEntry
                          return (
                            <div className="flex flex-col gap-1 text-xs">
                              <div className="font-semibold">{customer.name}</div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Revenue</span>
                                <span className="font-mono font-medium">{formatCurrency(customer.revenue)}</span>
                              </div>
                              {customer.priorRevenue != null && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Prior Year</span>
                                  <span className="font-mono font-medium">{formatCurrency(customer.priorRevenue)}</span>
                                </div>
                              )}
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Growth</span>
                                <span className={`font-mono font-medium ${customer.growth != null && customer.growth < 0 ? "text-red-600" : ""}`}>
                                  {customer.isNew ? "New" : customer.growth != null ? `${customer.growth >= 0 ? "+" : ""}${customer.growth.toFixed(1)}%` : "N/A"}
                                </span>
                              </div>
                            </div>
                          )
                        }}
                      />
                    }
                  />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4}>
                    <LabelList
                      dataKey="revenue"
                      position="insideLeft"
                      offset={8}
                      fill="#fff"
                      fontSize={11}
                      fontWeight={600}
                      formatter={(v) => `$${(Number(v) / 1000).toFixed(1)}k`}
                    />
                    <LabelList
                      dataKey="growth"
                      position="right"
                      offset={8}
                      className="text-xs"
                      fill="var(--muted-foreground)"
                      formatter={(v: unknown) => {
                        if (v == null) return "New"
                        const n = Number(v)
                        return `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`
                      }}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )
      })()}
    </div>
  )
}
