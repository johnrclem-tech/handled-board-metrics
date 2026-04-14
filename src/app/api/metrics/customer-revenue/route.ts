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

    // Exclude the current calendar month and anything newer from the usable dataset
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)
    const currentYearQ = `${now.getFullYear()}-Q${currentQuarter}`
    const eligiblePeriods = sortedPeriods.filter((p) => p < currentMonth)

    // Determine current and prior periods based on period type
    let currentPeriods: string[] = []
    let priorPeriods: string[] = []

    if (period === "monthly") {
      // Latest complete month
      const latestMonth = eligiblePeriods[eligiblePeriods.length - 1]
      if (latestMonth) {
        currentPeriods = [latestMonth]
        const [y, m] = latestMonth.split("-").map(Number)
        const priorMonth = `${y - 1}-${String(m).padStart(2, "0")}`
        if (allPeriods.has(priorMonth)) priorPeriods = [priorMonth]
      }
    } else if (period === "quarterly") {
      // Find the latest COMPLETE quarter that is NOT the current calendar quarter
      const tryQuarter = (year: number, q: number): string[] | null => {
        const qStart = (q - 1) * 3 + 1
        const qMonths = [0, 1, 2].map((i) => `${year}-${String(qStart + i).padStart(2, "0")}`)
        const complete = qMonths.every((m) => allPeriods.has(m))
        const qKey = `${year}-Q${q}`
        if (complete && qKey < currentYearQ) return qMonths
        return null
      }
      const latestMonth = eligiblePeriods[eligiblePeriods.length - 1]
      if (latestMonth) {
        let [yr, mo] = latestMonth.split("-").map(Number)
        let q = Math.ceil(mo / 3)
        // Try successively older quarters until we find one that is complete and not the current calendar quarter
        for (let step = 0; step < 8; step++) {
          const months = tryQuarter(yr, q)
          if (months) { currentPeriods = months; break }
          q -= 1
          if (q === 0) { q = 4; yr -= 1 }
        }
      }
      // Prior year same quarter
      priorPeriods = currentPeriods.map((p) => {
        const [y, m] = p.split("-").map(Number)
        return `${y - 1}-${String(m).padStart(2, "0")}`
      }).filter((p) => allPeriods.has(p))
      if (priorPeriods.length !== currentPeriods.length) priorPeriods = []
    } else {
      // TTM: exclude the most recent month of data from all windows
      const ttmPool = sortedPeriods.slice(0, -1)
      if (ttmPool.length >= 12) {
        currentPeriods = ttmPool.slice(-12)
        // Prior TTM (12 months before the current window)
        priorPeriods = currentPeriods.map((p) => {
          const [y, m] = p.split("-").map(Number)
          return `${y - 1}-${String(m).padStart(2, "0")}`
        }).filter((p) => allPeriods.has(p))
        if (priorPeriods.length !== 12) priorPeriods = []
      } else {
        currentPeriods = ttmPool
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
