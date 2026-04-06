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
      nrr: number
      churnedCustomers: { name: string; lastRevenue: number; revenueSharePct: number }[]
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
      const churnedCustomers: { name: string; lastRevenue: number; revenueSharePct: number }[] = []
      const totalPrevRevenue = [...prevActive.values()].reduce((s, v) => s + v, 0)

      for (const [customer, prevRev] of prevActive) {
        if (!currActive.has(customer)) {
          churnedCount++
          lostRevenue += prevRev
          churnedCustomers.push({
            name: customer,
            lastRevenue: Math.round(prevRev * 100) / 100,
            revenueSharePct: totalPrevRevenue > 0
              ? Math.round((prevRev / totalPrevRevenue) * 10000) / 100
              : 0,
          })
        }
      }

      // Sort churned by revenue impact descending
      churnedCustomers.sort((a, b) => b.lastRevenue - a.lastRevenue)

      const prevActiveCount = prevActive.size

      const logoChurnRate = prevActiveCount > 0 ? churnedCount / prevActiveCount : 0
      const revenueChurnRate = totalPrevRevenue > 0 ? lostRevenue / totalPrevRevenue : 0

      // NRR: revenue in current month from customers who were active in prior month / prior month total revenue
      let retainedRevenue = 0
      for (const [customer, currRev] of currActive) {
        if (prevActive.has(customer)) {
          retainedRevenue += currRev
        }
      }
      const nrr = totalPrevRevenue > 0 ? (retainedRevenue / totalPrevRevenue) * 100 : 0

      months.push({
        period,
        activeCount: currActive.size,
        churnedCount,
        logoChurnRate: Math.round(logoChurnRate * 10000) / 100,
        revenueChurnRate: Math.round(revenueChurnRate * 10000) / 100,
        lostRevenue: Math.round(lostRevenue * 100) / 100,
        totalRevenue: Math.round([...currActive.values()].reduce((s, v) => s + v, 0) * 100) / 100,
        nrr: Math.round(nrr * 100) / 100,
        churnedCustomers,
      })

      prevActive = currActive
    }

    // Compute Annual NRR: for each month where N-12 exists,
    // sum revenue from customers who had revenue in N-12, compare to their N revenue
    const annualNrr: { period: string; priorPeriod: string; nrr: number; customerCount: number; priorRevenue: number; currentRevenue: number; customers: { name: string; priorRevenue: number; currentRevenue: number; change: number }[] }[] = []

    for (const period of sortedPeriods) {
      // Compute period N-12
      const [y, m] = period.split("-").map(Number)
      const priorYear = m <= 12 ? y - 1 : y
      const priorMonth = m
      const priorPeriod = `${priorYear}-${String(priorMonth).padStart(2, "0")}`

      // Only report if prior year period exists in the dataset
      if (!sortedPeriods.includes(priorPeriod)) continue

      // Find customers who had revenue in the prior year same month
      let priorRevenue = 0
      let currentRevenue = 0
      let customerCount = 0
      const customers: { name: string; priorRevenue: number; currentRevenue: number; change: number }[] = []

      for (const customer of filteredCustomers) {
        const priorRev = customerPeriodTotals.get(customer)!.get(priorPeriod) || 0
        if (priorRev > 0) {
          const currRev = customerPeriodTotals.get(customer)!.get(period) || 0
          priorRevenue += priorRev
          currentRevenue += currRev
          customerCount++
          customers.push({
            name: customer,
            priorRevenue: Math.round(priorRev * 100) / 100,
            currentRevenue: Math.round(currRev * 100) / 100,
            change: Math.round((currRev - priorRev) * 100) / 100,
          })
        }
      }

      customers.sort((a, b) => a.change - b.change)

      if (priorRevenue > 0) {
        annualNrr.push({
          period,
          priorPeriod,
          nrr: Math.round((currentRevenue / priorRevenue) * 10000) / 100,
          customerCount,
          priorRevenue: Math.round(priorRevenue * 100) / 100,
          currentRevenue: Math.round(currentRevenue * 100) / 100,
          customers,
        })
      }
    }

    // Compute summaries using true churn: total churned / starting active count
    const ratesWithData = months.filter((m) => m.period !== sortedPeriods[0])

    const lastQuarterMonths = ratesWithData.slice(-3)
    const ttmMonths = ratesWithData.slice(-12)

    // Starting active count = activeCount of the month before the window
    const qStartIdx = months.indexOf(lastQuarterMonths[0]) - 1
    const qStartActive = qStartIdx >= 0 ? months[qStartIdx].activeCount : 0
    const qStartRevenue = qStartIdx >= 0 ? months[qStartIdx].totalRevenue : 0
    const qTotalChurned = lastQuarterMonths.reduce((s, m) => s + m.churnedCount, 0)
    const qTotalLostRevenue = lastQuarterMonths.reduce((s, m) => s + m.lostRevenue, 0)

    const ttmStartIdx = months.indexOf(ttmMonths[0]) - 1
    const ttmStartActive = ttmStartIdx >= 0 ? months[ttmStartIdx].activeCount : 0
    const ttmStartRevenue = ttmStartIdx >= 0 ? months[ttmStartIdx].totalRevenue : 0
    const ttmTotalChurned = ttmMonths.reduce((s, m) => s + m.churnedCount, 0)
    const ttmTotalLostRevenue = ttmMonths.reduce((s, m) => s + m.lostRevenue, 0)

    const summary = {
      lastQuarter: {
        logoChurn: qStartActive > 0 ? Math.round(qTotalChurned / qStartActive * 10000) / 100 : 0,
        revenueChurn: qStartRevenue > 0 ? Math.round(qTotalLostRevenue / qStartRevenue * 10000) / 100 : 0,
      },
      ttm: {
        logoChurn: ttmStartActive > 0 ? Math.round(ttmTotalChurned / ttmStartActive * 10000) / 100 : 0,
        revenueChurn: ttmStartRevenue > 0 ? Math.round(ttmTotalLostRevenue / ttmStartRevenue * 10000) / 100 : 0,
      },
    }

    return NextResponse.json({ months, annualNrr, summary })
  } catch (error) {
    console.error("Churn error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute churn" },
      { status: 500 }
    )
  }
}
