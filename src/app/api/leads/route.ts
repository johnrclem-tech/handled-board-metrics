import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { leads, opportunities } from "@/lib/db/schema"
import { sql } from "drizzle-orm"

export async function GET() {
  try {
    const db = getDb()

    // Fetch all leads
    const allLeads = await db.select().from(leads)

    // Fetch all opportunities (for totals and conversion)
    const allOpps = await db.select().from(opportunities)

    const totalLeads = allLeads.length + allOpps.length
    const totalOpportunities = allOpps.length
    const conversionRate = totalLeads > 0 ? (totalOpportunities / totalLeads) * 100 : 0

    // Current and prior month counts (leads + opportunities combined)
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const priorDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const priorMonth = `${priorDate.getFullYear()}-${String(priorDate.getMonth() + 1).padStart(2, "0")}`

    const getMonth = (d: Date | string | null): string | null => {
      if (!d) return null
      const date = typeof d === "string" ? new Date(d) : d
      if (isNaN(date.getTime())) return null
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    }

    let currentMonthLeads = 0
    let priorMonthLeads = 0

    for (const l of allLeads) {
      const m = getMonth(l.createdTime)
      if (m === currentMonth) currentMonthLeads++
      else if (m === priorMonth) priorMonthLeads++
    }
    for (const o of allOpps) {
      const m = getMonth(o.createdTime)
      if (m === currentMonth) currentMonthLeads++
      else if (m === priorMonth) priorMonthLeads++
    }

    // By source (combined leads + opportunities)
    const sourceMap = new Map<string, number>()
    for (const l of allLeads) {
      const src = l.leadSource || "Unknown"
      sourceMap.set(src, (sourceMap.get(src) || 0) + 1)
    }
    for (const o of allOpps) {
      const src = o.leadSource || "Unknown"
      sourceMap.set(src, (sourceMap.get(src) || 0) + 1)
    }
    const bySource = Array.from(sourceMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)

    const topSource = bySource.length > 0 ? bySource[0] : null

    // By month (combined, with per-source breakdown)
    const monthSourceMap = new Map<string, Map<string, number>>()

    const addToMonthSource = (createdTime: Date | string | null, source: string | null) => {
      const m = getMonth(createdTime)
      if (!m) return
      if (!monthSourceMap.has(m)) monthSourceMap.set(m, new Map())
      const sources = monthSourceMap.get(m)!
      const src = source || "Unknown"
      sources.set(src, (sources.get(src) || 0) + 1)
    }

    for (const l of allLeads) addToMonthSource(l.createdTime, l.leadSource)
    for (const o of allOpps) addToMonthSource(o.createdTime, o.leadSource)

    // Get all unique sources for consistent chart keys
    const allSources = [...new Set([...sourceMap.keys()])]

    const byMonth = Array.from(monthSourceMap.entries())
      .map(([month, sources]) => {
        const total = Array.from(sources.values()).reduce((a, b) => a + b, 0)
        const entry: Record<string, unknown> = { month, total }
        for (const src of allSources) {
          entry[src] = sources.get(src) || 0
        }
        return entry
      })
      .sort((a, b) => (a.month as string).localeCompare(b.month as string))

    // Lead rows for the table
    const leadRows = allLeads.map((l) => ({
      id: l.id,
      company: l.company,
      fullName: l.fullName,
      leadSource: l.leadSource,
      adCampaignName: l.adCampaignName,
      ad: l.ad,
      leadStatus: l.leadStatus,
      createdTime: l.createdTime,
    }))

    return NextResponse.json({
      summary: {
        totalLeads,
        totalOpportunities,
        currentMonthLeads,
        priorMonthLeads,
        conversionRate,
        topSource,
      },
      bySource,
      byMonth,
      allSources,
      leads: leadRows,
    })
  } catch (error) {
    console.error("Leads API error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch leads" },
      { status: 500 }
    )
  }
}
