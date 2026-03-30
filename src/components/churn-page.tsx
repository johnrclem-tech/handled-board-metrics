"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InfoTooltip } from "@/components/info-tooltip"
import { UserX, TrendingDown, DollarSign, Users, TableProperties } from "lucide-react"
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

interface ChurnSummary {
  lastQuarter: { logoChurn: number; revenueChurn: number }
  ttm: { logoChurn: number; revenueChurn: number }
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
  summary: ChurnSummary | null
}

type Segment = "all" | "new" | "existing"

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

export function ChurnPage() {
  const [data, setData] = useState<ChurnResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [segment, setSegment] = useState<Segment>("all")
  const [logoChurnMode, setLogoChurnMode] = useState<"monthly" | "quarterly" | "ttm">("monthly")
  const [revChurnMode, setRevChurnMode] = useState<"monthly" | "quarterly" | "annual">("monthly")
  const [nrrMode, setNrrMode] = useState<"monthly" | "quarterly" | "ttm">("monthly")

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

  const { months, summary } = data

  // Skip first month for charts (no prior month to compare)
  const monthlyData = months.slice(1)
  const chartData = monthlyData.map((m) => ({
    ...m,
    label: formatPeriodLabel(m.period),
  }))

  // Compute rolling TTM logo churn: for each month, avg of prior 12 months' rates
  // Only start when we have 12 months of data (Oct 2025 if first churn is Oct 2024)
  const rollingTtmData = monthlyData
    .map((m, i) => {
      if (i < 11) return null // need 12 months of data (index 0-11 = months 1-12)
      const window = monthlyData.slice(i - 11, i + 1)
      const avgRate = window.reduce((s, w) => s + w.logoChurnRate, 0) / window.length
      return {
        period: m.period,
        label: formatPeriodLabel(m.period),
        ttmLogoChurnRate: Math.round(avgRate * 100) / 100,
      }
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)

  // Annual NRR data from API (year-over-year same-customer comparison)
  const annualNrrData = (data?.annualNrr || []).map((d) => ({
    ...d,
    label: formatPeriodLabel(d.period),
  }))

  // Compute quarterly logo churn: group months into quarters, avg the rates
  const quarterlyData: { label: string; quarterlyLogoChurnRate: number }[] = []
  for (let i = 0; i < monthlyData.length; i += 3) {
    const chunk = monthlyData.slice(i, i + 3)
    if (chunk.length < 3) break // skip incomplete quarters
    const avgRate = chunk.reduce((s, m) => s + m.logoChurnRate, 0) / chunk.length
    // Label as Q1-Q4 based on the last month of the quarter
    const lastMonth = chunk[chunk.length - 1]
    const [year, month] = lastMonth.period.split("-").map(Number)
    const q = Math.ceil(month / 3)
    quarterlyData.push({
      label: `Q${q} ${String(year).slice(2)}`,
      quarterlyLogoChurnRate: Math.round(avgRate * 100) / 100,
    })
  }

  // Compute quarterly revenue churn
  const quarterlyRevData: { label: string; quarterlyRevenueChurnRate: number }[] = []
  for (let i = 0; i < monthlyData.length; i += 3) {
    const chunk = monthlyData.slice(i, i + 3)
    if (chunk.length < 3) break
    const avgRate = chunk.reduce((s, m) => s + m.revenueChurnRate, 0) / chunk.length
    const lastMonth = chunk[chunk.length - 1]
    const [year, month] = lastMonth.period.split("-").map(Number)
    const q = Math.ceil(month / 3)
    quarterlyRevData.push({
      label: `Q${q} ${String(year).slice(2)}`,
      quarterlyRevenueChurnRate: Math.round(avgRate * 100) / 100,
    })
  }

  // Compute NRR data
  const nrrChartData = monthlyData.map((m) => ({
    ...m,
    label: formatPeriodLabel(m.period),
  }))

  const rollingTtmNrrData = monthlyData
    .map((m, i) => {
      if (i < 11) return null
      const window = monthlyData.slice(i - 11, i + 1)
      const avgNrr = window.reduce((s, w) => s + w.nrr, 0) / window.length
      return {
        period: m.period,
        label: formatPeriodLabel(m.period),
        ttmNrr: Math.round(avgNrr * 100) / 100,
      }
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)

  const quarterlyNrrData: { label: string; quarterlyNrr: number }[] = []
  for (let i = 0; i < monthlyData.length; i += 3) {
    const chunk = monthlyData.slice(i, i + 3)
    if (chunk.length < 3) break
    const avgNrr = chunk.reduce((s, m) => s + m.nrr, 0) / chunk.length
    const lastMonth = chunk[chunk.length - 1]
    const [year, month] = lastMonth.period.split("-").map(Number)
    const q = Math.ceil(month / 3)
    quarterlyNrrData.push({
      label: `Q${q} ${String(year).slice(2)}`,
      quarterlyNrr: Math.round(avgNrr * 100) / 100,
    })
  }

  const segments: { value: Segment; label: string }[] = [
    { value: "all", label: "All" },
    { value: "new", label: "New" },
    { value: "existing", label: "Existing (Hook)" },
  ]

  const kpiCards = [
    {
      title: "Last Quarter Logo Churn",
      value: formatPct(summary.lastQuarter.logoChurn),
      description: "Avg monthly customer churn rate (last 3 months)",
      icon: Users,
      warn: summary.lastQuarter.logoChurn > 10,
    },
    {
      title: "Last Quarter Revenue Churn",
      value: formatPct(summary.lastQuarter.revenueChurn),
      description: "Avg monthly revenue churn rate (last 3 months)",
      icon: DollarSign,
      warn: summary.lastQuarter.revenueChurn > 10,
    },
    {
      title: "TTM Logo Churn",
      value: formatPct(summary.ttm.logoChurn),
      description: "Avg monthly customer churn rate (trailing 12 months)",
      icon: TrendingDown,
      warn: summary.ttm.logoChurn > 10,
    },
    {
      title: "TTM Revenue Churn",
      value: formatPct(summary.ttm.revenueChurn),
      description: "Avg monthly revenue churn rate (trailing 12 months)",
      icon: DollarSign,
      warn: summary.ttm.revenueChurn > 10,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Churn Analysis</h2>
          <p className="text-muted-foreground">
            Customer and revenue churn rates based on total monthly revenue per customer
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border p-1">
          {segments.map((s) => (
            <Button
              key={s.value}
              variant={segment === s.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setSegment(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {logoChurnMode === "monthly" ? "Logo Churn — Monthly"
                    : logoChurnMode === "quarterly" ? "Logo Churn — Quarterly"
                    : "Logo Churn — Rolling TTM"}
                  <InfoTooltip text={
                    logoChurnMode === "monthly"
                      ? "% of prior month\u2019s active customers who had $0 revenue in the current month."
                      : logoChurnMode === "quarterly"
                        ? "Average of the 3 monthly logo churn rates per calendar quarter."
                        : "12-month rolling average of monthly logo churn rates."
                  } />
                </CardTitle>
              </div>
              <div className="flex gap-1 rounded-lg border p-1">
                {(["monthly", "quarterly", "ttm"] as const).map((mode) => (
                  <Button
                    key={mode}
                    variant={logoChurnMode === mode ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setLogoChurnMode(mode)}
                    className="text-xs h-7 px-2"
                  >
                    {mode === "monthly" ? "Monthly" : mode === "quarterly" ? "Quarterly" : "Rolling TTM"}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              {logoChurnMode === "monthly" ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Logo Churn"]} labelFormatter={(label) => label} contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="logoChurnRate" stroke="#e76e50" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Logo Churn" />
                </LineChart>
              ) : logoChurnMode === "quarterly" ? (
                <LineChart data={quarterlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Quarterly Logo Churn"]} labelFormatter={(label) => label} contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="quarterlyLogoChurnRate" stroke="#e76e50" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Quarterly Logo Churn" />
                </LineChart>
              ) : (
                <LineChart data={rollingTtmData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "TTM Logo Churn"]} labelFormatter={(label) => label} contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="ttmLogoChurnRate" stroke="#e76e50" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="TTM Logo Churn" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {revChurnMode === "monthly" ? "Revenue Churn — Monthly"
                    : revChurnMode === "quarterly" ? "Revenue Churn — Quarterly"
                    : "Annual NRR"}
                  <InfoTooltip text={
                    revChurnMode === "monthly"
                      ? "% of prior month\u2019s revenue lost from customers who dropped to $0 in the current month."
                      : revChurnMode === "quarterly"
                        ? "Average of the 3 monthly revenue churn rates per calendar quarter."
                        : "Year-over-year revenue from the same customers. Only customers with revenue in the same month last year are included. >100% = growth, <100% = net contraction."
                  } />
                </CardTitle>
              </div>
              <div className="flex gap-1 rounded-lg border p-1">
                {(["monthly", "quarterly", "annual"] as const).map((mode) => (
                  <Button
                    key={mode}
                    variant={revChurnMode === mode ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setRevChurnMode(mode)}
                    className="text-xs h-7 px-2"
                  >
                    {mode === "monthly" ? "Monthly" : mode === "quarterly" ? "Quarterly" : "Annual NRR"}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              {revChurnMode === "monthly" ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Revenue Churn"]} labelFormatter={(label) => label} contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="revenueChurnRate" stroke="#264653" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Revenue Churn" />
                </LineChart>
              ) : revChurnMode === "quarterly" ? (
                <LineChart data={quarterlyRevData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={45} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Quarterly Revenue Churn"]} labelFormatter={(label) => label} contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <ReferenceLine y={10} stroke="#999" strokeDasharray="3 3" label={{ value: "10%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="quarterlyRevenueChurnRate" stroke="#264653" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Quarterly Revenue Churn" />
                </LineChart>
              ) : (
                <LineChart data={annualNrrData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                  <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} domain={["dataMin - 5", "dataMax + 5"]} />
                  <Tooltip
                    formatter={(value, name, props) => {
                      const entry = props?.payload
                      return [`${Number(value).toFixed(1)}% (${entry?.customerCount || 0} customers)`, "Annual NRR"]
                    }}
                    labelFormatter={(label) => label}
                    contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <ReferenceLine y={100} stroke="#2a9d8f" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="nrr" stroke="#264653" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Annual NRR" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {nrrMode === "monthly" ? "Net Revenue Retention — Monthly"
                  : nrrMode === "quarterly" ? "Net Revenue Retention — Quarterly"
                  : "Net Revenue Retention — Rolling TTM"}
                <InfoTooltip text={
                  nrrMode === "monthly"
                    ? "Revenue from prior month\u2019s customers as % of prior month\u2019s total revenue. >100% = expansion outpaces churn."
                    : nrrMode === "quarterly"
                      ? "Average of the 3 monthly NRR values per calendar quarter."
                      : "12-month rolling average of monthly NRR."
                } />
              </CardTitle>
            </div>
            <div className="flex gap-1 rounded-lg border p-1">
              {(["monthly", "quarterly", "ttm"] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={nrrMode === mode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setNrrMode(mode)}
                  className="text-xs h-7 px-2"
                >
                  {mode === "monthly" ? "Monthly" : mode === "quarterly" ? "Quarterly" : "Rolling TTM"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            {nrrMode === "monthly" ? (
              <LineChart data={nrrChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "NRR"]} labelFormatter={(label) => label} contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <ReferenceLine y={100} stroke="#2a9d8f" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                <Line type="monotone" dataKey="nrr" stroke="#2a9d8f" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="NRR" />
              </LineChart>
            ) : nrrMode === "quarterly" ? (
              <LineChart data={quarterlyNrrData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Quarterly NRR"]} labelFormatter={(label) => label} contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <ReferenceLine y={100} stroke="#2a9d8f" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                <Line type="monotone" dataKey="quarterlyNrr" stroke="#2a9d8f" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Quarterly NRR" />
              </LineChart>
            ) : (
              <LineChart data={rollingTtmNrrData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} interval={0} />
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11 }} width={50} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "TTM NRR"]} labelFormatter={(label) => label} contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <ReferenceLine y={100} stroke="#2a9d8f" strokeWidth={2} strokeDasharray="3 3" label={{ value: "100%", position: "right", fontSize: 11 }} />
                <Line type="monotone" dataKey="ttmNrr" stroke="#2a9d8f" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="TTM NRR" />
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

  // Skip first month (no prior to compare)
  const dataMonths = months.slice(1)

  // Flatten all churned customers across all months for customer view
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
