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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { AppSidebar } from "@/components/app-sidebar"
import { KpiOverview } from "@/components/kpi-overview"
import { FileUpload } from "@/components/file-upload"
import { FinancialTable } from "@/components/financial-table"
import { RevenueChart } from "@/components/revenue-chart"
import { CohortSummaryChart } from "@/components/cohort-summary-chart"
import { CohortRevenueTable } from "@/components/cohort-revenue-table"
import { ConcentrationChart } from "@/components/concentration-chart"
import { NewCustomersChart } from "@/components/new-customers-chart"
import { ExistingCustomersChart } from "@/components/existing-customers-chart"

export interface CohortDrillFilter {
  billingMonth: number
  category: string
  label: string
}

const PAGE_TITLES: Record<string, string> = {
  overview: "KPI Overview",
  cohort: "Cohort Analysis",
  concentration: "Customer Concentration",
  financials: "Revenue",
}

export function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [activePage, setActivePage] = useState("overview")
  const [drillFilter, setDrillFilter] = useState<CohortDrillFilter | null>(null)
  const [importOpen, setImportOpen] = useState(false)

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

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {activePage === "overview" && (
            <div className="space-y-6">
              <KpiOverview key={`kpi-${refreshKey}`} />
              <CohortSummaryChart
                key={`cohort-summary-${refreshKey}`}
                onViewDetails={() => setActivePage("cohort")}
                onDrill={handleCohortDrill}
              />
              <NewCustomersChart key={`new-customers-${refreshKey}`} />
              <ExistingCustomersChart key={`existing-${refreshKey}`} />
              <RevenueChart key={`chart-${refreshKey}`} />
            </div>
          )}

          {activePage === "financials" && (
            <FinancialTable
              key={`table-${refreshKey}`}
              drillFilter={drillFilter}
              onClearDrill={handleClearDrill}
              onImport={() => setImportOpen(true)}
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
        </main>
      </SidebarInset>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Data</DialogTitle>
            <DialogDescription>
              Upload QuickBooks Excel exports to populate your dashboard.
            </DialogDescription>
          </DialogHeader>
          <FileUpload onUploadComplete={() => {
            handleUploadComplete()
            setImportOpen(false)
          }} />
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
