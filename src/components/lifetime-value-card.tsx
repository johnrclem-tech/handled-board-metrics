"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { DollarSign } from "lucide-react"

interface ServiceData {
  totalRevenue: number
  customerMonths: number
}

interface LtvResponse {
  storage: ServiceData
  shipping: ServiceData
  handling: ServiceData
}

interface ChurnMonth {
  period: string
  logoChurnRate: number
}

interface ChurnResponse {
  months: ChurnMonth[]
}

// Gross margin percentages per service — hardcoded per business actuals
const MARGIN = { storage: 0.10, shipping: 0.15, handling: 0.30 }

const START_YEAR = 2025

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function LifetimeValueCard() {
  const [ltv, setLtv] = useState<number | null>(null)
  const [monthlyGm, setMonthlyGm] = useState<number | null>(null)
  const [churnRate, setChurnRate] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/metrics/ltv").then((r) => r.json()),
      fetch("/api/metrics/churn?segment=all").then((r) => r.json()),
    ])
      .then(([ltvData, churnData]: [LtvResponse, ChurnResponse]) => {
        // Average monthly revenue per service per customer
        const storageAvg =
          ltvData.storage.customerMonths > 0
            ? ltvData.storage.totalRevenue / ltvData.storage.customerMonths
            : 0
        const shippingAvg =
          ltvData.shipping.customerMonths > 0
            ? ltvData.shipping.totalRevenue / ltvData.shipping.customerMonths
            : 0
        const handlingAvg =
          ltvData.handling.customerMonths > 0
            ? ltvData.handling.totalRevenue / ltvData.handling.customerMonths
            : 0

        // Average monthly gross margin per service, then sum
        const totalMonthlyGm =
          storageAvg * MARGIN.storage +
          shippingAvg * MARGIN.shipping +
          handlingAvg * MARGIN.handling

        setMonthlyGm(totalMonthlyGm)

        // Average monthly churn rate from 2025+, excluding current month and
        // the first month (which has no prior-month reference)
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
        const churnMonths = (churnData.months || [])
          .slice(1) // skip first (no prior month)
          .filter((m) => {
            const year = parseInt(m.period.slice(0, 4), 10)
            return year >= START_YEAR && m.period < currentMonth
          })

        const avgChurn =
          churnMonths.length > 0
            ? churnMonths.reduce((s, m) => s + m.logoChurnRate, 0) / churnMonths.length
            : 0

        setChurnRate(avgChurn)

        if (avgChurn > 0) {
          setLtv(totalMonthlyGm / (avgChurn / 100))
        } else {
          setLtv(null)
        }
      })
      .catch((err) => console.error("Failed to compute LTV:", err))
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="text-sm font-medium">Lifetime Value</CardDescription>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-2/15">
          <DollarSign className="h-4 w-4 text-chart-2" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {ltv != null ? formatCurrency(ltv) : "N/A"}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {monthlyGm != null && churnRate != null
            ? `${formatCurrency(monthlyGm)} monthly GM ÷ ${churnRate.toFixed(1)}% churn`
            : "Insufficient data"}
        </p>
      </CardContent>
    </Card>
  )
}
