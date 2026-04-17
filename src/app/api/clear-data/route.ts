import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export const dynamic = "force-dynamic"

const FINANCIAL_TYPES = ["storage_revenue_by_customer", "shipping_revenue_by_customer", "handling_revenue_by_customer"]

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "DATABASE_URL is not configured" }, { status: 500 })
    }

    const sql = neon(process.env.DATABASE_URL)
    const body = await request.json().catch(() => ({}))
    const reportType = (body as { reportType?: string }).reportType

    if (reportType) {
      if (FINANCIAL_TYPES.includes(reportType)) {
        await sql`DELETE FROM financial_data WHERE report_type = ${reportType}`
      } else if (reportType === "ad_group_performance") {
        await sql`DELETE FROM ad_group_performance`
      } else if (reportType === "ad_campaign_performance") {
        await sql`DELETE FROM ad_campaign_performance`
      } else if (reportType === "leads") {
        await sql`DELETE FROM leads`
      } else if (reportType === "opportunities") {
        await sql`DELETE FROM opportunities`
      } else {
        return NextResponse.json({ error: `Unknown report type: ${reportType}` }, { status: 400 })
      }
      await sql`DELETE FROM uploads WHERE file_type = ${reportType}`
      return NextResponse.json({ success: true, message: `Cleared ${reportType} data` })
    }

    await sql`DELETE FROM financial_data`
    await sql`DELETE FROM leads`
    await sql`DELETE FROM opportunities`
    await sql`DELETE FROM ad_campaign_performance`
    await sql`DELETE FROM ad_group_performance`
    await sql`DELETE FROM uploads`

    return NextResponse.json({ success: true, message: "All data cleared successfully" })
  } catch (error) {
    console.error("Clear data error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear data" },
      { status: 500 }
    )
  }
}
