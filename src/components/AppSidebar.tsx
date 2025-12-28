import {
  LayoutDashboard,
  Users,
  Car,
  Calendar,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Today's Work", url: "/todays-work", icon: Calendar },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Vehicles", url: "/vehicles", icon: Car },
  { title: "Services", url: "/services", icon: Wrench },
  { title: "Bookings", url: "/bookings", icon: Calendar },
  { title: "Invoices", url: "/invoices", icon: CreditCard },
  { title: "Staff", url: "/staff", icon: UserCog },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Expenses", url: "/expenses", icon: DollarSign },
  { title: "Subscriptions", url: "/subscriptions", icon: Gift },
  { title: "Reviews", url: "/reviews", icon: MessageSquare },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <h2 className="font-bold text-lg truncate">AutoWash Pro</h2>
              <p className="text-xs text-muted-foreground truncate">Car Wash Management</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel>Main Menu</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span className="truncate">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        {!isCollapsed && (
          <div className="text-xs text-muted-foreground">
            © 2025 AutoWash Pro
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
