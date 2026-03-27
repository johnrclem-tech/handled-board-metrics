"use client"

import { useState, useEffect, useCallback } from "react"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { AppSidebar } from "@/components/app-sidebar"
import { KpiOverview } from "@/components/kpi-overview"
import { FileUpload } from "@/components/file-upload"
import { FinancialTable } from "@/components/financial-table"
import { RevenueChart } from "@/components/revenue-chart"
import { CohortSummaryChart } from "@/components/cohort-summary-chart"
import { CohortRevenueTable } from "@/components/cohort-revenue-table"
import { ConcentrationChart } from "@/components/concentration-chart"

export interface CohortDrillFilter {
  billingMonth: number
  category: string
  label: string
}

const PAGE_TITLES: Record<string, string> = {
  overview: "KPI Overview",
  cohort: "Cohort Analysis",
  concentration: "Customer Concentration",
  financials: "Financial Data",
  upload: "Import Data",
}

export function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [activePage, setActivePage] = useState("overview")
  const [drillFilter, setDrillFilter] = useState<CohortDrillFilter | null>(null)

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
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{PAGE_TITLES[activePage] || "Dashboard"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className="flex-1 p-4 md:p-6">
          {activePage === "overview" && (
            <div className="space-y-6">
              <KpiOverview key={`kpi-${refreshKey}`} />
              <CohortSummaryChart
                key={`cohort-summary-${refreshKey}`}
                onViewDetails={() => setActivePage("cohort")}
                onDrill={handleCohortDrill}
              />
              <RevenueChart key={`chart-${refreshKey}`} />
            </div>
          )}

          {activePage === "financials" && (
            <FinancialTable
              key={`table-${refreshKey}`}
              drillFilter={drillFilter}
              onClearDrill={handleClearDrill}
            />
          )}

          {activePage === "cohort" && (
            <CohortRevenueTable
              key={`cohort-${refreshKey}`}
              onDrill={handleCohortDrill}
            />
          )}

          {activePage === "concentration" && (
            <ConcentrationChart key={`concentration-${refreshKey}`} />
          )}

          {activePage === "upload" && (
            <FileUpload onUploadComplete={handleUploadComplete} />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
