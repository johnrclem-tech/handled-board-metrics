import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { financialData } from "@/lib/db/schema"
import { sql, inArray } from "drizzle-orm"

export const dynamic = "force-dynamic"

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function GET(request: NextRequest) {
  try {
    const period = request.nextUrl.searchParams.get("period") || "monthly"
    const db = getDb()

    const rows = await db
      .select({
        accountName: financialData.accountName,
        period: financialData.period,
        total: sql<string>`SUM(${financialData.amount}::numeric)`,
      })
      .from(financialData)
      .where(
        inArray(financialData.category, [
          "Storage Revenue",
          "Shipping Revenue",
          "Handling Revenue",
        ])
      )
      .groupBy(financialData.accountName, financialData.period)

    if (rows.length === 0) {
      return NextResponse.json({ customers: [] })
    }

    // Build per-customer per-period map
    const customerPeriods = new Map<string, Map<string, number>>()
    const allPeriods = new Set<string>()

    for (const row of rows) {
      const amt = parseFloat(row.total)
      if (amt <= 0) continue
      if (!customerPeriods.has(row.accountName)) customerPeriods.set(row.accountName, new Map())
      customerPeriods.get(row.accountName)!.set(row.period, (customerPeriods.get(row.accountName)!.get(row.period) || 0) + amt)
      allPeriods.add(row.period)
    }

    const sortedPeriods = [...allPeriods].sort()

    // Determine current and prior periods based on period type
    let currentPeriods: string[] = []
    let priorPeriods: string[] = []

    if (period === "monthly") {
      // Latest month
      const latestMonth = sortedPeriods[sortedPeriods.length - 1]
      currentPeriods = [latestMonth]
      const [y, m] = latestMonth.split("-").map(Number)
      const priorMonth = `${y - 1}-${String(m).padStart(2, "0")}`
      if (allPeriods.has(priorMonth)) priorPeriods = [priorMonth]
    } else if (period === "quarterly") {
      // Latest complete quarter
      const latestMonth = sortedPeriods[sortedPeriods.length - 1]
      const [ly, lm] = latestMonth.split("-").map(Number)
      const latestQ = Math.ceil(lm / 3)
      // Check if this quarter is complete
      const qStartMonth = (latestQ - 1) * 3 + 1
      const qMonths = [1, 2, 3].map((i) => `${ly}-${String(qStartMonth + i - 1).padStart(2, "0")}`)
      const isComplete = qMonths.every((m) => allPeriods.has(m))

      if (isComplete) {
        currentPeriods = qMonths
      } else {
        // Fall back to previous quarter
        const prevQ = latestQ === 1 ? 4 : latestQ - 1
        const prevY = latestQ === 1 ? ly - 1 : ly
        const prevQStart = (prevQ - 1) * 3 + 1
        currentPeriods = [1, 2, 3].map((i) => `${prevY}-${String(prevQStart + i - 1).padStart(2, "0")}`)
      }
      // Prior year same quarter
      priorPeriods = currentPeriods.map((p) => {
        const [y, m] = p.split("-").map(Number)
        return `${y - 1}-${String(m).padStart(2, "0")}`
      }).filter((p) => allPeriods.has(p))
      if (priorPeriods.length !== currentPeriods.length) priorPeriods = []
    } else {
      // TTM: trailing 12 months
      if (sortedPeriods.length >= 12) {
        currentPeriods = sortedPeriods.slice(-12)
        // Prior TTM
        priorPeriods = currentPeriods.map((p) => {
          const [y, m] = p.split("-").map(Number)
          return `${y - 1}-${String(m).padStart(2, "0")}`
        }).filter((p) => allPeriods.has(p))
        if (priorPeriods.length !== 12) priorPeriods = []
      } else {
        currentPeriods = sortedPeriods
      }
    }

    // Aggregate per customer for current and prior periods
    const currentRevenue = new Map<string, number>()
    const priorRevenue = new Map<string, number>()

    for (const [customer, pm] of customerPeriods) {
      let currentTotal = 0
      for (const p of currentPeriods) {
        currentTotal += pm.get(p) || 0
      }
      if (currentTotal > 0) currentRevenue.set(customer, currentTotal)

      if (priorPeriods.length > 0) {
        let priorTotal = 0
        for (const p of priorPeriods) {
          priorTotal += pm.get(p) || 0
        }
        if (priorTotal > 0) priorRevenue.set(customer, priorTotal)
      }
    }

    // Build sorted customer list
    const customers = [...currentRevenue.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, revenue]) => {
        const prior = priorRevenue.get(name) || 0
        const growth = prior > 0 ? round2(((revenue - prior) / prior) * 100) : null
        return {
          name,
          revenue: round2(revenue),
          priorRevenue: prior > 0 ? round2(prior) : null,
          growth,
          isNew: prior === 0,
        }
      })

    // Period label for display
    let periodLabel = ""
    if (period === "monthly" && currentPeriods.length === 1) {
      const [y, m] = currentPeriods[0].split("-").map(Number)
      const monthName = new Date(y, m - 1).toLocaleString("en-US", { month: "short" })
      periodLabel = `${monthName} ${String(y).slice(2)}`
    } else if (period === "quarterly" && currentPeriods.length === 3) {
      const [y, m] = currentPeriods[0].split("-").map(Number)
      periodLabel = `Q${Math.ceil(m / 3)} ${String(y).slice(2)}`
    } else {
      periodLabel = "TTM"
    }

    return NextResponse.json({ customers, periodLabel })
  } catch (error) {
    console.error("Customer revenue error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute customer revenue" },
      { status: 500 }
    )
  }
}
