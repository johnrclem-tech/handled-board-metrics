"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserPlus } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
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
          <div className="h-[300px] flex items-center justify-center">
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          New Customer Acquisitions
        </CardTitle>
        <CardDescription>
          Count of customers starting their first billing month (excluding pre-existing).
          Total: {totalNew} new customers, avg {avgPerMonth.toFixed(1)}/month.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="period" className="text-xs" />
            <YAxis allowDecimals={false} className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              formatter={(value) => [`${value} customers`, "New"]}
            />
            <Bar dataKey="count" name="New Customers" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.count >= avgPerMonth ? "#2a9d8f" : "#e76e50"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
