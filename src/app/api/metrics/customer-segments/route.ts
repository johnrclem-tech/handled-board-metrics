import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData } from "@/lib/db/schema"
import { sql, inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function GET() {
  try {
    const db = getDb()

    const rows = await db
      .select({
        accountName: financialData.accountName,
        period: financialData.period,
        amount: sql<string>`SUM(${financialData.amount}::numeric)`,
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

    if (rows.length === 0) {
      return NextResponse.json({ monthly: [], quarterly: [], ttm: [] })
    }

    // Build per-customer per-period revenue
    const customerPeriods = new Map<string, Map<string, number>>()
    const allPeriods = new Set<string>()

    for (const row of rows) {
      const amt = parseFloat(row.amount)
      if (!customerPeriods.has(row.accountName)) customerPeriods.set(row.accountName, new Map())
      const pm = customerPeriods.get(row.accountName)!
      pm.set(row.period, (pm.get(row.period) || 0) + amt)
      allPeriods.add(row.period)
    }

    // Identify existing customers (revenue > 0 in Sep 2024)
    const existingCustomers = new Set<string>()
    for (const [customer, pm] of customerPeriods) {
      const sep = pm.get("2024-09") || 0
      if (sep > 0) existingCustomers.add(customer)
    }

    const sortedPeriods = [...allPeriods].sort()

    // Monthly: aggregate new vs existing revenue
    interface SegBucket { newRevenue: number; existingRevenue: number; newCount: number; existingCount: number }
    const monthlyMap = new Map<string, SegBucket>()

    for (const period of sortedPeriods) {
      const bucket: SegBucket = { newRevenue: 0, existingRevenue: 0, newCount: 0, existingCount: 0 }
      for (const [customer, pm] of customerPeriods) {
        const rev = pm.get(period) || 0
        if (rev <= 0) continue
        if (existingCustomers.has(customer)) {
          bucket.existingRevenue += rev
          bucket.existingCount++
        } else {
          bucket.newRevenue += rev
          bucket.newCount++
        }
      }
      monthlyMap.set(period, bucket)
    }

    const monthly = sortedPeriods.map((period) => {
      const b = monthlyMap.get(period)!
      const [y, m] = period.split("-").map(Number)
      const monthName = new Date(y, m - 1).toLocaleString("en-US", { month: "short" })
      return {
        period,
        label: `${monthName} ${String(y).slice(2)}`,
        newRevenue: round2(b.newRevenue),
        existingRevenue: round2(b.existingRevenue),
        total: round2(b.newRevenue + b.existingRevenue),
        newCount: b.newCount,
        existingCount: b.existingCount,
      }
    })

    // Quarterly
    const quarterBuckets = new Map<string, SegBucket>()
    const quarterLabels = new Map<string, string>()
    const quarterMonthCounts = new Map<string, number>()

    for (const period of sortedPeriods) {
      const [y, m] = period.split("-").map(Number)
      const q = Math.ceil(m / 3)
      const qKey = `${y}-Q${q}`
      if (!quarterBuckets.has(qKey)) {
        quarterBuckets.set(qKey, { newRevenue: 0, existingRevenue: 0, newCount: 0, existingCount: 0 })
        quarterLabels.set(qKey, `Q${q} ${String(y).slice(2)}`)
        quarterMonthCounts.set(qKey, 0)
      }
      quarterMonthCounts.set(qKey, (quarterMonthCounts.get(qKey) || 0) + 1)
      const mb = monthlyMap.get(period)!
      const qb = quarterBuckets.get(qKey)!
      qb.newRevenue += mb.newRevenue
      qb.existingRevenue += mb.existingRevenue
    }

    // For quarterly customer counts, need to deduplicate across months
    const quarterCustomers = new Map<string, { new: Set<string>; existing: Set<string> }>()
    for (const period of sortedPeriods) {
      const [y, m] = period.split("-").map(Number)
      const q = Math.ceil(m / 3)
      const qKey = `${y}-Q${q}`
      if (!quarterCustomers.has(qKey)) quarterCustomers.set(qKey, { new: new Set(), existing: new Set() })
      const qc = quarterCustomers.get(qKey)!
      for (const [customer, pm] of customerPeriods) {
        const rev = pm.get(period) || 0
        if (rev <= 0) continue
        if (existingCustomers.has(customer)) qc.existing.add(customer)
        else qc.new.add(customer)
      }
    }

    const sortedQuarters = [...quarterBuckets.keys()].sort()
    const quarterly = sortedQuarters
      .filter((qKey) => quarterMonthCounts.get(qKey) === 3)
      .map((qKey) => {
        const qb = quarterBuckets.get(qKey)!
        const qc = quarterCustomers.get(qKey)!
        return {
          period: qKey,
          label: quarterLabels.get(qKey)!,
          newRevenue: round2(qb.newRevenue),
          existingRevenue: round2(qb.existingRevenue),
          total: round2(qb.newRevenue + qb.existingRevenue),
          newCount: qc.new.size,
          existingCount: qc.existing.size,
        }
      })

    // TTM
    const ttm: typeof monthly = []
    for (let i = 11; i < sortedPeriods.length; i++) {
      const windowPeriods = sortedPeriods.slice(i - 11, i + 1)
      let newRev = 0, existingRev = 0
      const newCusts = new Set<string>(), existingCusts = new Set<string>()

      for (const p of windowPeriods) {
        for (const [customer, pm] of customerPeriods) {
          const rev = pm.get(p) || 0
          if (rev <= 0) continue
          if (existingCustomers.has(customer)) {
            existingRev += rev
            existingCusts.add(customer)
          } else {
            newRev += rev
            newCusts.add(customer)
          }
        }
      }

      const endPeriod = sortedPeriods[i]
      const [ey, em] = endPeriod.split("-").map(Number)
      const monthName = new Date(ey, em - 1).toLocaleString("en-US", { month: "short" })

      ttm.push({
        period: endPeriod,
        label: `${monthName} ${String(ey).slice(2)}`,
        newRevenue: round2(newRev),
        existingRevenue: round2(existingRev),
        total: round2(newRev + existingRev),
        newCount: newCusts.size,
        existingCount: existingCusts.size,
      })
    }

    return NextResponse.json({ monthly, quarterly, ttm })
  } catch (error) {
    console.error("Customer segments error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute customer segments" },
      { status: 500 }
    )
  }
}
