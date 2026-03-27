import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData } from "@/lib/db/schema"
import { sql, inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const db = getDb()

    // Get total revenue per customer per period (sum all 3 revenue types)
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
      return NextResponse.json({ data: [], periods: [] })
    }

    // Group by period
    const periodMap = new Map<
      string,
      { customer: string; total: number }[]
    >()

    for (const row of rows) {
      const total = parseFloat(row.total)
      if (total <= 0) continue
      if (!periodMap.has(row.period)) periodMap.set(row.period, [])
      periodMap.get(row.period)!.push({ customer: row.accountName, total })
    }

    const sortedPeriods = [...periodMap.keys()].sort()

    const data = sortedPeriods.map((period) => {
      const customers = periodMap.get(period)!
      // Sort by revenue descending
      customers.sort((a, b) => b.total - a.total)

      const totalRevenue = customers.reduce((sum, c) => sum + c.total, 0)

      const top1Revenue = customers.slice(0, 1).reduce((sum, c) => sum + c.total, 0)
      const top3Revenue = customers.slice(0, 3).reduce((sum, c) => sum + c.total, 0)
      const top5Revenue = customers.slice(0, 5).reduce((sum, c) => sum + c.total, 0)

      return {
        period,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        customerCount: customers.length,
        top1: {
          pct: totalRevenue > 0 ? Math.round((top1Revenue / totalRevenue) * 10000) / 100 : 0,
          revenue: Math.round(top1Revenue * 100) / 100,
          name: customers[0]?.customer || "",
        },
        top3: {
          pct: totalRevenue > 0 ? Math.round((top3Revenue / totalRevenue) * 10000) / 100 : 0,
          revenue: Math.round(top3Revenue * 100) / 100,
          names: customers.slice(0, 3).map((c) => c.customer),
        },
        top5: {
          pct: totalRevenue > 0 ? Math.round((top5Revenue / totalRevenue) * 10000) / 100 : 0,
          revenue: Math.round(top5Revenue * 100) / 100,
          names: customers.slice(0, 5).map((c) => c.customer),
        },
      }
    })

    return NextResponse.json({ data, periods: sortedPeriods })
  } catch (error) {
    console.error("Concentration error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute concentration" },
      { status: 500 }
    )
  }
}
