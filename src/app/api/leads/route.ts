import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { leads, opportunities } from "@/lib/db/schema"

export async function GET() {
  try {
    const db = getDb()

    const allLeads = await db.select().from(leads)
    const allOpps = await db.select().from(opportunities)

    // Return raw rows — aggregation happens client-side based on period type
    const leadRows = allLeads.map((l) => ({
      id: l.id,
      company: l.company,
      fullName: l.fullName,
      leadSource: l.leadSource || "Unknown",
      adCampaignName: l.adCampaignName,
      ad: l.ad,
      leadStatus: l.leadStatus,
      createdTime: l.createdTime ? new Date(l.createdTime).toISOString() : null,
    }))

    const oppRows = allOpps.map((o) => ({
      id: o.id,
      opportunityName: o.opportunityName,
      leadSource: o.leadSource || "Unknown",
      leadSourceDetail: o.leadSourceDetail,
      stage: o.stage,
      closingDate: o.closingDate,
      createdTime: o.createdTime ? new Date(o.createdTime).toISOString() : null,
      ad: o.ad,
    }))

    return NextResponse.json({ leads: leadRows, opportunities: oppRows })
  } catch (error) {
    console.error("Leads API error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch leads" },
      { status: 500 }
    )
  }
}
