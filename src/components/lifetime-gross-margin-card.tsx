"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { DollarSign } from "lucide-react"

interface FinancialRecord {
  category: string
  accountName: string
  period: string
  amount: string
}

interface ChurnMonth {
  period: string
  logoChurnRate: number
}

const GM_MARGIN: Record<string, number> = {
  "Storage Revenue": 0.10,
  "Shipping Revenue": 0.15,
  "Handling Revenue": 0.30,
}

const START_YEAR = 2025

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function LifetimeGrossMarginCard() {
  const [ltv, setLtv] = useState<number | null>(null)
  const [avgMonthlyGm, setAvgMonthlyGm] = useState<number | null>(null)
  const [churnRate, setChurnRate] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/metrics?category=Storage Revenue,Shipping Revenue,Handling Revenue").then((r) => r.json()),
      fetch("/api/metrics/churn?segment=all").then((r) => r.json()),
    ])
      .then(([metricsData, churnData]) => {
        const records: FinancialRecord[] = metricsData.details || []

        // Build per-customer: total GM and active month count
        const customerData = new Map<string, { totalGm: number; activeMonths: number }>()
        // First pass: aggregate per customer × period × category
        const raw = new Map<string, Map<string, Map<string, number>>>()
        for (const r of records) {
          const amt = parseFloat(r.amount) || 0
          if (amt === 0) continue
          if (!raw.has(r.accountName)) raw.set(r.accountName, new Map())
          const custMap = raw.get(r.accountName)!
          if (!custMap.has(r.period)) custMap.set(r.period, new Map())
          const catMap = custMap.get(r.period)!
          catMap.set(r.category, (catMap.get(r.category) || 0) + amt)
        }

        for (const [customer, periodMap] of raw) {
          let totalGm = 0
          let activeMonths = 0
          for (const [, catMap] of periodMap) {
            let periodTotal = 0
            let periodGm = 0
            for (const [cat, amt] of catMap) {
              periodTotal += amt
              periodGm += amt * (GM_MARGIN[cat] || 0)
            }
            totalGm += periodGm
            if (periodTotal > 0) activeMonths++
          }
          customerData.set(customer, {
            totalGm,
            activeMonths,
          })
        }

        // Average of each customer's Avg Monthly GM
        let sumAvgMonthlyGm = 0
        let custCount = 0
        for (const [, d] of customerData) {
          if (d.activeMonths > 0) {
            sumAvgMonthlyGm += d.totalGm / d.activeMonths
            custCount++
          }
        }
        const avgGm = custCount > 0 ? sumAvgMonthlyGm / custCount : 0
        setAvgMonthlyGm(avgGm)

        // Average monthly logo churn rate from 2025+, excluding current month
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
        const churnMonths: ChurnMonth[] = (churnData.months || [])
          .slice(1)
          .filter((m: ChurnMonth) => {
            const year = parseInt(m.period.slice(0, 4), 10)
            return year >= START_YEAR && m.period < currentMonth
          })

        const avgChurn =
          churnMonths.length > 0
            ? churnMonths.reduce((s: number, m: ChurnMonth) => s + m.logoChurnRate, 0) / churnMonths.length
            : 0
        setChurnRate(avgChurn)

        if (avgChurn > 0 && avgGm > 0) {
          setLtv(avgGm / (avgChurn / 100))
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
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-1/15">
          <DollarSign className="h-4 w-4 text-chart-1" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {ltv != null ? formatCurrency(ltv) : "N/A"}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {avgMonthlyGm != null ? `${formatCurrency(avgMonthlyGm)} avg monthly GM` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {churnRate != null ? `${churnRate.toFixed(1)}% avg monthly churn` : ""}
        </p>
      </CardContent>
    </Card>
  )
}
