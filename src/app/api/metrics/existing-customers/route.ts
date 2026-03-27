import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData } from "@/lib/db/schema"
import { sql, inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"

const CATEGORIES = ["Storage Revenue", "Shipping Revenue", "Handling Revenue"] as const

export async function GET() {
  try {
    const db = getDb()

    // Get all revenue rows
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
      return NextResponse.json({ months: [], customers: [] })
    }

    // Find customers with revenue > 0 in Sep 2024
    const sep2024Totals = new Map<string, number>()
    for (const row of rows) {
      if (row.period === "2024-09") {
        sep2024Totals.set(
          row.accountName,
          (sep2024Totals.get(row.accountName) || 0) + parseFloat(row.amount)
        )
      }
    }

    const existingCustomers = new Set<string>()
    for (const [customer, total] of sep2024Totals) {
      if (total > 0) existingCustomers.add(customer)
    }

    // Filter to only existing customers and aggregate by period + category
    const monthMap = new Map<string, { storage: number; shipping: number; handling: number }>()

    for (const row of rows) {
      if (!existingCustomers.has(row.accountName)) continue

      if (!monthMap.has(row.period)) {
        monthMap.set(row.period, { storage: 0, shipping: 0, handling: 0 })
      }
      const data = monthMap.get(row.period)!
      const amt = parseFloat(row.amount)

      if (row.category === "Storage Revenue") data.storage += amt
      else if (row.category === "Shipping Revenue") data.shipping += amt
      else if (row.category === "Handling Revenue") data.handling += amt
    }

    const months = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => ({
        period,
        storage: Math.round(data.storage * 100) / 100,
        shipping: Math.round(data.shipping * 100) / 100,
        handling: Math.round(data.handling * 100) / 100,
        total: Math.round((data.storage + data.shipping + data.handling) * 100) / 100,
      }))

    return NextResponse.json({
      months,
      customerCount: existingCustomers.size,
      customers: [...existingCustomers].sort(),
    })
  } catch (error) {
    console.error("Existing customers error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch data" },
      { status: 500 }
    )
  }
}
