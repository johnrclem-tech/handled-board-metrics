"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/info-tooltip"
import { UserPlus } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface NewCustomerEntry {
  period: string
  count: number
}

export function NewCustomersChart() {
  const [data, setData] = useState<NewCustomerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/metrics/cohort-revenue")
      .then((res) => res.json())
      .then((result) => setData(result.newCustomers || []))
      .catch((err) => console.error("Failed to fetch new customer data:", err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>New Customer Acquisitions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[225px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return null
  }

  const totalNew = data.reduce((sum, d) => sum + d.count, 0)
  const avgPerMonth = totalNew / data.length

  // Format period labels: "2024-10" → "Oct 24"
  const chartData = data.map((d) => {
    const [year, month] = d.period.split("-")
    const monthName = new Date(Number(year), Number(month) - 1).toLocaleString("en-US", { month: "short" })
    return { ...d, label: `${monthName} ${year.slice(2)}` }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          New Customer Acquisitions
          <InfoTooltip text={`Count of customers starting their first billing month (excluding pre-existing). Total: ${totalNew} new customers, avg ${avgPerMonth.toFixed(1)}/mo.`} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={225}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={50}
              interval={0}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              formatter={(value) => [`${value} customers`, "New"]}
            />
            <Bar dataKey="count" name="New Customers" fill="#2a9d8f" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
