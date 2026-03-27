"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface ChartData {
  period: string
  revenue: number
  cogs: number
  grossProfit: number
  expenses: number
  netIncome: number
}

export function RevenueChart() {
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchChartData()
  }, [])

  const fetchChartData = async () => {
    try {
      const response = await fetch("/api/metrics?reportType=profit_loss")
      const data = await response.json()

      if (!data.summary || data.summary.length === 0) {
        setLoading(false)
        return
      }

      // Group by period and calculate metrics
      const periodMap = new Map<string, ChartData>()

      for (const item of data.summary) {
        if (!periodMap.has(item.period)) {
          periodMap.set(item.period, {
            period: item.period,
            revenue: 0,
            cogs: 0,
            grossProfit: 0,
            expenses: 0,
            netIncome: 0,
          })
        }

        const entry = periodMap.get(item.period)!
        const amount = parseFloat(item.total)
        const cat = item.category.toLowerCase()

        if (cat.includes("revenue") || cat.includes("income")) {
          entry.revenue += amount
        } else if (cat.includes("cost of goods") || cat.includes("cogs")) {
          entry.cogs += Math.abs(amount)
        } else if (cat.includes("expense") || cat.includes("operating")) {
          entry.expenses += Math.abs(amount)
        }
      }

      // Calculate derived metrics
      const result = Array.from(periodMap.values())
        .map((entry) => ({
          ...entry,
          grossProfit: entry.revenue - entry.cogs,
          netIncome: entry.revenue - entry.cogs - entry.expenses,
        }))
        .sort((a, b) => a.period.localeCompare(b.period))

      setChartData(result)
    } catch (error) {
      console.error("Failed to fetch chart data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue & Profitability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading chart data...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 0) {
    return null
  }

  const formatValue = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue & Profitability</CardTitle>
        <CardDescription>Monthly financial performance across periods</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="period" className="text-xs" />
            <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} className="text-xs" />
            <Tooltip
              formatter={(value) => formatValue(Number(value))}
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Bar dataKey="revenue" name="Revenue" fill="#e76e50" radius={[4, 4, 0, 0]} />
            <Bar dataKey="grossProfit" name="Gross Profit" fill="#2a9d8f" radius={[4, 4, 0, 0]} />
            <Bar dataKey="netIncome" name="Net Income" fill="#264653" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
