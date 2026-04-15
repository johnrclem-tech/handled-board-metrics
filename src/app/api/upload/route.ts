import { NextRequest, NextResponse } from "next/server"
import { parseExcelFile, parseCrmFile, parseAdCampaignFile } from "@/lib/excel-parser"
import { getDb } from "@/lib/db"
import { financialData, leads, opportunities, adCampaignPerformance, uploads } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const CRM_TYPES = ["leads", "opportunities"]

const CHUNK_SIZE = 100

async function insertInChunks<T>(
  label: string,
  rows: T[],
  runInsert: (chunk: T[]) => Promise<unknown>
) {
  const chunkCount = Math.ceil(rows.length / CHUNK_SIZE)
  console.log(
    `[upload] inserting ${rows.length} ${label} rows in ${chunkCount} chunk(s) of up to ${CHUNK_SIZE}`
  )
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1
    console.log(
      `[upload] ${label} chunk ${chunkIndex}/${chunkCount}: ${chunk.length} rows`
    )
    await runInsert(chunk)
  }
}

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

    // ── Ad Campaign Performance ──
    if (reportType === "ad_campaign_performance") {
      const parsed = parseAdCampaignFile(buffer)
      await db.delete(adCampaignPerformance)

      const [upload] = await db
        .insert(uploads)
        .values({
          fileName: file.name,
          fileType: reportType,
          recordCount: parsed.rows.length,
          status: "processed",
          metadata: { recordCount: parsed.rows.length },
        })
        .returning()

      if (parsed.rows.length > 0) {
        const values = parsed.rows.map((row) => ({
          date: row.date,
          campaign: row.campaign,
          campaignType: row.campaignType,
          currency: row.currency,
          cost: row.cost != null ? String(row.cost) : null,
          clicks: row.clicks != null ? Math.round(row.clicks) : null,
          impressions: row.impressions != null ? Math.round(row.impressions) : null,
          conversions: row.conversions != null ? String(row.conversions) : null,
          ctr: row.ctr != null ? String(row.ctr) : null,
          avgCpc: row.avgCpc != null ? String(row.avgCpc) : null,
          conversionRate: row.conversionRate != null ? String(row.conversionRate) : null,
          costPerConversion: row.costPerConversion != null ? String(row.costPerConversion) : null,
          uploadId: upload.id,
        }))
        await insertInChunks("ad_campaign_performance", values, (chunk) =>
          db.insert(adCampaignPerformance).values(chunk)
        )
      }

      return NextResponse.json({ success: true, upload, rowCount: parsed.rows.length })
    }

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
        const values = parsed.leads.map((row) => ({
          company: row.company,
          leadSource: row.leadSource,
          adCampaignName: row.adCampaignName,
          ad: row.ad,
          fullName: row.fullName,
          leadStatus: row.leadStatus,
          createdTime: row.createdTime,
          uploadId: upload.id,
        }))
        await insertInChunks("leads", values, (chunk) =>
          db.insert(leads).values(chunk)
        )
      }

      if (reportType === "opportunities" && parsed.opportunities && parsed.opportunities.length > 0) {
        const values = parsed.opportunities.map((row) => ({
          closingDate: row.closingDate,
          opportunityName: row.opportunityName,
          leadSource: row.leadSource,
          leadSourceDetail: row.leadSourceDetail,
          createdTime: row.createdTime,
          stage: row.stage,
          ad: row.ad,
          uploadId: upload.id,
        }))
        await insertInChunks("opportunities", values, (chunk) =>
          db.insert(opportunities).values(chunk)
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

    // Delete all existing data for this report type so re-uploads fully overwrite
    await db
      .delete(financialData)
      .where(eq(financialData.reportType, reportType))

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
      const values = parsed.rows.map((row) => ({
        reportType: parsed.reportType,
        period: row.period,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        category: row.category,
        subcategory: row.subcategory,
        accountName: row.accountName,
        amount: String(row.amount),
      }))
      await insertInChunks("financial_data", values, (chunk) =>
        db.insert(financialData).values(chunk)
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
