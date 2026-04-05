import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData } from "@/lib/db/schema"
import { sql, inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"

const CATEGORIES = ["Storage Revenue", "Shipping Revenue", "Handling Revenue"] as const

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function yoyPct(current: number, prior: number): number | null {
  if (prior === 0) return current > 0 ? null : 0
  return round2(((current - prior) / prior) * 100)
}

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
      return NextResponse.json({ monthly: [], quarterly: [], annual: [] })
    }

    // Build per-customer per-period per-category map
    const customerData = new Map<string, Map<string, { storage: number; shipping: number; handling: number }>>()
    const allPeriods = new Set<string>()

    for (const row of rows) {
      if (!customerData.has(row.accountName)) customerData.set(row.accountName, new Map())
      const periodMap = customerData.get(row.accountName)!
      if (!periodMap.has(row.period)) periodMap.set(row.period, { storage: 0, shipping: 0, handling: 0 })
      const d = periodMap.get(row.period)!
      const amt = parseFloat(row.amount)
      if (row.category === "Storage Revenue") d.storage += amt
      else if (row.category === "Shipping Revenue") d.shipping += amt
      else if (row.category === "Handling Revenue") d.handling += amt
      allPeriods.add(row.period)
    }

    // Identify existing customers
    const existingCustomers = new Set<string>()
    for (const [customer, periodMap] of customerData) {
      const sep = periodMap.get("2024-09")
      if (sep && (sep.storage + sep.shipping + sep.handling) > 0) {
        existingCustomers.add(customer)
      }
    }

    // Filter by segment
    const filteredCustomers = new Set<string>()
    for (const customer of customerData.keys()) {
      if (segment === "new" && existingCustomers.has(customer)) continue
      if (segment === "existing" && !existingCustomers.has(customer)) continue
      filteredCustomers.add(customer)
    }

    const sortedPeriods = [...allPeriods].sort()

    // Aggregate monthly
    interface RevBucket { storage: number; shipping: number; handling: number; total: number; customerCount: number }
    const monthlyMap = new Map<string, RevBucket>()

    for (const period of sortedPeriods) {
      const bucket: RevBucket = { storage: 0, shipping: 0, handling: 0, total: 0, customerCount: 0 }
      for (const customer of filteredCustomers) {
        const d = customerData.get(customer)!.get(period)
        if (d) {
          const total = d.storage + d.shipping + d.handling
          if (total > 0) {
            bucket.storage += d.storage
            bucket.shipping += d.shipping
            bucket.handling += d.handling
            bucket.total += total
            bucket.customerCount++
          }
        }
      }
      monthlyMap.set(period, bucket)
    }

    // Build monthly response with YoY
    const monthly = sortedPeriods.map((period) => {
      const bucket = monthlyMap.get(period)!
      const [y, m] = period.split("-").map(Number)
      const priorPeriod = `${y - 1}-${String(m).padStart(2, "0")}`
      const prior = monthlyMap.get(priorPeriod)
      const monthName = new Date(y, m - 1).toLocaleString("en-US", { month: "short" })

      return {
        period,
        label: `${monthName} ${String(y).slice(2)}`,
        storage: round2(bucket.storage),
        shipping: round2(bucket.shipping),
        handling: round2(bucket.handling),
        total: round2(bucket.total),
        customerCount: bucket.customerCount,
        yoyStorage: prior ? yoyPct(bucket.storage, prior.storage) : null,
        yoyShipping: prior ? yoyPct(bucket.shipping, prior.shipping) : null,
        yoyHandling: prior ? yoyPct(bucket.handling, prior.handling) : null,
        yoyTotal: prior ? yoyPct(bucket.total, prior.total) : null,
      }
    })

    // Quarterly aggregation
    const quarterMap = new Map<string, { storage: number; shipping: number; handling: number; total: number; customers: Set<string>; monthCount: number }>()
    const quarterLabels = new Map<string, string>()

    for (const period of sortedPeriods) {
      const [y, m] = period.split("-").map(Number)
      const q = Math.ceil(m / 3)
      const qKey = `${y}-Q${q}`
      if (!quarterMap.has(qKey)) {
        quarterMap.set(qKey, { storage: 0, shipping: 0, handling: 0, total: 0, customers: new Set(), monthCount: 0 })
        quarterLabels.set(qKey, `Q${q} ${String(y).slice(2)}`)
      }
      const qBucket = quarterMap.get(qKey)!
      const mBucket = monthlyMap.get(period)!
      qBucket.storage += mBucket.storage
      qBucket.shipping += mBucket.shipping
      qBucket.handling += mBucket.handling
      qBucket.total += mBucket.total
      qBucket.monthCount++

      // Count distinct customers for the quarter
      for (const customer of filteredCustomers) {
        const d = customerData.get(customer)!.get(period)
        if (d && (d.storage + d.shipping + d.handling) > 0) {
          qBucket.customers.add(customer)
        }
      }
    }

    const sortedQuarters = [...quarterMap.keys()].sort()
    const quarterly = sortedQuarters
      .filter((qKey) => quarterMap.get(qKey)!.monthCount === 3)
      .map((qKey) => {
        const bucket = quarterMap.get(qKey)!
        // Prior year quarter
        const [y, qPart] = qKey.split("-Q")
        const priorQKey = `${Number(y) - 1}-Q${qPart}`
        const prior = quarterMap.get(priorQKey)
        const priorComplete = prior && prior.monthCount === 3

        return {
          period: qKey,
          label: quarterLabels.get(qKey)!,
          storage: round2(bucket.storage),
          shipping: round2(bucket.shipping),
          handling: round2(bucket.handling),
          total: round2(bucket.total),
          customerCount: bucket.customers.size,
          yoyStorage: priorComplete ? yoyPct(bucket.storage, prior.storage) : null,
          yoyShipping: priorComplete ? yoyPct(bucket.shipping, prior.shipping) : null,
          yoyHandling: priorComplete ? yoyPct(bucket.handling, prior.handling) : null,
          yoyTotal: priorComplete ? yoyPct(bucket.total, prior.total) : null,
        }
      })

    // Annual aggregation
    const yearMap = new Map<string, { storage: number; shipping: number; handling: number; total: number; customers: Set<string> }>()

    for (const period of sortedPeriods) {
      const year = period.split("-")[0]
      if (!yearMap.has(year)) {
        yearMap.set(year, { storage: 0, shipping: 0, handling: 0, total: 0, customers: new Set() })
      }
      const yBucket = yearMap.get(year)!
      const mBucket = monthlyMap.get(period)!
      yBucket.storage += mBucket.storage
      yBucket.shipping += mBucket.shipping
      yBucket.handling += mBucket.handling
      yBucket.total += mBucket.total

      for (const customer of filteredCustomers) {
        const d = customerData.get(customer)!.get(period)
        if (d && (d.storage + d.shipping + d.handling) > 0) {
          yBucket.customers.add(customer)
        }
      }
    }

    const sortedYears = [...yearMap.keys()].sort()
    const annual = sortedYears.map((year) => {
      const bucket = yearMap.get(year)!
      const priorYear = String(Number(year) - 1)
      const prior = yearMap.get(priorYear)

      return {
        period: year,
        label: year,
        storage: round2(bucket.storage),
        shipping: round2(bucket.shipping),
        handling: round2(bucket.handling),
        total: round2(bucket.total),
        customerCount: bucket.customers.size,
        yoyStorage: prior ? yoyPct(bucket.storage, prior.storage) : null,
        yoyShipping: prior ? yoyPct(bucket.shipping, prior.shipping) : null,
        yoyHandling: prior ? yoyPct(bucket.handling, prior.handling) : null,
        yoyTotal: prior ? yoyPct(bucket.total, prior.total) : null,
      }
    })

    return NextResponse.json({ monthly, quarterly, annual })
  } catch (error) {
    console.error("Revenue metrics error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute revenue metrics" },
      { status: 500 }
    )
  }
}
