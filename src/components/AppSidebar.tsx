import {
  LayoutDashboard,
  Users,
  Car,
  Calendar,
  FileText,
  CreditCard,
  Package,
  UserCog,
  Settings,
  BarChart3,
  MessageSquare,
  Gift,
  Wrench,
  DollarSign,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Today's Work", url: "/todays-work", icon: Calendar },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Vehicles", url: "/vehicles", icon: Car },
  { title: "Services", url: "/services", icon: Wrench },
  { title: "Bookings", url: "/bookings", icon: Calendar },
  { title: "Job Cards", url: "/job-cards", icon: FileText },
  { title: "Invoices", url: "/invoices", icon: CreditCard },
  { title: "Staff", url: "/staff", icon: UserCog },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Expenses", url: "/expenses", icon: DollarSign },
  { title: "Subscriptions", url: "/subscriptions", icon: Gift },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-lg">AutoWash Pro</h2>
            <p className="text-xs text-muted-foreground">Car Wash Management</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-primary/10 text-primary font-semibold"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <div className="text-xs text-muted-foreground">
          © 2025 AutoWash Pro
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
