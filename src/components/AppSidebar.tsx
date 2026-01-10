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
  Droplets,
  Truck,
  ClipboardList,
  Star,
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
import { CarSVG, BubblesSVG } from "@/components/CarWashSVG";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Today's Work", url: "/todays-work", icon: Calendar },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Vehicles", url: "/vehicles", icon: Car },
  { title: "Services", url: "/services", icon: Wrench },
  { title: "Bookings", url: "/bookings", icon: Calendar },
  { title: "Job Cards", url: "/job-cards", icon: ClipboardList },
  { title: "Door Step", url: "/door-step", icon: Truck },
  { title: "Invoices", url: "/invoices", icon: CreditCard },
  { title: "Loyalty", url: "/loyalty", icon: Star },
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-4 relative overflow-hidden">
        {/* Decorative bubbles */}
        <div className="absolute -right-4 -top-4 text-sidebar-primary opacity-20">
          <BubblesSVG className="w-20 h-20" />
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-lg">
            <Droplets className="h-5 w-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <h2 className="font-bold text-lg truncate text-sidebar-foreground">AutoWash Pro</h2>
              <p className="text-xs text-sidebar-foreground/60 truncate">Premium Car Care</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="relative">
        {/* Background car decoration */}
        {!isCollapsed && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-sidebar-primary opacity-10 pointer-events-none">
            <CarSVG className="w-32 h-32" />
          </div>
        )}
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-xs tracking-wider px-3">
              Navigation
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
                      activeClassName="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md"
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

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {!isCollapsed ? (
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/50">
            <Droplets className="h-3 w-3" />
            <span>© 2025 AutoWash Pro</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <Droplets className="h-4 w-4 text-sidebar-primary" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
