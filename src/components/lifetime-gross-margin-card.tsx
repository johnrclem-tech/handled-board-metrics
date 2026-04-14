"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { DollarSign } from "lucide-react"

interface CohortResponse {
  cohortData: {
    storage: { month: number; average: number; customerCount: number }[]
    shipping: { month: number; average: number; customerCount: number }[]
    handling: { month: number; average: number; customerCount: number }[]
    total: { month: number; average: number; customerCount: number }[]
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

export function LifetimeGrossMarginCard() {
  const [ltv, setLtv] = useState<number | null>(null)
  const [gm, setGm] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/metrics/cohort-revenue")
      .then((r) => r.json())
      .then((result: CohortResponse) => {
        if (result.cohortData?.total) {
          const total = result.cohortData.total.reduce((s, e) => s + e.average, 0)
          setLtv(total)
          const storage = (result.cohortData.storage || []).reduce((s, e) => s + e.average, 0)
          const shipping = (result.cohortData.shipping || []).reduce((s, e) => s + e.average, 0)
          const handling = (result.cohortData.handling || []).reduce((s, e) => s + e.average, 0)
          setGm(storage * 0.10 + shipping * 0.15 + handling * 0.30)
        }
      })
      .catch((err) => console.error("Failed to fetch LTV data:", err))
  }, [])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="text-sm font-medium">Lifetime Gross Margin</CardDescription>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-1/15">
          <DollarSign className="h-4 w-4 text-chart-1" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {gm != null ? formatCurrency(gm) : "N/A"}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {ltv != null ? `Based on ${formatCurrency(ltv)} lifetime revenue` : ""}
        </p>
      </CardContent>
    </Card>
  )
}
