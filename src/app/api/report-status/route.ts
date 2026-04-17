import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export const dynamic = "force-dynamic"

interface ReportStatus {
  reportType: string
  recordCount: number
  lastUpload: string | null
  latestDate: string | null
}

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 })
    }

    const sql = neon(process.env.DATABASE_URL)
    const results: ReportStatus[] = []

    for (const rt of ["storage_revenue_by_customer", "shipping_revenue_by_customer", "handling_revenue_by_customer"]) {
      const [countRow] = await sql`SELECT COUNT(*)::int AS count, MAX(period) AS latest_date FROM financial_data WHERE report_type = ${rt}`
      const [uploadRow] = await sql`SELECT MAX(uploaded_at) AS last_upload FROM uploads WHERE file_type = ${rt}`
      results.push({
        reportType: rt,
        recordCount: countRow.count || 0,
        latestDate: countRow.latest_date,
        lastUpload: uploadRow.last_upload,
      })
    }

    const [agCount] = await sql`SELECT COUNT(*)::int AS count, MAX(date)::text AS latest_date FROM ad_group_performance`
    const [agUpload] = await sql`SELECT MAX(uploaded_at) AS last_upload FROM uploads WHERE file_type = 'ad_group_performance'`
    results.push({ reportType: "ad_group_performance", recordCount: agCount.count || 0, latestDate: agCount.latest_date, lastUpload: agUpload.last_upload })

    const [acCount] = await sql`SELECT COUNT(*)::int AS count, MAX(date)::text AS latest_date FROM ad_campaign_performance`
    const [acUpload] = await sql`SELECT MAX(uploaded_at) AS last_upload FROM uploads WHERE file_type = 'ad_campaign_performance'`
    results.push({ reportType: "ad_campaign_performance", recordCount: acCount.count || 0, latestDate: acCount.latest_date, lastUpload: acUpload.last_upload })

    const [leadsCount] = await sql`SELECT COUNT(*)::int AS count, MAX(created_time)::text AS latest_date FROM leads`
    const [leadsUpload] = await sql`SELECT MAX(uploaded_at) AS last_upload FROM uploads WHERE file_type = 'leads'`
    results.push({ reportType: "leads", recordCount: leadsCount.count || 0, latestDate: leadsCount.latest_date, lastUpload: leadsUpload.last_upload })

    const [oppsCount] = await sql`SELECT COUNT(*)::int AS count, MAX(closing_date)::text AS latest_date FROM opportunities`
    const [oppsUpload] = await sql`SELECT MAX(uploaded_at) AS last_upload FROM uploads WHERE file_type = 'opportunities'`
    results.push({ reportType: "opportunities", recordCount: oppsCount.count || 0, latestDate: oppsCount.latest_date, lastUpload: oppsUpload.last_upload })

    return NextResponse.json({ reports: results })
  } catch (err) {
    console.error("Failed to fetch report status:", err)
    return NextResponse.json({ error: "Failed to fetch report status" }, { status: 500 })
  }
}
