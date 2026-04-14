import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData } from "@/lib/db/schema"
import { sql, inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function computeConcentration(customers: { customer: string; total: number }[]) {
  customers.sort((a, b) => b.total - a.total)
  const totalRevenue = customers.reduce((sum, c) => sum + c.total, 0)
  const top1Revenue = customers.slice(0, 1).reduce((sum, c) => sum + c.total, 0)
  const top3Revenue = customers.slice(0, 3).reduce((sum, c) => sum + c.total, 0)
  const top5Revenue = customers.slice(0, 5).reduce((sum, c) => sum + c.total, 0)

  return {
    totalRevenue: round2(totalRevenue),
    customerCount: customers.length,
    top1: {
      pct: totalRevenue > 0 ? round2((top1Revenue / totalRevenue) * 100) : 0,
      revenue: round2(top1Revenue),
      name: customers[0]?.customer || "",
    },
    top3: {
      pct: totalRevenue > 0 ? round2((top3Revenue / totalRevenue) * 100) : 0,
      revenue: round2(top3Revenue),
      names: customers.slice(0, 3).map((c) => c.customer),
    },
    top5: {
      pct: totalRevenue > 0 ? round2((top5Revenue / totalRevenue) * 100) : 0,
      revenue: round2(top5Revenue),
      names: customers.slice(0, 5).map((c) => c.customer),
    },
  }
}

export async function GET() {
  try {
    const db = getDb()

    const rows = await db
      .select({
        accountName: financialData.accountName,
        period: financialData.period,
        total: sql<string>`SUM(${financialData.amount}::numeric)`,
      })
      .from(financialData)
      .where(
        inArray(financialData.category, [
          "Storage Revenue",
          "Shipping Revenue",
          "Handling Revenue",
        ])
      )
      .groupBy(financialData.accountName, financialData.period)
      .orderBy(financialData.period)

    if (rows.length === 0) {
      return NextResponse.json({ monthly: [], quarterly: [], ttm: [] })
    }

    // Build per-period per-customer map
    const periodMap = new Map<string, Map<string, number>>()
    for (const row of rows) {
      const total = parseFloat(row.total)
      if (total <= 0) continue
      if (!periodMap.has(row.period)) periodMap.set(row.period, new Map())
      const cm = periodMap.get(row.period)!
      cm.set(row.accountName, (cm.get(row.accountName) || 0) + total)
    }

    const sortedPeriods = [...periodMap.keys()].sort()

    // Determine current month/quarter to exclude incomplete periods
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const currentQuarter = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`

    // Monthly (exclude current month)
    const monthly = sortedPeriods
      .filter((period) => period < currentMonth)
      .map((period) => {
        const cm = periodMap.get(period)!
        const customers = [...cm.entries()].map(([customer, total]) => ({ customer, total }))
        const [y, m] = period.split("-").map(Number)
        const monthName = new Date(y, m - 1).toLocaleString("en-US", { month: "short" })
        return {
          period,
          label: `${monthName} ${String(y).slice(2)}`,
          ...computeConcentration(customers),
        }
      })

    // Quarterly
    const quarterBuckets = new Map<string, Map<string, number>>()
    const quarterLabels = new Map<string, string>()
    const quarterMonthCounts = new Map<string, number>()

    for (const period of sortedPeriods) {
      const [y, m] = period.split("-").map(Number)
      const q = Math.ceil(m / 3)
      const qKey = `${y}-Q${q}`
      if (!quarterBuckets.has(qKey)) {
        quarterBuckets.set(qKey, new Map())
        quarterLabels.set(qKey, `Q${q} ${String(y).slice(2)}`)
        quarterMonthCounts.set(qKey, 0)
      }
      quarterMonthCounts.set(qKey, (quarterMonthCounts.get(qKey) || 0) + 1)
      const cm = periodMap.get(period)!
      const qm = quarterBuckets.get(qKey)!
      for (const [customer, total] of cm) {
        qm.set(customer, (qm.get(customer) || 0) + total)
      }
    }

    const sortedQuarters = [...quarterBuckets.keys()].sort()
    const quarterly = sortedQuarters
      .filter((qKey) => quarterMonthCounts.get(qKey) === 3 && qKey < currentQuarter)
      .map((qKey) => {
        const qm = quarterBuckets.get(qKey)!
        const customers = [...qm.entries()].map(([customer, total]) => ({ customer, total }))
        return {
          period: qKey,
          label: quarterLabels.get(qKey)!,
          ...computeConcentration(customers),
        }
      })

    // TTM (trailing 12 months) — exclude the most recent month from all windows
    const ttmPeriods = sortedPeriods.slice(0, -1)
    const ttm: typeof monthly = []
    for (let i = 11; i < ttmPeriods.length; i++) {
      const windowPeriods = ttmPeriods.slice(i - 11, i + 1)
      const ttmCustomers = new Map<string, number>()
      for (const p of windowPeriods) {
        const cm = periodMap.get(p)!
        for (const [customer, total] of cm) {
          ttmCustomers.set(customer, (ttmCustomers.get(customer) || 0) + total)
        }
      }
      const customers = [...ttmCustomers.entries()].map(([customer, total]) => ({ customer, total }))
      const endPeriod = ttmPeriods[i]
      const [ey, em] = endPeriod.split("-").map(Number)
      const monthName = new Date(ey, em - 1).toLocaleString("en-US", { month: "short" })
      ttm.push({
        period: endPeriod,
        label: `${monthName} ${String(ey).slice(2)}`,
        ...computeConcentration(customers),
      })
    }

    return NextResponse.json({ monthly, quarterly, ttm })
  } catch (error) {
    console.error("Concentration error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute concentration" },
      { status: 500 }
    )
  }
}
