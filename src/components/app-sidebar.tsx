"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Package, BarChart3, Table2, Settings, UserX, TrendingUp, Upload, Users } from "lucide-react"

interface AppSidebarProps {
  activePage: string
  onNavigate: (page: string) => void
}

export function AppSidebar({ activePage, onNavigate }: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => onNavigate("overview")}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Package className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">Handled</span>
                <span className="text-xs text-muted-foreground">Board Metrics</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activePage === "overview"}
                  onClick={() => onNavigate("overview")}
                >
                  <BarChart3 className="size-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activePage === "revenue-metrics"}
                  onClick={() => onNavigate("revenue-metrics")}
                >
                  <TrendingUp className="size-4" />
                  <span>Service Revenue</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activePage === "financials"}
                  onClick={() => onNavigate("financials")}
                >
                  <Table2 className="size-4" />
                  <span>Customer Revenue</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activePage === "churn"}
                  onClick={() => onNavigate("churn")}
                >
                  <UserX className="size-4" />
                  <span>LTV-Churn</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activePage === "leads"}
                  onClick={() => onNavigate("leads")}
                >
                  <Users className="size-4" />
                  <span>Leads</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activePage === "import"}
              onClick={() => onNavigate("import")}
            >
              <Upload className="size-4" />
              <span>Import</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <Settings className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
