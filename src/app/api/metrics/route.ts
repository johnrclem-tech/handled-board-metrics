import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData } from "@/lib/db/schema"
import { eq, and, sql, desc } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get("period")
    const reportType = searchParams.get("reportType")

    let conditions = []
    if (period) {
      conditions.push(eq(financialData.period, period))
    }
    if (reportType) {
      conditions.push(eq(financialData.reportType, reportType))
    }

    const db = getDb()

    // Get summary by category
    const summary = await db
      .select({
        category: financialData.category,
        period: financialData.period,
        total: sql<string>`SUM(${financialData.amount}::numeric)`,
      })
      .from(financialData)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(financialData.category, financialData.period)
      .orderBy(financialData.period)

    // Get all available periods
    const periods = await db
      .selectDistinct({ period: financialData.period })
      .from(financialData)
      .orderBy(desc(financialData.period))

    // Get detailed data
    const details = await db
      .select()
      .from(financialData)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(financialData.category, financialData.accountName)

    return NextResponse.json({
      summary,
      periods: periods.map((p) => p.period),
      details,
    })
  } catch (error) {
    console.error("Metrics error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch metrics" },
      { status: 500 }
    )
  }
}
