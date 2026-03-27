"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Users } from "lucide-react"
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

interface CohortSummaryChartProps {
  onViewDetails: () => void
  onDrill?: (filter: CohortDrillFilter) => void
}

export function CohortSummaryChart({ onViewDetails, onDrill }: CohortSummaryChartProps) {
  const [data, setData] = useState<CohortResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/metrics/cohort-revenue")
      .then((res) => res.json())
      .then((result) => setData(result))
      .catch((err) => console.error("Failed to fetch cohort data:", err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Average Revenue by Billing Month</CardTitle>
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

  const { cohortData } = data

  // Show first 12 months for the summary view
  const maxMonthsToShow = Math.min(12, data.metadata.maxBillingMonths)
  const months = Array.from({ length: maxMonthsToShow }, (_, i) => i + 1)

  const storageLookup = new Map(cohortData.storage.map((e) => [e.month, e]))
  const shippingLookup = new Map(cohortData.shipping.map((e) => [e.month, e]))
  const handlingLookup = new Map(cohortData.handling.map((e) => [e.month, e]))

  const chartData = months.map((month) => ({
    month: `Mo ${month}`,
    monthNum: month,
    storage: storageLookup.get(month)?.average || 0,
    shipping: shippingLookup.get(month)?.average || 0,
    handling: handlingLookup.get(month)?.average || 0,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (state: any) => {
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Average Revenue by Billing Month
            </CardTitle>
            <CardDescription>
              Stacked average revenue per new customer across their billing lifecycle ({data.metadata.totalCustomers} customers). Click a bar to view records.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onViewDetails} className="gap-1">
            View Details
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} onClick={handleBarClick} style={{ cursor: "pointer" }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis tickFormatter={(val) => `$${val}`} className="text-xs" />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Bar dataKey="storage" name="Storage" stackId="revenue" fill="#e76e50" radius={[0, 0, 0, 0]} />
            <Bar dataKey="handling" name="Handling" stackId="revenue" fill="#264653" radius={[0, 0, 0, 0]} />
            <Bar dataKey="shipping" name="Shipping" stackId="revenue" fill="#2a9d8f" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
