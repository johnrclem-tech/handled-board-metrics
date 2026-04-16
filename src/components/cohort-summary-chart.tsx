"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { Users } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  LabelList,
} from "recharts"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

type PeriodMode = "monthly" | "quarterly" | "ttm"

interface CohortSummaryChartProps {
  onViewDetails: () => void
  onDrill?: (filter: CohortDrillFilter) => void
  period?: PeriodMode
}

export function CohortSummaryChart({ onDrill, period = "monthly" }: CohortSummaryChartProps) {
  const [data, setData] = useState<CohortResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchData = async () => {
    setLoading(true)

    try {
      const res = await fetch("/api/metrics/cohort-revenue")
      const result = await res.json()
      setData(result)
    } catch (err) {
      console.error("Failed to fetch cohort data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>New Customer LTV by Billing Month</CardTitle>
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

  // Gross margins: Storage 10%, Shipping 15%, Handling 30%
  const gmStorage = lifetimeStorage * 0.10
  const gmShipping = lifetimeShipping * 0.15
  const gmHandling = lifetimeHandling * 0.30
  const gmTotal = gmStorage + gmShipping + gmHandling

  // Chart data — show ALL months, using gross margins instead of revenue
  const chartMonths = Array.from({ length: metadata.maxBillingMonths }, (_, i) => i + 1)

  const storageLookup = new Map(cohortData.storage.map((e) => [e.month, e]))
  const shippingLookup = new Map(cohortData.shipping.map((e) => [e.month, e]))
  const handlingLookup = new Map(cohortData.handling.map((e) => [e.month, e]))
  const totalLookup = new Map(cohortData.total.map((e) => [e.month, e]))

  const monthlyBarData = chartMonths.map((month) => ({
    month: `Mo ${month}`,
    monthNum: month,
    storage: (storageLookup.get(month)?.average || 0) * 0.10,
    shipping: (shippingLookup.get(month)?.average || 0) * 0.15,
    handling: (handlingLookup.get(month)?.average || 0) * 0.30,
    customerCount: totalLookup.get(month)?.customerCount || 0,
  }))

  // Quarterly aggregation: group billing months into quarters
  function aggregateToQuarters(entries: CohortEntry[]): { quarter: number; average: number; customerCount: number }[] {
    const qMap = new Map<number, { sum: number; maxCount: number }>()
    for (const e of entries) {
      const q = Math.ceil(e.month / 3)
      const prev = qMap.get(q) || { sum: 0, maxCount: 0 }
      qMap.set(q, { sum: prev.sum + e.average, maxCount: Math.max(prev.maxCount, e.customerCount) })
    }
    return Array.from(qMap.entries())
      .map(([q, { sum, maxCount }]) => ({ quarter: q, average: sum, customerCount: maxCount }))
      .sort((a, b) => a.quarter - b.quarter)
  }

  const quarterlyStorage = aggregateToQuarters(cohortData.storage)
  const quarterlyShipping = aggregateToQuarters(cohortData.shipping)
  const quarterlyHandling = aggregateToQuarters(cohortData.handling)

  const chartQuarters = Array.from({ length: Math.ceil(metadata.maxBillingMonths / 3) }, (_, i) => i + 1)

  const qStorageLookup = new Map(quarterlyStorage.map((e) => [e.quarter, e]))
  const qShippingLookup = new Map(quarterlyShipping.map((e) => [e.quarter, e]))
  const qHandlingLookup = new Map(quarterlyHandling.map((e) => [e.quarter, e]))

  const quarterlyTotal = aggregateToQuarters(cohortData.total)
  const qTotalLookup = new Map(quarterlyTotal.map((e) => [e.quarter, e]))

  const quarterlyBarData = chartQuarters.map((q) => ({
    month: `Q${q}`,
    monthNum: q,
    storage: (qStorageLookup.get(q)?.average || 0) * 0.10,
    shipping: (qShippingLookup.get(q)?.average || 0) * 0.15,
    handling: (qHandlingLookup.get(q)?.average || 0) * 0.30,
    customerCount: qTotalLookup.get(q)?.customerCount || 0,
  }))

  const barChartData = period === "quarterly" ? quarterlyBarData : monthlyBarData

  const cohortChartConfig = {
    handling: { label: "Handling GM", color: "var(--chart-1)" },
    shipping: { label: "Shipping GM", color: "var(--chart-2)" },
    storage: { label: "Storage GM", color: "var(--chart-3)" },
    total: { label: "Total GM", color: "var(--chart-5)" },
  } satisfies ChartConfig

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

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            New Customer LTV by {period === "quarterly" ? "Billing Quarter" : "Billing Month"}
            <InfoTooltip text={`Stacked average revenue per new customer (${metadata.totalCustomers} customers). Excludes pre-existing customers and those with first month before Jan 2025. Click a bar to view records.`} />
          </CardTitle>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <div className="flex flex-col">
              <span className="text-muted-foreground">Gross Margin Total</span>
              <span className="text-lg font-bold">{formatCurrency(gmTotal)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Storage (10%)</span>
              <span className="font-semibold" style={{ color: "var(--chart-3)" }}>{formatCurrency(gmStorage)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Handling (30%)</span>
              <span className="font-semibold" style={{ color: "var(--chart-1)" }}>{formatCurrency(gmHandling)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Shipping (15%)</span>
              <span className="font-semibold" style={{ color: "var(--chart-2)" }}>{formatCurrency(gmShipping)}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={cohortChartConfig} className="aspect-auto h-[300px] w-full">
          <BarChart data={barChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} onClick={handleChartClick} style={{ cursor: "pointer" }}>
            <CartesianGrid strokeDasharray="5 4" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
            <YAxis tickFormatter={(val) => `$${val}`} className="text-xs" />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent className="min-w-[200px]" labelFormatter={(label) => String(label)} formatter={(value) => [formatCurrency(Number(value))]} />}
            />
            <Legend />
            <Bar dataKey="handling" name="Handling GM" stackId="revenue" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="shipping" name="Shipping GM" stackId="revenue" fill="var(--chart-2)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="storage" name="Storage GM" stackId="revenue" fill="var(--chart-3)" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="customerCount"
                position="top"
                className="fill-muted-foreground text-[10px]"
                formatter={(v) => `n = ${v}`}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
