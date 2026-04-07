"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, DollarSign, Percent, Package, Truck } from "lucide-react"

interface MetricsSummary {
  category: string
  period: string
  total: string
}

interface MetricsResponse {
  summary: MetricsSummary[]
  periods: string[]
  details: Array<{
    id: number
    category: string
    accountName: string
    amount: string
    period: string
  }>
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function KpiOverview() {
  const [data, setData] = useState<MetricsResponse | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [selectedPeriod])

  const fetchMetrics = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedPeriod) params.set("period", selectedPeriod)
      params.set("reportType", "profit_loss")

      const response = await fetch(`/api/metrics?${params}`)
      const result = await response.json()
      setData(result)

      if (!selectedPeriod && result.periods?.length > 0) {
        setSelectedPeriod(result.periods[0])
      }
    } catch (error) {
      console.error("Failed to fetch metrics:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardDescription>Loading...</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Calculate KPIs from financial data
  const periodData = data?.summary?.filter((s) => s.period === selectedPeriod) || []

  const getTotal = (category: string) => {
    const item = periodData.find(
      (s) => s.category.toLowerCase().includes(category.toLowerCase())
    )
    return item ? parseFloat(item.total) : 0
  }

  const revenue = getTotal("revenue") || getTotal("income")
  const cogs = Math.abs(getTotal("cost of goods") || getTotal("cogs"))
  const grossProfit = revenue - cogs
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
  const operatingExpenses = Math.abs(getTotal("operating") || getTotal("expense"))
  const netIncome = grossProfit - operatingExpenses

  const kpis = [
    {
      title: "Total Revenue",
      value: formatCurrency(revenue),
      description: "Gross revenue for period",
      icon: DollarSign,
      trend: revenue > 0 ? "up" : "neutral",
    },
    {
      title: "Gross Profit",
      value: formatCurrency(grossProfit),
      description: `Gross margin: ${formatPercent(grossMargin)}`,
      icon: TrendingUp,
      trend: grossMargin > 30 ? "up" : "down",
    },
    {
      title: "Operating Expenses",
      value: formatCurrency(operatingExpenses),
      description: `${revenue > 0 ? formatPercent((operatingExpenses / revenue) * 100) : "0%"} of revenue`,
      icon: Truck,
      trend: "neutral",
    },
    {
      title: "Net Income",
      value: formatCurrency(netIncome),
      description: `Net margin: ${revenue > 0 ? formatPercent((netIncome / revenue) * 100) : "0%"}`,
      icon: Package,
      trend: netIncome > 0 ? "up" : "down",
    },
  ]

  const hasData = data?.periods && data.periods.length > 0

  return (
    <div className="space-y-4">
      {hasData && (
        <div className="flex justify-end">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {data?.periods?.map((period) => (
                <SelectItem key={period} value={period}>
                  {period}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">No data yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Go to the Import Data tab to upload your QuickBooks spreadsheets
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardDescription className="text-sm font-medium">{kpi.title}</CardDescription>
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-1/15">
                  <kpi.icon className="h-4 w-4 text-chart-1" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  {kpi.trend === "up" && (
                    <Badge variant="secondary" className="text-green-600 bg-green-50">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Positive
                    </Badge>
                  )}
                  {kpi.trend === "down" && (
                    <Badge variant="secondary" className="text-red-600 bg-red-50">
                      <TrendingDown className="h-3 w-3 mr-1" />
                      Negative
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{kpi.description}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
