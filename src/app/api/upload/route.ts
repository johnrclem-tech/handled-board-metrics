import { NextRequest, NextResponse } from "next/server"
import { parseExcelFile, parseCrmFile } from "@/lib/excel-parser"
import { getDb } from "@/lib/db"
import { financialData, leads, opportunities, uploads } from "@/lib/db/schema"
import { and, eq, inArray } from "drizzle-orm"

const CRM_TYPES = ["leads", "opportunities"]

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const reportType = formData.get("reportType") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!reportType) {
      return NextResponse.json({ error: "Report type is required" }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const db = getDb()

    // ── CRM uploads (leads / opportunities) ──
    if (CRM_TYPES.includes(reportType)) {
      const parsed = parseCrmFile(buffer, reportType)

      // Clear previous data for this type (both new table and any stale financial_data rows)
      if (reportType === "leads") {
        await db.delete(leads)
      } else {
        await db.delete(opportunities)
      }
      // Clean up any mangled rows from the old parser
      await db.delete(financialData).where(eq(financialData.reportType, reportType))

      // Insert upload record
      const [upload] = await db
        .insert(uploads)
        .values({
          fileName: file.name,
          fileType: reportType,
          recordCount: parsed.rowCount,
          status: "processed",
          metadata: { recordCount: parsed.rowCount },
        })
        .returning()

      // Insert rows
      if (reportType === "leads" && parsed.leads && parsed.leads.length > 0) {
        await db.insert(leads).values(
          parsed.leads.map((row) => ({
            company: row.company,
            leadSource: row.leadSource,
            adCampaignName: row.adCampaignName,
            ad: row.ad,
            fullName: row.fullName,
            leadStatus: row.leadStatus,
            createdTime: row.createdTime,
            uploadId: upload.id,
          }))
        )
      }

      if (reportType === "opportunities" && parsed.opportunities && parsed.opportunities.length > 0) {
        await db.insert(opportunities).values(
          parsed.opportunities.map((row) => ({
            closingDate: row.closingDate,
            opportunityName: row.opportunityName,
            leadSource: row.leadSource,
            leadSourceDetail: row.leadSourceDetail,
            createdTime: row.createdTime,
            stage: row.stage,
            ad: row.ad,
            uploadId: upload.id,
          }))
        )
      }

      return NextResponse.json({
        success: true,
        upload,
        rowCount: parsed.rowCount,
      })
    }

    // ── Financial uploads (revenue, P&L, etc.) ──
    const parsed = parseExcelFile(buffer, reportType)

    const uniquePeriods = [...new Set(parsed.rows.map((r) => r.period))].sort()
    const uniqueCategories = [...new Set(parsed.rows.map((r) => r.category))]

    if (uniquePeriods.length > 0 && uniqueCategories.length > 0) {
      await db
        .delete(financialData)
        .where(
          and(
            inArray(financialData.category, uniqueCategories),
            inArray(financialData.period, uniquePeriods)
          )
        )
    }

    const [upload] = await db
      .insert(uploads)
      .values({
        fileName: file.name,
        fileType: reportType,
        recordCount: parsed.rows.length,
        status: "processed",
        metadata: { periods: uniquePeriods },
      })
      .returning()

    if (parsed.rows.length > 0) {
      await db.insert(financialData).values(
        parsed.rows.map((row) => ({
          reportType: parsed.reportType,
          period: row.period,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          category: row.category,
          subcategory: row.subcategory,
          accountName: row.accountName,
          amount: String(row.amount),
        }))
      )
    }

    return NextResponse.json({
      success: true,
      upload,
      rowCount: parsed.rows.length,
      periods: uniquePeriods,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    )
  }
}
