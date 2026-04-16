import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData } from "@/lib/db/schema"
import { sql } from "drizzle-orm"

export const dynamic = "force-dynamic"

const SERVICE_CATEGORIES = ["Storage Revenue", "Shipping Revenue", "Handling Revenue"]

export async function GET() {
  try {
    const db = getDb()

    // For each service category, compute total revenue and count of
    // customer-months (distinct customer × period pairs) where that category
    // had revenue > 0. This gives the per-customer average monthly revenue.
    const rows = await db
      .select({
        category: financialData.category,
        totalRevenue: sql<string>`sum(${financialData.amount})`,
        customerMonths: sql<number>`count(distinct ${financialData.accountName} || '|' || ${financialData.period})`,
      })
      .from(financialData)
      .where(
        sql`${financialData.category} in ${SERVICE_CATEGORIES} and cast(${financialData.amount} as numeric) > 0`,
      )
      .groupBy(financialData.category)

    const byCategory: Record<string, { totalRevenue: number; customerMonths: number }> = {}
    for (const r of rows) {
      byCategory[r.category] = {
        totalRevenue: parseFloat(r.totalRevenue) || 0,
        customerMonths: Number(r.customerMonths) || 0,
      }
    }

    return NextResponse.json({
      storage: byCategory["Storage Revenue"] || { totalRevenue: 0, customerMonths: 0 },
      shipping: byCategory["Shipping Revenue"] || { totalRevenue: 0, customerMonths: 0 },
      handling: byCategory["Handling Revenue"] || { totalRevenue: 0, customerMonths: 0 },
    })
  } catch (error) {
    console.error("LTV API error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute LTV" },
      { status: 500 },
    )
  }
}
