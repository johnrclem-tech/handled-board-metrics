import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData } from "@/lib/db/schema"
import { sql, inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"

const CATEGORIES = ["Storage Revenue", "Shipping Revenue", "Handling Revenue"] as const

function monthOffset(basePeriod: string, targetPeriod: string): number {
  const [baseY, baseM] = basePeriod.split("-").map(Number)
  const [targetY, targetM] = targetPeriod.split("-").map(Number)
  return (targetY - baseY) * 12 + (targetM - baseM)
}

function allPeriodsBetween(start: string, end: string): string[] {
  const periods: string[] = []
  let [y, m] = start.split("-").map(Number)
  const [ey, em] = end.split("-").map(Number)
  while (y < ey || (y === ey && m <= em)) {
    periods.push(`${y}-${String(m).padStart(2, "0")}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return periods
}

interface MonthData {
  storage: number
  shipping: number
  handling: number
}

export async function GET() {
  try {
    const db = getDb()

    // Query all revenue data grouped by customer, period, category
    const rows = await db
      .select({
        accountName: financialData.accountName,
        period: financialData.period,
        category: financialData.category,
        amount: sql<string>`SUM(${financialData.amount}::numeric)`,
      })
      .from(financialData)
      .where(inArray(financialData.category, [...CATEGORIES]))
      .groupBy(
        financialData.accountName,
        financialData.period,
        financialData.category
      )
      .orderBy(financialData.accountName, financialData.period)

    if (rows.length === 0) {
      return NextResponse.json({
        cohortData: { storage: [], shipping: [], handling: [], total: [] },
        metadata: {
          totalCustomers: 0,
          excludedCustomers: 0,
          earliestPeriod: null,
          latestPeriod: null,
          maxBillingMonths: 0,
        },
      })
    }

    // Build per-customer, per-period map
    const customerMap = new Map<string, Map<string, MonthData>>()
    let globalLatestPeriod = ""
    let globalEarliestPeriod = "9999-99"

    for (const row of rows) {
      const { accountName, period, category, amount } = row
      const amt = parseFloat(amount)

      if (!customerMap.has(accountName)) {
        customerMap.set(accountName, new Map())
      }
      const periodMap = customerMap.get(accountName)!

      if (!periodMap.has(period)) {
        periodMap.set(period, { storage: 0, shipping: 0, handling: 0 })
      }
      const data = periodMap.get(period)!

      if (category === "Storage Revenue") data.storage += amt
      else if (category === "Shipping Revenue") data.shipping += amt
      else if (category === "Handling Revenue") data.handling += amt

      if (period > globalLatestPeriod) globalLatestPeriod = period
      if (period < globalEarliestPeriod) globalEarliestPeriod = period
    }

    // Exclude pre-existing customers (any revenue > 0 in September 2024)
    const excludedCustomers = new Set<string>()
    for (const [customer, periodMap] of customerMap) {
      const sep2024 = periodMap.get("2024-09")
      if (sep2024) {
        const total = sep2024.storage + sep2024.shipping + sep2024.handling
        if (total > 0) {
          excludedCustomers.add(customer)
        }
      }
    }

    for (const customer of excludedCustomers) {
      customerMap.delete(customer)
    }

    // Find first billing month per customer and build cohort data
    const customerFirstMonth = new Map<string, string>()
    for (const [customer, periodMap] of customerMap) {
      const sortedPeriods = [...periodMap.keys()].sort()
      for (const period of sortedPeriods) {
        const data = periodMap.get(period)!
        const total = data.storage + data.shipping + data.handling
        if (total > 0) {
          customerFirstMonth.set(customer, period)
          break
        }
      }
    }

    // Accumulate averages per billing month offset
    const storageSums = new Map<number, { sum: number; count: number }>()
    const shippingSums = new Map<number, { sum: number; count: number }>()
    const handlingSums = new Map<number, { sum: number; count: number }>()
    const totalSums = new Map<number, { sum: number; count: number }>()

    for (const [customer, firstMonth] of customerFirstMonth) {
      const periodMap = customerMap.get(customer)!
      // Generate all periods from first billing month to global latest
      const periods = allPeriodsBetween(firstMonth, globalLatestPeriod)

      for (let i = 0; i < periods.length; i++) {
        const billingMonth = i + 1 // 1-based
        const period = periods[i]
        const data = periodMap.get(period) || { storage: 0, shipping: 0, handling: 0 }
        const total = data.storage + data.shipping + data.handling

        // Storage
        if (!storageSums.has(billingMonth)) storageSums.set(billingMonth, { sum: 0, count: 0 })
        const s = storageSums.get(billingMonth)!
        s.sum += data.storage
        s.count += 1

        // Shipping
        if (!shippingSums.has(billingMonth)) shippingSums.set(billingMonth, { sum: 0, count: 0 })
        const sh = shippingSums.get(billingMonth)!
        sh.sum += data.shipping
        sh.count += 1

        // Handling
        if (!handlingSums.has(billingMonth)) handlingSums.set(billingMonth, { sum: 0, count: 0 })
        const h = handlingSums.get(billingMonth)!
        h.sum += data.handling
        h.count += 1

        // Total
        if (!totalSums.has(billingMonth)) totalSums.set(billingMonth, { sum: 0, count: 0 })
        const t = totalSums.get(billingMonth)!
        t.sum += total
        t.count += 1
      }
    }

    // Convert to arrays
    const toArray = (sums: Map<number, { sum: number; count: number }>) => {
      return [...sums.entries()]
        .sort(([a], [b]) => a - b)
        .map(([month, { sum, count }]) => ({
          month,
          average: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
          customerCount: count,
        }))
    }

    // Count new customers per calendar month
    const newCustomersByMonth = new Map<string, number>()
    for (const [, firstMonth] of customerFirstMonth) {
      newCustomersByMonth.set(firstMonth, (newCustomersByMonth.get(firstMonth) || 0) + 1)
    }
    const newCustomers = [...newCustomersByMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, count]) => ({ period, count }))

    return NextResponse.json({
      cohortData: {
        storage: toArray(storageSums),
        shipping: toArray(shippingSums),
        handling: toArray(handlingSums),
        total: toArray(totalSums),
      },
      newCustomers,
      metadata: {
        totalCustomers: customerFirstMonth.size,
        excludedCustomers: excludedCustomers.size,
        earliestPeriod: globalEarliestPeriod,
        latestPeriod: globalLatestPeriod,
        maxBillingMonths: Math.max(...[...storageSums.keys()], 0),
      },
    })
  } catch (error) {
    console.error("Cohort revenue error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute cohort revenue" },
      { status: 500 }
    )
  }
}
