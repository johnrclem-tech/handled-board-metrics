"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { Button } from "@/components/ui/button"
import { DollarSign, Users, PieChart as PieChartIcon } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  LabelList,
} from "recharts"

type ConcentrationPeriod = "monthly" | "quarterly" | "ttm"

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

interface CohortResponse {
  cohortData: {
    total: { month: number; average: number; customerCount: number }[]
  }
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

const PERIOD_OPTIONS: { value: ConcentrationPeriod; label: string }[] = [
  { value: "monthly", label: "Month" },
  { value: "quarterly", label: "Quarter" },
  { value: "ttm", label: "TTM" },
]

export function ConcentrationChart() {
  const [data, setData] = useState<ConcentrationResponse | null>(null)
  const [segmentData, setSegmentData] = useState<SegmentResponse | null>(null)
  const [ltv, setLtv] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<ConcentrationPeriod>("monthly")

  useEffect(() => {
    Promise.all([
      fetch("/api/metrics/concentration").then((r) => r.json()),
      fetch("/api/metrics/cohort-revenue").then((r) => r.json()),
      fetch("/api/metrics/customer-segments").then((r) => r.json()),
    ])
      .then(([concResult, cohortResult, segResult]: [ConcentrationResponse, CohortResponse, SegmentResponse]) => {
        setData(concResult)
        setSegmentData(segResult)
        if (cohortResult.cohortData?.total) {
          const total = cohortResult.cohortData.total.reduce((sum: number, e: { average: number }) => sum + e.average, 0)
          setLtv(total)
        }
      })
      .catch((err) => console.error("Failed to fetch data:", err))
      .finally(() => setLoading(false))
  }, [])

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

  // Stacked bar data: Top 1, Next 2 (top3 - top1), Next 2 (top5 - top3), Rest (100 - top5)
  const chartData = dataset.map((d) => ({
    label: d.label,
    "Top 1": d.top1.pct,
    "Top 2-3": Math.max(0, d.top3.pct - d.top1.pct),
    "Top 4-5": Math.max(0, d.top5.pct - d.top3.pct),
    "Others": Math.max(0, 100 - d.top5.pct),
  }))

  // KPI cards
  const avgRevenuePerCustomer = latest && latest.customerCount > 0 ? latest.totalRevenue / latest.customerCount : 0

  const kpiCards = [
    {
      title: "Lifetime Value",
      value: ltv != null ? formatCurrency(ltv) : "N/A",
      sub: "Avg total revenue per new customer",
      icon: DollarSign,
    },
    {
      title: "Customer Concentration",
      value: latest ? `${latest.top1.pct.toFixed(1)}%` : "N/A",
      sub: latest ? `Top customer: ${latest.top1.name}` : "",
      icon: PieChartIcon,
      warn: latest ? latest.top1.pct > 25 : false,
    },
    {
      title: "Avg Revenue Per Customer",
      value: latest ? formatCurrency(avgRevenuePerCustomer) : "N/A",
      sub: latest ? `${latest.label} — ${latest.customerCount} customers` : "",
      icon: Users,
    },
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

      {/* Stacked Bar Concentration Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Customer Revenue Concentration
            <InfoTooltip text="Stacked % of total revenue by customer rank. Shows how concentrated revenue is among top customers. Lower Top 1 concentration = healthier, more diversified revenue." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
              <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} domain={[0, 100]} />
              <Legend />
              <ReferenceLine y={50} stroke="#999" strokeDasharray="3 3" />
              <Bar dataKey="Top 1" name="Top 1" stackId="a" fill="var(--chart-3)" radius={[0, 0, 0, 0]}>
                <LabelList dataKey="Top 1" position="center" fill="#fff" fontSize={11} fontWeight={600} formatter={(v: unknown) => { const n = Number(v); return n >= 5 ? `${Math.round(n)}%` : "" }} />
              </Bar>
              <Bar dataKey="Top 2-3" name="Top 2–3" stackId="a" fill="var(--chart-1)" radius={[0, 0, 0, 0]}>
                <LabelList dataKey="Top 2-3" position="center" fill="#fff" fontSize={11} fontWeight={600} formatter={(v: unknown) => { const n = Number(v); return n >= 5 ? `${Math.round(n)}%` : "" }} />
              </Bar>
              <Bar dataKey="Top 4-5" name="Top 4–5" stackId="a" fill="var(--chart-2)" radius={[0, 0, 0, 0]}>
                <LabelList dataKey="Top 4-5" position="center" fill="#fff" fontSize={11} fontWeight={600} formatter={(v: unknown) => { const n = Number(v); return n >= 5 ? `${Math.round(n)}%` : "" }} />
              </Bar>
              <Bar dataKey="Others" name="Others" stackId="a" fill="var(--chart-5)" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="Others" position="center" fill="#333" fontSize={11} fontWeight={600} formatter={(v: unknown) => { const n = Number(v); return n >= 5 ? `${Math.round(n)}%` : "" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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
                <InfoTooltip text="Revenue split between existing customers (active in Sep 2024) and new customers acquired after Sep 2024." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={segDataset} margin={{ top: 15, right: 20, left: 15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis
                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                    width={55}
                  />
                  <Legend />
                  <Bar dataKey="newRevenue" name="New Customers" stackId="a" fill="var(--chart-3)" radius={[0, 0, 0, 0]}>
                    <LabelList dataKey="newRevenue" position="center" fill="#fff" fontSize={11} fontWeight={600} formatter={(v: unknown) => { const n = Number(v); return n >= 500 ? `$${Math.round(n / 1000)}k` : "" }} />
                  </Bar>
                  <Bar dataKey="existingRevenue" name="Existing Customers" stackId="a" fill="var(--chart-2)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="existingRevenue" position="center" fill="#fff" fontSize={11} fontWeight={600} formatter={(v: unknown) => { const n = Number(v); return n >= 500 ? `$${Math.round(n / 1000)}k` : "" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )
      })()}
    </div>
  )
}
