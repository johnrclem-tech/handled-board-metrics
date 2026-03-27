import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData } from "@/lib/db/schema"
import { sql, inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"

const CATEGORIES = ["Storage Revenue", "Shipping Revenue", "Handling Revenue"] as const

function allPeriodsBetween(start: string, end: string): string[] {
  const periods: string[] = []
  let [y, m] = start.split("-").map(Number)
  const [ey, em] = end.split("-").map(Number)
  while (y < ey || (y === ey && m <= em)) {
    periods.push(`${y}-${String(m).padStart(2, "0")}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return periods
}

interface MonthData {
  storage: number
  shipping: number
  handling: number
}

export async function GET(request: NextRequest) {
  try {
    const billingMonth = parseInt(request.nextUrl.searchParams.get("month") || "18")
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
      .orderBy(financialData.accountName, financialData.period)

    // Build per-customer map
    const customerMap = new Map<string, Map<string, MonthData>>()
    let globalLatestPeriod = ""

    for (const row of rows) {
      if (!customerMap.has(row.accountName)) customerMap.set(row.accountName, new Map())
      const periodMap = customerMap.get(row.accountName)!
      if (!periodMap.has(row.period)) periodMap.set(row.period, { storage: 0, shipping: 0, handling: 0 })
      const data = periodMap.get(row.period)!
      const amt = parseFloat(row.amount)
      if (row.category === "Storage Revenue") data.storage += amt
      else if (row.category === "Shipping Revenue") data.shipping += amt
      else if (row.category === "Handling Revenue") data.handling += amt
      if (row.period > globalLatestPeriod) globalLatestPeriod = row.period
    }

    // Exclude pre-existing customers (Sep 2024)
    const excluded: string[] = []
    for (const [customer, periodMap] of customerMap) {
      const sep = periodMap.get("2024-09")
      if (sep && (sep.storage + sep.shipping + sep.handling) > 0) {
        excluded.push(customer)
      }
    }
    for (const c of excluded) customerMap.delete(c)

    // Find first billing month per customer
    const customerFirstMonth = new Map<string, string>()
    for (const [customer, periodMap] of customerMap) {
      const sorted = [...periodMap.keys()].sort()
      for (const period of sorted) {
        const d = periodMap.get(period)!
        if (d.storage + d.shipping + d.handling > 0) {
          customerFirstMonth.set(customer, period)
          break
        }
      }
    }

    // Find which customers contribute to the requested billing month
    const contributors: {
      customer: string
      firstBillingMonth: string
      calendarMonth: string
      storage: number
      shipping: number
      handling: number
      total: number
    }[] = []

    for (const [customer, firstMonth] of customerFirstMonth) {
      const periods = allPeriodsBetween(firstMonth, globalLatestPeriod)
      if (periods.length < billingMonth) continue // doesn't reach this billing month

      const calendarMonth = periods[billingMonth - 1]
      const periodMap = customerMap.get(customer)!
      const data = periodMap.get(calendarMonth) || { storage: 0, shipping: 0, handling: 0 }

      contributors.push({
        customer,
        firstBillingMonth: firstMonth,
        calendarMonth,
        storage: data.storage,
        shipping: data.shipping,
        handling: data.handling,
        total: data.storage + data.shipping + data.handling,
      })
    }

    contributors.sort((a, b) => a.customer.localeCompare(b.customer))

    const storageSum = contributors.reduce((s, c) => s + c.storage, 0)
    const shippingSum = contributors.reduce((s, c) => s + c.shipping, 0)
    const handlingSum = contributors.reduce((s, c) => s + c.handling, 0)
    const totalSum = contributors.reduce((s, c) => s + c.total, 0)
    const count = contributors.length

    return NextResponse.json({
      billingMonth,
      globalLatestPeriod,
      customerCount: count,
      averages: {
        storage: count > 0 ? Math.round((storageSum / count) * 100) / 100 : 0,
        shipping: count > 0 ? Math.round((shippingSum / count) * 100) / 100 : 0,
        handling: count > 0 ? Math.round((handlingSum / count) * 100) / 100 : 0,
        total: count > 0 ? Math.round((totalSum / count) * 100) / 100 : 0,
      },
      sums: { storage: storageSum, shipping: shippingSum, handling: handlingSum, total: totalSum },
      customers: contributors,
    })
  } catch (error) {
    console.error("Cohort detail error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    )
  }
}
