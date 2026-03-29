import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData } from "@/lib/db/schema"
import { sql, inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"

const CATEGORIES = ["Storage Revenue", "Shipping Revenue", "Handling Revenue"] as const

export async function GET(request: NextRequest) {
  try {
    const segment = request.nextUrl.searchParams.get("segment") || "all"
    const db = getDb()

    const rows = await db
      .select({
        accountName: financialData.accountName,
        period: financialData.period,
        category: financialData.category,
        amount: sql<string>`SUM(${financialData.amount}::numeric)`,
      })
      .from(financialData)
      .where(inArray(financialData.category, [...CATEGORIES]))
      .groupBy(financialData.accountName, financialData.period, financialData.category)

    if (rows.length === 0) {
      return NextResponse.json({ months: [], summary: null })
    }

    // Build per-customer per-period totals
    const customerPeriodTotals = new Map<string, Map<string, number>>()
    const allPeriods = new Set<string>()

    for (const row of rows) {
      if (!customerPeriodTotals.has(row.accountName)) {
        customerPeriodTotals.set(row.accountName, new Map())
      }
      const periodMap = customerPeriodTotals.get(row.accountName)!
      periodMap.set(row.period, (periodMap.get(row.period) || 0) + parseFloat(row.amount))
      allPeriods.add(row.period)
    }

    // Identify pre-existing customers (revenue > 0 in Sep 2024)
    const existingCustomers = new Set<string>()
    for (const [customer, periodMap] of customerPeriodTotals) {
      const sep = periodMap.get("2024-09")
      if (sep && sep > 0) {
        existingCustomers.add(customer)
      }
    }

    // Filter by segment
    const filteredCustomers = new Set<string>()
    for (const customer of customerPeriodTotals.keys()) {
      if (segment === "new" && existingCustomers.has(customer)) continue
      if (segment === "existing" && !existingCustomers.has(customer)) continue
      filteredCustomers.add(customer)
    }

    // Sort periods
    const sortedPeriods = [...allPeriods].sort()

    // For each month, determine active and churned customers
    const months: {
      period: string
      activeCount: number
      churnedCount: number
      logoChurnRate: number
      revenueChurnRate: number
      lostRevenue: number
      totalRevenue: number
    }[] = []

    let prevActive = new Map<string, number>() // customer -> revenue in prior month

    for (const period of sortedPeriods) {
      // Current month: who is active?
      const currActive = new Map<string, number>()
      for (const customer of filteredCustomers) {
        const rev = customerPeriodTotals.get(customer)!.get(period) || 0
        if (rev > 0) {
          currActive.set(customer, rev)
        }
      }

      // Churned: was in prevActive, not in currActive
      let churnedCount = 0
      let lostRevenue = 0
      for (const [customer, prevRev] of prevActive) {
        if (!currActive.has(customer)) {
          churnedCount++
          lostRevenue += prevRev
        }
      }

      const prevActiveCount = prevActive.size
      const totalPrevRevenue = [...prevActive.values()].reduce((s, v) => s + v, 0)

      const logoChurnRate = prevActiveCount > 0 ? churnedCount / prevActiveCount : 0
      const revenueChurnRate = totalPrevRevenue > 0 ? lostRevenue / totalPrevRevenue : 0

      months.push({
        period,
        activeCount: currActive.size,
        churnedCount,
        logoChurnRate: Math.round(logoChurnRate * 10000) / 100, // as percentage
        revenueChurnRate: Math.round(revenueChurnRate * 10000) / 100,
        lostRevenue: Math.round(lostRevenue * 100) / 100,
        totalRevenue: Math.round([...currActive.values()].reduce((s, v) => s + v, 0) * 100) / 100,
      })

      prevActive = currActive
    }

    // Compute summaries (skip first month which has no prior)
    const ratesWithData = months.filter((m) => m.period !== sortedPeriods[0])

    const lastQuarterMonths = ratesWithData.slice(-3)
    const ttmMonths = ratesWithData.slice(-12)

    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 100) / 100 : 0

    const summary = {
      lastQuarter: {
        logoChurn: avg(lastQuarterMonths.map((m) => m.logoChurnRate)),
        revenueChurn: avg(lastQuarterMonths.map((m) => m.revenueChurnRate)),
      },
      ttm: {
        logoChurn: avg(ttmMonths.map((m) => m.logoChurnRate)),
        revenueChurn: avg(ttmMonths.map((m) => m.revenueChurnRate)),
      },
    }

    return NextResponse.json({ months, summary })
  } catch (error) {
    console.error("Churn error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute churn" },
      { status: 500 }
    )
  }
}
