"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InfoTooltip } from "@/components/info-tooltip"
import { UserX, DollarSign, Users, TableProperties, TrendingUp } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import type { ChurnSegment, ChurnPeriod } from "@/components/dashboard"

interface ChurnedCustomer {
  name: string
  lastRevenue: number
  revenueSharePct: number
}

interface ChurnMonth {
  period: string
  activeCount: number
  churnedCount: number
  logoChurnRate: number
  revenueChurnRate: number
  lostRevenue: number
  totalRevenue: number
  nrr: number
  churnedCustomers: ChurnedCustomer[]
}

interface AnnualNrrEntry {
  period: string
  nrr: number
  customerCount: number
  priorRevenue: number
  currentRevenue: number
}

interface ChurnResponse {
  months: ChurnMonth[]
  annualNrr: AnnualNrrEntry[]
  summary: {
    lastQuarter: { logoChurn: number; revenueChurn: number }
    ttm: { logoChurn: number; revenueChurn: number }
  } | null
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-")
  const monthName = new Date(Number(year), Number(month) - 1).toLocaleString("en-US", { month: "short" })
  return `${monthName} ${year.slice(2)}`
}

interface ChurnPageProps {
  segment: ChurnSegment
  period: ChurnPeriod
}

export function ChurnPage({ segment, period }: ChurnPageProps) {
  const [data, setData] = useState<ChurnResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/metrics/churn?segment=${segment}`)
      .then((res) => res.json())
      .then((result) => setData(result))
      .catch((err) => console.error("Failed to fetch churn data:", err))
      .finally(() => setLoading(false))
  }, [segment])

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Loading churn data...
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data || !data.summary || data.months.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <UserX className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No churn data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Import revenue files to see churn analysis
          </p>
        </CardContent>
      </Card>
    )
  }

  const { months } = data

  // Skip first month (no prior to compare)
  const monthlyData = months.slice(1)

  // Get the most recent period's values for KPI cards
  const latestMonth = monthlyData[monthlyData.length - 1]

  // Build chart data based on selected period
  const chartData = monthlyData.map((m) => ({
    ...m,
    label: formatPeriodLabel(m.period),
  }))

  // Quarterly data
  const quarterlyLogoData: { label: string; quarterlyLogoChurnRate: number }[] = []
  const quarterlyRevData: { label: string; quarterlyRevenueChurnRate: number }[] = []
  const quarterlyNrrData: { label: string; quarterlyNrr: number }[] = []
  for (let i = 0; i < monthlyData.length; i += 3) {
    const chunk = monthlyData.slice(i, i + 3)
    if (chunk.length < 3) break
    const lastMonth = chunk[chunk.length - 1]
    const [year, month] = lastMonth.period.split("-").map(Number)
    const q = Math.ceil(month / 3)
    const label = `Q${q} ${String(year).slice(2)}`
    quarterlyLogoData.push({ label, quarterlyLogoChurnRate: Math.round(chunk.reduce((s, m) => s + m.logoChurnRate, 0) / chunk.length * 100) / 100 })
    quarterlyRevData.push({ label, quarterlyRevenueChurnRate: Math.round(chunk.reduce((s, m) => s + m.revenueChurnRate, 0) / chunk.length * 100) / 100 })
    quarterlyNrrData.push({ label, quarterlyNrr: Math.round(chunk.reduce((s, m) => s + m.nrr, 0) / chunk.length * 100) / 100 })
  }

  // Rolling TTM data
  const rollingTtmLogoData = monthlyData
    .map((m, i) => {
      if (i < 11) return null
      const window = monthlyData.slice(i - 11, i + 1)
      return { label: formatPeriodLabel(m.period), ttmLogoChurnRate: Math.round(window.reduce((s, w) => s + w.logoChurnRate, 0) / window.length * 100) / 100 }
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)

  const rollingTtmNrrData = monthlyData
    .map((m, i) => {
      if (i < 11) return null
      const window = monthlyData.slice(i - 11, i + 1)
      return { label: formatPeriodLabel(m.period), ttmNrr: Math.round(window.reduce((s, w) => s + w.nrr, 0) / window.length * 100) / 100 }
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)

  // Annual NRR data
  const annualNrrData = (data?.annualNrr || []).map((d) => ({
    ...d,
    label: formatPeriodLabel(d.period),
  }))

  // KPI cards: values based on selected period
  let kpiLabel = ""
  let kpiLogo = 0
  let kpiLogoSub = ""
  let kpiRevChurn = 0
  let kpiRevSub = ""
  let kpiNrr = 0
  let kpiNrrSub = ""

  if (period === "monthly") {
    const m = latestMonth
    kpiLabel = formatPeriodLabel(m.period)
    kpiLogo = m.logoChurnRate
    kpiLogoSub = `${m.churnedCount} of ${m.activeCount + m.churnedCount} customers`
    kpiRevChurn = m.revenueChurnRate
    kpiRevSub = `${formatCurrency(m.lostRevenue)} lost`
    kpiNrr = m.nrr
    kpiNrrSub = `${formatCurrency(m.totalRevenue)} current revenue`
  } else if (period === "quarterly" && quarterlyLogoData.length > 0) {
    const lastQ = quarterlyLogoData[quarterlyLogoData.length - 1]
    const lastQRev = quarterlyRevData[quarterlyRevData.length - 1]
    const lastQNrr = quarterlyNrrData[quarterlyNrrData.length - 1]
    kpiLabel = lastQ.label
    kpiLogo = lastQ.quarterlyLogoChurnRate
    kpiLogoSub = "Avg monthly rate for quarter"
    kpiRevChurn = lastQRev.quarterlyRevenueChurnRate
    kpiRevSub = "Avg monthly rate for quarter"
    kpiNrr = lastQNrr.quarterlyNrr
    kpiNrrSub = "Avg monthly NRR for quarter"
  } else if (period === "ttm") {
    const lastTtmLogo = rollingTtmLogoData.length > 0 ? rollingTtmLogoData[rollingTtmLogoData.length - 1] : null
    const lastTtmNrr = rollingTtmNrrData.length > 0 ? rollingTtmNrrData[rollingTtmNrrData.length - 1] : null
    const lastAnnualNrr = annualNrrData.length > 0 ? annualNrrData[annualNrrData.length - 1] : null
    kpiLabel = lastTtmLogo?.label || latestMonth.period
    kpiLogo = lastTtmLogo?.ttmLogoChurnRate || 0
    kpiLogoSub = "Rolling 12-month average"
    kpiRevChurn = lastAnnualNrr?.nrr || 0
    kpiRevSub = lastAnnualNrr ? `${lastAnnualNrr.customerCount} customers YoY` : "No YoY data yet"
    kpiNrr = lastTtmNrr?.ttmNrr || 0
    kpiNrrSub = "Rolling 12-month average"
  }

  const kpiCards = [
    {
      title: "Logo Churn",
      value: formatPct(kpiLogo),
      sub: `${kpiLabel} — ${kpiLogoSub}`,
      icon: Users,
      warn: kpiLogo > 10,
    },
    {
      title: period === "ttm" ? "Annual NRR" : "Revenue Churn",
      value: formatPct(kpiRevChurn),
      sub: `${kpiLabel} — ${kpiRevSub}`,
      icon: DollarSign,
      warn: period === "ttm" ? kpiRevChurn < 90 : kpiRevChurn > 10,
    },
    {
      title: "Net Revenue Retention",
      value: formatPct(kpiNrr),
      sub: `${kpiLabel} — ${kpiNrrSub}`,
      icon: TrendingUp,
      warn: kpiNrr < 90,
    },
  ]

  // Shared chart tooltip style
  const tooltipStyle = { backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription className="text-sm font-medium">{kpi.title}</CardDescription>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${kpi.warn ? "text-red-600" : ""}`}>
                {kpi.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatPeriodLabel(latestMonth.period)} — {kpi.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Logo Churn
              <InfoTooltip text={
                period === "monthly"
                  ? "% of prior month\u2019s active customers who had $0 revenue in the current month."
                  : period === "quarterly"
                    ? "Average of the 3 monthly logo churn rates per calendar quarter."
                    : "12-month rolling average of monthly logo churn rates."
              } />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              {period === "monthly" ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Logo Churn"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="logoChurnRate" stroke="#e76e50" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              ) : period === "quarterly" ? (
                <LineChart data={quarterlyLogoData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Quarterly Logo Churn"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="quarterlyLogoChurnRate" stroke="#e76e50" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              ) : (
                <LineChart data={rollingTtmLogoData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "TTM Logo Churn"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="ttmLogoChurnRate" stroke="#e76e50" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {period === "ttm" ? "Annual NRR" : "Revenue Churn"}
              <InfoTooltip text={
                period === "monthly"
                  ? "% of prior month\u2019s revenue lost from customers who dropped to $0 in the current month."
                  : period === "quarterly"
                    ? "Average of the 3 monthly revenue churn rates per calendar quarter."
                    : "Year-over-year revenue from the same customers. Only customers with revenue in the same month last year are included. >100% = growth, <100% = net contraction."
              } />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              {period === "monthly" ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Revenue Churn"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="revenueChurnRate" stroke="#264653" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              ) : period === "quarterly" ? (
                <LineChart data={quarterlyRevData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Quarterly Revenue Churn"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="quarterlyRevenueChurnRate" stroke="#264653" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              ) : (
                <LineChart data={annualNrrData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} domain={["dataMin - 5", "dataMax + 5"]} />
                  <Tooltip
                    formatter={(value, _name, props) => {
                      const entry = props?.payload
                      return [`${Number(value).toFixed(1)}% (${entry?.customerCount || 0} customers)`, "Annual NRR"]
                    }}
                    labelFormatter={(l) => l}
                    contentStyle={tooltipStyle}
                  />
                  <ReferenceLine y={100} stroke="#2a9d8f" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="nrr" stroke="#264653" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Net Revenue Retention
            <InfoTooltip text={
              period === "monthly"
                ? "Revenue from prior month\u2019s customers as % of prior month\u2019s total revenue. >100% = expansion outpaces churn."
                : period === "quarterly"
                  ? "Average of the 3 monthly NRR values per calendar quarter."
                  : "12-month rolling average of monthly NRR."
            } />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            {period === "monthly" ? (
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "NRR"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                <ReferenceLine y={100} stroke="#2a9d8f" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                <Line type="monotone" dataKey="nrr" stroke="#2a9d8f" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            ) : period === "quarterly" ? (
              <LineChart data={quarterlyNrrData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Quarterly NRR"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                <ReferenceLine y={100} stroke="#2a9d8f" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                <Line type="monotone" dataKey="quarterlyNrr" stroke="#2a9d8f" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            ) : (
              <LineChart data={rollingTtmNrrData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "TTM NRR"]} labelFormatter={(l) => l} contentStyle={tooltipStyle} />
                <ReferenceLine y={100} stroke="#2a9d8f" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                <Line type="monotone" dataKey="ttmNrr" stroke="#2a9d8f" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <ChurnDetailsTable months={months} />
    </div>
  )
}

function ChurnDetailsTable({ months }: { months: ChurnMonth[] }) {
  const [showCustomers, setShowCustomers] = useState(false)

  const dataMonths = months.slice(1)

  const allChurned = dataMonths.flatMap((m) =>
    m.churnedCustomers.map((c) => ({
      ...c,
      churnMonth: m.period,
      churnMonthLabel: formatPeriodLabel(m.period),
    }))
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Monthly Churn Details
              <InfoTooltip text={showCustomers
                ? `${allChurned.length} churned customers across all months, sorted by revenue impact.`
                : "Active customers, churned count, and lost revenue by month."
              } />
            </CardTitle>
          </div>
          <Button
            variant={showCustomers ? "default" : "outline"}
            size="sm"
            onClick={() => setShowCustomers(!showCustomers)}
            className="gap-1"
          >
            <TableProperties className="h-4 w-4" />
            {showCustomers ? "Summary" : "Churned Customers"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!showCustomers ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Month</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Active</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Churned</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Logo %</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Revenue</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Lost</th>
                  <th className="text-right py-2 pl-3 font-medium text-muted-foreground">Rev %</th>
                </tr>
              </thead>
              <tbody>
                {dataMonths.map((m) => (
                  <tr key={m.period} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{formatPeriodLabel(m.period)}</td>
                    <td className="text-right py-2 px-3">{m.activeCount}</td>
                    <td className="text-right py-2 px-3">{m.churnedCount}</td>
                    <td className={`text-right py-2 px-3 font-mono ${m.logoChurnRate > 10 ? "text-red-600 font-semibold" : ""}`}>
                      {formatPct(m.logoChurnRate)}
                    </td>
                    <td className="text-right py-2 px-3 font-mono">{formatCurrency(m.totalRevenue)}</td>
                    <td className="text-right py-2 px-3 font-mono text-red-600">{m.lostRevenue > 0 ? formatCurrency(m.lostRevenue) : "-"}</td>
                    <td className={`text-right py-2 pl-3 font-mono ${m.revenueChurnRate > 10 ? "text-red-600 font-semibold" : ""}`}>
                      {formatPct(m.revenueChurnRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Churn Month</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Last Monthly Revenue</th>
                  <th className="text-right py-2 pl-3 font-medium text-muted-foreground">% of Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {allChurned.map((c, i) => (
                  <tr key={`${c.name}-${c.churnMonth}-${i}`} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{c.name}</td>
                    <td className="py-2 px-3">{c.churnMonthLabel}</td>
                    <td className="text-right py-2 px-3 font-mono text-red-600">{formatCurrency(c.lastRevenue)}</td>
                    <td className={`text-right py-2 pl-3 font-mono ${c.revenueSharePct > 5 ? "text-red-600 font-semibold" : ""}`}>
                      {formatPct(c.revenueSharePct)}
                    </td>
                  </tr>
                ))}
                {allChurned.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted-foreground">
                      No churned customers in this segment
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
