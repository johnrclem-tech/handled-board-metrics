import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData } from "@/lib/db/schema"
import { eq, and, sql, desc, inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get("period")
    const reportType = searchParams.get("reportType")
    const category = searchParams.get("category")
    const customers = searchParams.get("customers")
    const periods = searchParams.get("periods")

    const conditions = []
    if (period) {
      conditions.push(eq(financialData.period, period))
    }
    if (periods) {
      const periodList = periods.split(",").filter(Boolean)
      if (periodList.length > 0) {
        conditions.push(inArray(financialData.period, periodList))
      }
    }
    if (reportType) {
      conditions.push(eq(financialData.reportType, reportType))
    }
    if (category) {
      const categoryList = category.split(",").filter(Boolean)
      if (categoryList.length > 0) {
        conditions.push(inArray(financialData.category, categoryList))
      }
    }
    if (customers) {
      const customerList = customers.split(",").filter(Boolean)
      if (customerList.length > 0) {
        conditions.push(inArray(financialData.accountName, customerList))
      }
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
    const allPeriods = await db
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
      periods: allPeriods.map((p) => p.period),
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
