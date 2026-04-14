"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { UserPlus } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface NewCustomerEntry {
  period: string
  count: number
}

export type NewCustomersPeriod = "monthly" | "quarterly" | "ttm"

interface NewCustomersChartProps {
  period?: NewCustomersPeriod
}

function getMonthRange(start: string, end: string): string[] {
  const months: string[] = []
  let [y, m] = start.split("-").map(Number)
  const [ey, em] = end.split("-").map(Number)
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

export function NewCustomersChart({ period = "monthly" }: NewCustomersChartProps) {
  const [data, setData] = useState<NewCustomerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/metrics/cohort-revenue")
      .then((res) => res.json())
      .then((result) => setData(result.newCustomers || []))
      .catch((err) => console.error("Failed to fetch new customer data:", err))
      .finally(() => setLoading(false))
  }, [])

  const chartData = useMemo(() => {
    if (data.length === 0) return []

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const currentQuarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`

    // Base monthly map — sum by period
    const monthMap = new Map<string, number>()
    for (const d of data) {
      monthMap.set(d.period, (monthMap.get(d.period) || 0) + d.count)
    }

    if (period === "monthly") {
      return Array.from(monthMap.entries())
        .filter(([p]) => p < currentMonth)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([p, count]) => {
          const [year, month] = p.split("-")
          const monthName = new Date(Number(year), Number(month) - 1).toLocaleString("en-US", { month: "short" })
          return { period: p, label: `${monthName} ${year.slice(2)}`, count }
        })
    }

    if (period === "quarterly") {
      const quarterMap = new Map<string, { count: number; monthCount: number }>()
      for (const [p, count] of monthMap) {
        const [y, m] = p.split("-").map(Number)
        const q = Math.ceil(m / 3)
        const qKey = `${y}-Q${q}`
        const prev = quarterMap.get(qKey) || { count: 0, monthCount: 0 }
        quarterMap.set(qKey, { count: prev.count + count, monthCount: prev.monthCount + 1 })
      }
      return Array.from(quarterMap.entries())
        .filter(([qKey, v]) => v.monthCount === 3 && qKey < currentQuarter)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([qKey, v]) => {
          const [y, qPart] = qKey.split("-Q")
          return { period: qKey, label: `Q${qPart} ${y.slice(2)}`, count: v.count }
        })
    }

    // TTM — rolling 12-month sum, exclude the most recent month
    const allMonths = Array.from(monthMap.keys()).sort()
    if (allMonths.length < 2) return []
    const ttmMonths = allMonths.slice(0, -1)
    if (ttmMonths.length < 12) return []

    const result: { period: string; label: string; count: number }[] = []
    for (let i = 11; i < ttmMonths.length; i++) {
      const endMonth = ttmMonths[i]
      const [ey, em] = endMonth.split("-").map(Number)
      const startDate = new Date(ey, em - 12, 1)
      const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`
      const window = getMonthRange(startMonth, endMonth)
      const sum = window.reduce((s, m) => s + (monthMap.get(m) || 0), 0)
      const monthName = new Date(ey, em - 1).toLocaleString("en-US", { month: "short" })
      result.push({ period: endMonth, label: `${monthName} ${String(ey).slice(2)}`, count: sum })
    }
    return result
  }, [data, period])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>New Customers Billed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[225px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 0) return null

  const totalNew = chartData.reduce((sum, d) => sum + d.count, 0)
  const avgPerPeriod = totalNew / chartData.length
  const periodLabel = period === "monthly" ? "month" : period === "quarterly" ? "quarter" : "TTM window"

  const chartConfig = {
    count: { label: "New Customers", color: "var(--chart-2)" },
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          New Customers Billed
          <InfoTooltip text={`Count of customers starting their first billing month (excluding pre-existing). Total: ${totalNew} new customers, avg ${avgPerPeriod.toFixed(1)}/${periodLabel}.`} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[225px] w-full">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="5 4" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={50}
              interval={0}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={30} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent className="min-w-[180px]" />}
            />
            <Bar dataKey="count" name="New Customers" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
