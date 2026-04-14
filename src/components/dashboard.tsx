"use client"

import { useState, useEffect, useCallback } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { AppSidebar } from "@/components/app-sidebar"
import { FileUpload } from "@/components/file-upload"
import { FinancialTable } from "@/components/financial-table"
import { CohortSummaryChart } from "@/components/cohort-summary-chart"
import { ConcentrationChart } from "@/components/concentration-chart"
import { ChurnPage } from "@/components/churn-page"
import { LifetimeGrossMarginCard } from "@/components/lifetime-gross-margin-card"
import { RevenueMetricsPage } from "@/components/revenue-metrics-page"
import type { ServicePeriod } from "@/components/revenue-metrics-page"
import { LeadsPage } from "@/components/leads-page"
import type { LeadsPeriod } from "@/components/leads-page"
import type { ConcentrationPeriod } from "@/components/concentration-chart"

export interface CohortDrillFilter {
  billingMonth: number
  category: string
  label: string
}

export type ChurnSegment = "all" | "new" | "existing"
export type ChurnPeriod = "monthly" | "quarterly" | "annually"

const PAGE_TITLES: Record<string, string> = {
  "revenue-metrics": "Service Revenue",
  financials: "Customer Revenue",
  churn: "LTV-Churn",
  leads: "Leads",
  import: "Import",
}

const SEGMENTS: { value: ChurnSegment; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "existing", label: "Existing" },
]

const PERIODS: { value: ChurnPeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
]

const CUSTOMER_PERIODS: { value: ConcentrationPeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "ttm", label: "TTM" },
]

const SERVICE_PERIODS: { value: ServicePeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "ttm", label: "TTM" },
]

const LEADS_PERIODS: { value: LeadsPeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
  { value: "ttm", label: "TTM" },
]

export function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [activePage, setActivePage] = useState("revenue-metrics")
  const [drillFilter, setDrillFilter] = useState<CohortDrillFilter | null>(null)
  const [churnSegment, setChurnSegment] = useState<ChurnSegment>("all")
  const [churnPeriod, setChurnPeriod] = useState<ChurnPeriod>("monthly")
  const [customerPeriod, setCustomerPeriod] = useState<ConcentrationPeriod>("monthly")
  const [leadsPeriod, setLeadsPeriod] = useState<LeadsPeriod>("monthly")
  const [servicePeriod, setServicePeriod] = useState<ServicePeriod>("monthly")

  useEffect(() => {
    fetch("/api/setup").catch(() => {})
  }, [])

  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const handleCohortDrill = useCallback((filter: CohortDrillFilter) => {
    setDrillFilter(filter)
    setActivePage("financials")
  }, [])

  const handleClearDrill = useCallback(() => {
    setDrillFilter(null)
  }, [])

  const handleNavigate = useCallback((page: string) => {
    setActivePage(page)
    if (page !== "financials") {
      setDrillFilter(null)
    }
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar activePage={activePage} onNavigate={handleNavigate} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="text-2xl font-bold tracking-tight text-foreground">{PAGE_TITLES[activePage] || "Dashboard"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {(activePage === "churn" || activePage === "revenue-metrics") && (
            <div className="ml-auto flex items-center gap-3">
              {activePage === "revenue-metrics" && (
                <span className="text-sm font-medium text-muted-foreground">Customers:</span>
              )}
              <Tabs value={churnSegment} onValueChange={(v) => setChurnSegment(v as ChurnSegment)}>
                <TabsList className="bg-muted h-9">
                  {SEGMENTS.map((s) => (
                    <TabsTrigger key={s.value} value={s.value} className="px-4">
                      {s.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {activePage === "churn" && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  <Tabs value={churnPeriod} onValueChange={(v) => setChurnPeriod(v as ChurnPeriod)}>
                    <TabsList className="bg-muted h-9">
                      {PERIODS.map((p) => (
                        <TabsTrigger key={p.value} value={p.value} className="px-4">
                          {p.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </>
              )}
              {activePage === "revenue-metrics" && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  <span className="text-sm font-medium text-muted-foreground">View:</span>
                  <Tabs value={servicePeriod} onValueChange={(v) => setServicePeriod(v as ServicePeriod)}>
                    <TabsList className="bg-muted h-9">
                      {SERVICE_PERIODS.map((p) => (
                        <TabsTrigger key={p.value} value={p.value} className="px-4">
                          {p.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </>
              )}
            </div>
          )}

          {activePage === "financials" && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">View:</span>
              <Tabs value={customerPeriod} onValueChange={(v) => setCustomerPeriod(v as ConcentrationPeriod)}>
                <TabsList className="bg-muted h-9">
                  {CUSTOMER_PERIODS.map((p) => (
                    <TabsTrigger key={p.value} value={p.value} className="px-4">
                      {p.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}

          {activePage === "leads" && (
            <div className="ml-auto flex items-center gap-3">
              <Tabs value={leadsPeriod} onValueChange={(v) => setLeadsPeriod(v as LeadsPeriod)}>
                <TabsList className="bg-muted h-9">
                  {LEADS_PERIODS.map((p) => (
                    <TabsTrigger key={p.value} value={p.value} className="px-4">
                      {p.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {activePage === "churn" && (
            <ChurnPage
              key={`churn-${refreshKey}`}
              segment={churnSegment}
              period={churnPeriod}
              ltvCard={<LifetimeGrossMarginCard key={`ltv-card-${refreshKey}`} />}
              ltvChart={
                <CohortSummaryChart
                  key={`cohort-summary-${refreshKey}`}
                  onViewDetails={() => {}}
                  onDrill={handleCohortDrill}
                  period="monthly"
                />
              }
              ltvTable={<FinancialTable key={`ltv-table-${refreshKey}`} view="ltv" />}
            />
          )}

          {activePage === "revenue-metrics" && (
            <RevenueMetricsPage
              key={`revenue-metrics-${refreshKey}`}
              segment={churnSegment}
              period={servicePeriod}
            />
          )}

          {activePage === "financials" && (
            <div className="space-y-6">
              <ConcentrationChart key={`concentration-${refreshKey}`} period={customerPeriod} />
              <FinancialTable
                key={`table-${refreshKey}`}
                drillFilter={drillFilter}
                onClearDrill={handleClearDrill}
                view="raw"
              />
            </div>
          )}
          {activePage === "leads" && (
            <LeadsPage key={`leads-${refreshKey}`} period={leadsPeriod} />
          )}

          {activePage === "import" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Import Data</h2>
                <p className="text-sm text-muted-foreground">
                  Upload QuickBooks Excel exports to populate your dashboard.
                </p>
              </div>
              <FileUpload onUploadComplete={handleUploadComplete} />
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
