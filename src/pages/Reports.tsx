import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Download, TrendingUp, Users, Car, DollarSign, Calendar as CalendarIcon, Package, Activity, TrendingDown, UserCheck, Star, Repeat, PieChart as PieChartIcon, BarChart3, Wallet, FileText, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useState } from "react";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { CarWashLoader } from "@/components/CarWashLoader";

const Reports = () => {
  const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 30), to: new Date() });
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: departments } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from("branches").select("id, name").eq("user_id", user.id);
      if (error) throw error;
      return data;
    }
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["reports-stats", selectedDepartment, dateRange],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [customers, vehicles, bookings, invoices, services, jobCards, expenses, reviews] = await Promise.all([
        supabase.from("customers").select("id, created_at", { count: "exact" }).eq("user_id", user.id),
        supabase.from("vehicles").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("bookings")
          .select("id, status, booking_date, customer_id", { count: "exact" })
          .eq("user_id", user.id)
          .gte("booking_date", format(dateRange.from, "yyyy-MM-dd"))
          .lte("booking_date", format(dateRange.to, "yyyy-MM-dd")),
        supabase.from("invoices")
          .select("total_amount, payment_status, created_at, customer_id")
          .eq("user_id", user.id)
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString()),
        supabase.from("services").select("id, is_active", { count: "exact" }).eq("user_id", user.id),
        supabase.from("job_cards")
          .select("status, check_in_time, check_out_time")
          .eq("user_id", user.id)
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString()),
        supabase.from("expenses")
          .select("amount, expense_date, category")
          .eq("user_id", user.id)
          .gte("expense_date", format(dateRange.from, "yyyy-MM-dd"))
          .lte("expense_date", format(dateRange.to, "yyyy-MM-dd")),
        supabase.from("reviews")
          .select("rating, created_at")
          .eq("user_id", user.id)
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString())
      ]);

      const totalRevenue = invoices.data?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      const paidRevenue = invoices.data?.filter(inv => inv.payment_status === "paid").reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      const pendingRevenue = totalRevenue - paidRevenue;
      const totalExpenses = expenses.data?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

      const avgTicketSize = invoices.data?.length ? totalRevenue / invoices.data.length : 0;
      const conversionRate = bookings.data?.length ? (bookings.data.filter(b => b.status === "completed").length / bookings.data.length) * 100 : 0;
      
      const avgRating = reviews.data?.length 
        ? reviews.data.reduce((sum, r) => sum + r.rating, 0) / reviews.data.length 
        : 0;

      const customerBookings: Record<string, number> = {};
      bookings.data?.forEach(b => {
        customerBookings[b.customer_id] = (customerBookings[b.customer_id] || 0) + 1;
      });
      const repeatCustomers = Object.values(customerBookings).filter(c => c > 1).length;
      const retentionRate = Object.keys(customerBookings).length > 0 
        ? (repeatCustomers / Object.keys(customerBookings).length) * 100 
        : 0;

      return {
        totalCustomers: customers.count || 0,
        totalVehicles: vehicles.count || 0,
        totalBookings: bookings.count || 0,
        completedBookings: bookings.data?.filter(b => b.status === "completed").length || 0,
        cancelledBookings: bookings.data?.filter(b => b.status === "cancelled").length || 0,
        totalRevenue,
        paidRevenue,
        pendingRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        avgTicketSize,
        conversionRate,
        activeServices: services.data?.filter(s => s.is_active).length || 0,
        totalServices: services.count || 0,
        inProgressJobs: jobCards.data?.filter(j => j.status !== "completed" && j.status !== "delivered").length || 0,
        avgRating,
        totalReviews: reviews.data?.length || 0,
        repeatCustomers,
        retentionRate
      };
    }
  });

  const { data: revenueData } = useQuery({
    queryKey: ["revenue-trend", dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("created_at, total_amount, payment_status")
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at");

      const grouped = data?.reduce((acc: any, inv) => {
        const date = format(new Date(inv.created_at), "MMM dd");
        if (!acc[date]) acc[date] = { date, paid: 0, pending: 0, total: 0 };
        if (inv.payment_status === "paid") {
          acc[date].paid += Number(inv.total_amount);
        } else {
          acc[date].pending += Number(inv.total_amount);
        }
        acc[date].total += Number(inv.total_amount);
        return acc;
      }, {});

      return Object.values(grouped || {});
    }
  });

  const { data: serviceData } = useQuery({
    queryKey: ["service-distribution", dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("services")
        .gte("booking_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("booking_date", format(dateRange.to, "yyyy-MM-dd"));

      const serviceCounts: any = {};
      
      data?.forEach(booking => {
        if (Array.isArray(booking.services)) {
          booking.services.forEach((service: any) => {
            serviceCounts[service.name] = (serviceCounts[service.name] || 0) + 1;
          });
        }
      });

      return Object.entries(serviceCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, 8);
    }
  });

  const { data: expenseBreakdown } = useQuery({
    queryKey: ["expense-breakdown", dateRange],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data } = await supabase
        .from("expenses")
        .select("category, amount")
        .eq("user_id", user.id)
        .gte("expense_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("expense_date", format(dateRange.to, "yyyy-MM-dd"));

      const categoryTotals: Record<string, number> = {};
      data?.forEach(exp => {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + Number(exp.amount);
      });

      return Object.entries(categoryTotals)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    }
  });

  const { data: customerRetention } = useQuery({
    queryKey: ["customer-retention", dateRange],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const months = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(new Date(), i));
        const monthEnd = endOfMonth(subMonths(new Date(), i));
        months.push({ start: monthStart, end: monthEnd, label: format(monthStart, "MMM yyyy") });
      }

      const retentionData = await Promise.all(
        months.map(async ({ start, end, label }) => {
          const { data: bookings } = await supabase
            .from("bookings")
            .select("customer_id")
            .eq("user_id", user.id)
            .gte("booking_date", format(start, "yyyy-MM-dd"))
            .lte("booking_date", format(end, "yyyy-MM-dd"));

          const uniqueCustomers = new Set(bookings?.map(b => b.customer_id) || []);
          const customerBookings: Record<string, number> = {};
          bookings?.forEach(b => {
            customerBookings[b.customer_id] = (customerBookings[b.customer_id] || 0) + 1;
          });
          const repeatCustomers = Object.values(customerBookings).filter(c => c > 1).length;

          return {
            month: label,
            newCustomers: uniqueCustomers.size,
            repeatCustomers,
            retention: uniqueCustomers.size > 0 ? ((repeatCustomers / uniqueCustomers.size) * 100).toFixed(1) : 0
          };
        })
      );

      return retentionData;
    }
  });

  const { data: staffPerformance } = useQuery({
    queryKey: ["staff-performance", dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_cards")
        .select("assigned_staff_id, status, profiles(full_name)")
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .not("assigned_staff_id", "is", null);

      const staffStats: any = {};
      
      data?.forEach((job: any) => {
        const staffId = job.assigned_staff_id;
        const staffName = job.profiles?.full_name || "Unknown";
        if (!staffStats[staffId]) {
          staffStats[staffId] = { name: staffName, completed: 0, total: 0 };
        }
        staffStats[staffId].total++;
        if (job.status === "completed" || job.status === "delivered") {
          staffStats[staffId].completed++;
        }
      });

      return Object.values(staffStats).map((stat: any) => ({
        name: stat.name,
        completed: stat.completed,
        total: stat.total,
        rate: stat.total ? ((stat.completed / stat.total) * 100).toFixed(1) : 0
      }));
    }
  });

  const { data: ratingDistribution } = useQuery({
    queryKey: ["rating-distribution", dateRange],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data } = await supabase
        .from("reviews")
        .select("rating")
        .eq("user_id", user.id)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      const distribution = [1, 2, 3, 4, 5].map(star => ({
        rating: `${star} Star`,
        count: data?.filter(r => r.rating === star).length || 0,
        fill: star >= 4 ? "hsl(var(--success))" : star >= 3 ? "hsl(var(--warning))" : "hsl(var(--destructive))"
      }));

      return distribution;
    }
  });

  const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "#8884d8", "#82ca9d", "#ffc658", "#ff7c43", "#a855f7"];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <CarWashLoader text="Loading reports..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 min-h-screen overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground text-sm md:text-base">Comprehensive business insights and performance metrics</p>
          </div>
          <Button className="gap-2 shadow-md hover:shadow-lg w-full md:w-auto">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 shadow-sm w-full sm:w-auto justify-start">
                <CalendarIcon className="h-4 w-4" />
                <span className="truncate">{format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd, yyyy")}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => range?.from && range?.to && setDateRange({ from: range.from, to: range.to })}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-full sm:w-48 shadow-sm">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-muted/50 p-1 h-auto">
            <TabsTrigger value="overview" className="gap-2 px-4 py-2.5 data-[state=active]:bg-background">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="revenue" className="gap-2 px-4 py-2.5 data-[state=active]:bg-background">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Revenue</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-2 px-4 py-2.5 data-[state=active]:bg-background">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Customers</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2 px-4 py-2.5 data-[state=active]:bg-background">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Services</span>
            </TabsTrigger>
            <TabsTrigger value="staff" className="gap-2 px-4 py-2.5 data-[state=active]:bg-background">
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Staff</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              <Card className="shadow-sm hover:shadow-md transition-all border-l-4 border-l-primary">
                <CardHeader className="pb-2 px-3 md:px-4">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent className="px-3 md:px-4">
                  <div className="text-xl md:text-2xl font-bold text-primary">₹{stats?.totalRevenue?.toLocaleString()}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowUpRight className="h-3 w-3 text-success" />
                    <span className="text-xs text-success">+12%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm hover:shadow-md transition-all border-l-4 border-l-destructive">
                <CardHeader className="pb-2 px-3 md:px-4">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Expenses</CardTitle>
                </CardHeader>
                <CardContent className="px-3 md:px-4">
                  <div className="text-xl md:text-2xl font-bold text-destructive">₹{stats?.totalExpenses?.toLocaleString()}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowDownRight className="h-3 w-3 text-destructive" />
                    <span className="text-xs text-destructive">-5%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm hover:shadow-md transition-all border-l-4 border-l-success">
                <CardHeader className="pb-2 px-3 md:px-4">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
                </CardHeader>
                <CardContent className="px-3 md:px-4">
                  <div className="text-xl md:text-2xl font-bold text-success">₹{stats?.netProfit?.toLocaleString()}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowUpRight className="h-3 w-3 text-success" />
                    <span className="text-xs text-success">+18%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm hover:shadow-md transition-all border-l-4 border-l-accent">
                <CardHeader className="pb-2 px-3 md:px-4">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Avg Rating</CardTitle>
                </CardHeader>
                <CardContent className="px-3 md:px-4">
                  <div className="text-xl md:text-2xl font-bold text-accent">{stats?.avgRating?.toFixed(1) || "0"} ⭐</div>
                  <span className="text-xs text-muted-foreground">{stats?.totalReviews} reviews</span>
                </CardContent>
              </Card>

              <Card className="shadow-sm hover:shadow-md transition-all border-l-4 border-l-info col-span-2 md:col-span-1">
                <CardHeader className="pb-2 px-3 md:px-4">
                  <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Retention</CardTitle>
                </CardHeader>
                <CardContent className="px-3 md:px-4">
                  <div className="text-xl md:text-2xl font-bold text-info">{stats?.retentionRate?.toFixed(0)}%</div>
                  <span className="text-xs text-muted-foreground">{stats?.repeatCustomers} repeat</span>
                </CardContent>
              </Card>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <Card className="shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalCustomers}</p>
                    <p className="text-xs text-muted-foreground">Customers</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Car className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalVehicles}</p>
                    <p className="text-xs text-muted-foreground">Vehicles</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <CalendarIcon className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.completedBookings}/{stats?.totalBookings}</p>
                    <p className="text-xs text-muted-foreground">Bookings</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <Activity className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">₹{stats?.avgTicketSize?.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Avg Ticket</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Revenue Trend
                  </CardTitle>
                  <CardDescription>Daily revenue breakdown</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData}>
                        <defs>
                          <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="paid" stroke="hsl(var(--success))" fillOpacity={1} fill="url(#colorPaid)" name="Paid (₹)" />
                        <Area type="monotone" dataKey="pending" stroke="hsl(var(--warning))" fillOpacity={0.2} fill="hsl(var(--warning))" name="Pending (₹)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PieChartIcon className="h-5 w-5 text-destructive" />
                    Expense Breakdown
                  </CardTitle>
                  <CardDescription>By category</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseBreakdown}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {expenseBreakdown?.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => `₹${value.toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-6 text-center">
                  <DollarSign className="h-10 w-10 mx-auto mb-3 text-primary" />
                  <p className="text-3xl font-bold text-primary">₹{stats?.totalRevenue?.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">Total Revenue</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm bg-gradient-to-br from-success/5 to-success/10">
                <CardContent className="p-6 text-center">
                  <TrendingUp className="h-10 w-10 mx-auto mb-3 text-success" />
                  <p className="text-3xl font-bold text-success">₹{stats?.paidRevenue?.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">Collected</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm bg-gradient-to-br from-warning/5 to-warning/10">
                <CardContent className="p-6 text-center">
                  <TrendingDown className="h-10 w-10 mx-auto mb-3 text-warning" />
                  <p className="text-3xl font-bold text-warning">₹{stats?.pendingRevenue?.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">Pending</p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader className="border-b">
                <CardTitle>Revenue vs Expenses</CardTitle>
                <CardDescription>Daily comparison over the selected period</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="total" stroke="hsl(var(--success))" fillOpacity={1} fill="url(#colorRevenue)" name="Total Revenue (₹)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Repeat className="h-5 w-5 text-info" />
                    Customer Retention
                  </CardTitle>
                  <CardDescription>New vs returning customers by month</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={customerRetention}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="newCustomers" fill="hsl(var(--primary))" name="New" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="repeatCustomers" fill="hsl(var(--success))" name="Repeat" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-accent" />
                    Rating Distribution
                  </CardTitle>
                  <CardDescription>Customer feedback breakdown</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ratingDistribution} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="rating" type="category" tick={{ fontSize: 11 }} width={60} />
                        <Tooltip />
                        <Bar dataKey="count" name="Reviews" radius={[0, 4, 4, 0]}>
                          {ratingDistribution?.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Service Popularity
                </CardTitle>
                <CardDescription>Most booked services in the selected period</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serviceData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" name="Bookings" radius={[0, 8, 8, 0]}>
                        {serviceData?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Staff Tab */}
          <TabsContent value="staff" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  Staff Performance
                </CardTitle>
                <CardDescription>Jobs completed by staff members</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {staffPerformance && staffPerformance.length > 0 ? (
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={staffPerformance} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="completed" fill="hsl(var(--success))" name="Completed" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="total" fill="hsl(var(--muted))" name="Total Assigned" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No staff performance data available</p>
                    <p className="text-sm mt-1">Assign staff to job cards to track performance</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;