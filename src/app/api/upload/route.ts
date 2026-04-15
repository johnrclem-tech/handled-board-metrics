import { NextRequest, NextResponse } from "next/server"
import { parseExcelFile, parseCrmFile, parseAdCampaignFile, parseAdGroupFile } from "@/lib/excel-parser"
import { getDb } from "@/lib/db"
import { financialData, leads, opportunities, uploads } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

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

    // ── Ad Group Performance (one row per Day × Campaign × Ad Group) ──
    if (reportType === "ad_group_performance") {
      const parsed = parseAdGroupFile(buffer)

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
        const mapped = parsed.rows.map((row) => ({
          date: row.date,
          campaign: row.campaign,
          campaignType: row.campaignType,
          adGroup: row.adGroup,
          currency: row.currency,
          cost: row.cost,
          clicks: row.clicks != null ? Math.round(row.clicks) : null,
          impressions: row.impressions != null ? Math.round(row.impressions) : null,
          conversions: row.conversions,
          ctr: row.ctr,
          avgCpc: row.avgCpc,
          conversionRate: row.conversionRate,
          costPerConversion: row.costPerConversion,
          searchLostIsRank: row.searchLostIsRank,
          searchImprShare: row.searchImprShare,
          uploadId: upload.id,
        }))

        const dedupedMap = new Map<string, (typeof mapped)[number]>()
        for (const v of mapped) {
          const key = `${v.date ?? ""}|${v.campaign ?? ""}|${v.adGroup ?? ""}`
          dedupedMap.set(key, v)
        }
        const values = Array.from(dedupedMap.values())
        const payload = JSON.stringify(values)
        console.log(
          `[upload] ad_group_performance: ${parsed.rows.length} parsed rows, ${values.length} after dedupe, payload ${payload.length} bytes`
        )

        await db.execute(sql`
          DELETE FROM ad_group_performance
          WHERE EXISTS (
            SELECT 1
            FROM jsonb_to_recordset(${payload}::jsonb) AS t(
              "date" date,
              "campaign" text,
              "adGroup" text
            )
            WHERE ad_group_performance.date IS NOT DISTINCT FROM t."date"
              AND ad_group_performance.campaign IS NOT DISTINCT FROM t."campaign"
              AND ad_group_performance.ad_group IS NOT DISTINCT FROM t."adGroup"
          )
        `)

        await db.execute(sql`
          INSERT INTO ad_group_performance (
            date, campaign, campaign_type, ad_group, currency, cost, clicks,
            impressions, conversions, ctr, avg_cpc, conversion_rate,
            cost_per_conversion, search_lost_is_rank, search_impr_share, upload_id
          )
          SELECT
            "date", "campaign", "campaignType", "adGroup", "currency", "cost", "clicks",
            "impressions", "conversions", "ctr", "avgCpc", "conversionRate",
            "costPerConversion", "searchLostIsRank", "searchImprShare", "uploadId"
          FROM jsonb_to_recordset(${payload}::jsonb) AS t(
            "date" date,
            "campaign" text,
            "campaignType" text,
            "adGroup" text,
            "currency" text,
            "cost" numeric,
            "clicks" integer,
            "impressions" integer,
            "conversions" numeric,
            "ctr" numeric,
            "avgCpc" numeric,
            "conversionRate" numeric,
            "costPerConversion" numeric,
            "searchLostIsRank" numeric,
            "searchImprShare" numeric,
            "uploadId" integer
          )
        `)
      }

      return NextResponse.json({ success: true, upload, rowCount: parsed.rows.length })
    }

    // ── Ad Campaign Performance (one row per Day × Campaign) ──
    if (reportType === "ad_campaign_performance") {
      const parsed = parseAdCampaignFile(buffer)

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
        const mapped = parsed.rows.map((row) => ({
          date: row.date,
          campaign: row.campaign,
          campaignType: row.campaignType,
          currency: row.currency,
          cost: row.cost,
          clicks: row.clicks != null ? Math.round(row.clicks) : null,
          impressions: row.impressions != null ? Math.round(row.impressions) : null,
          conversions: row.conversions,
          ctr: row.ctr,
          avgCpc: row.avgCpc,
          conversionRate: row.conversionRate,
          costPerConversion: row.costPerConversion,
          searchLostIsBudget: row.searchLostIsBudget,
          searchLostIsRank: row.searchLostIsRank,
          searchImprShare: row.searchImprShare,
          uploadId: upload.id,
        }))

        const dedupedMap = new Map<string, (typeof mapped)[number]>()
        for (const v of mapped) {
          const key = `${v.date ?? ""}|${v.campaign ?? ""}`
          dedupedMap.set(key, v)
        }
        const values = Array.from(dedupedMap.values())
        const payload = JSON.stringify(values)
        console.log(
          `[upload] ad_campaign_performance: ${parsed.rows.length} parsed rows, ${values.length} after dedupe, payload ${payload.length} bytes`
        )

        await db.execute(sql`
          DELETE FROM ad_campaign_performance
          WHERE EXISTS (
            SELECT 1
            FROM jsonb_to_recordset(${payload}::jsonb) AS t(
              "date" date,
              "campaign" text
            )
            WHERE ad_campaign_performance.date IS NOT DISTINCT FROM t."date"
              AND ad_campaign_performance.campaign IS NOT DISTINCT FROM t."campaign"
          )
        `)

        await db.execute(sql`
          INSERT INTO ad_campaign_performance (
            date, campaign, campaign_type, currency, cost, clicks,
            impressions, conversions, ctr, avg_cpc, conversion_rate,
            cost_per_conversion, search_lost_is_budget, search_lost_is_rank,
            search_impr_share, upload_id
          )
          SELECT
            "date", "campaign", "campaignType", "currency", "cost", "clicks",
            "impressions", "conversions", "ctr", "avgCpc", "conversionRate",
            "costPerConversion", "searchLostIsBudget", "searchLostIsRank",
            "searchImprShare", "uploadId"
          FROM jsonb_to_recordset(${payload}::jsonb) AS t(
            "date" date,
            "campaign" text,
            "campaignType" text,
            "currency" text,
            "cost" numeric,
            "clicks" integer,
            "impressions" integer,
            "conversions" numeric,
            "ctr" numeric,
            "avgCpc" numeric,
            "conversionRate" numeric,
            "costPerConversion" numeric,
            "searchLostIsBudget" numeric,
            "searchLostIsRank" numeric,
            "searchImprShare" numeric,
            "uploadId" integer
          )
        `)
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
