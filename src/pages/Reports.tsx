import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, RadialBarChart, RadialBar } from "recharts";
import { Download, TrendingUp, Users, Car, DollarSign, Calendar as CalendarIcon, Package, Activity, TrendingDown, UserCheck, Star, Repeat, PieChart as PieChartIcon, BarChart3, Wallet } from "lucide-react";
import { useState } from "react";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";

const Reports = () => {
  const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 30), to: new Date() });
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

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

  const { data: stats } = useQuery({
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
      
      // Calculate average rating
      const avgRating = reviews.data?.length 
        ? reviews.data.reduce((sum, r) => sum + r.rating, 0) / reviews.data.length 
        : 0;

      // Calculate repeat customers (customers with more than 1 booking)
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

      // Get last 6 months of data
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

  const { data: serviceTrends } = useQuery({
    queryKey: ["service-trends", dateRange],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get last 4 weeks
      const weeks = [];
      for (let i = 3; i >= 0; i--) {
        const weekStart = subDays(new Date(), (i + 1) * 7);
        const weekEnd = subDays(new Date(), i * 7);
        weeks.push({ start: weekStart, end: weekEnd, label: `Week ${4 - i}` });
      }

      const trendData = await Promise.all(
        weeks.map(async ({ start, end, label }) => {
          const { data: bookings } = await supabase
            .from("bookings")
            .select("services")
            .eq("user_id", user.id)
            .gte("booking_date", format(start, "yyyy-MM-dd"))
            .lte("booking_date", format(end, "yyyy-MM-dd"));

          let totalServices = 0;
          bookings?.forEach(b => {
            if (Array.isArray(b.services)) {
              totalServices += b.services.length;
            }
          });

          return {
            week: label,
            bookings: bookings?.length || 0,
            services: totalServices
          };
        })
      );

      return trendData;
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

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 bg-gradient-to-br from-background via-muted/20 to-background min-h-screen">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">Comprehensive business insights and performance metrics</p>
          </div>
          <Button className="gap-2 shadow-md hover:shadow-lg">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>

        <div className="flex gap-4 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 shadow-sm">
                <CalendarIcon className="h-4 w-4" />
                {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd, yyyy")}
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
            <SelectTrigger className="w-48 shadow-sm">
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

        {/* KPI Cards - Row 1 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="shadow-md hover:shadow-lg transition-all border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">₹{stats?.totalRevenue?.toLocaleString()}</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="text-xs text-success font-semibold">₹{stats?.paidRevenue?.toLocaleString()} Paid</div>
                <div className="text-xs text-warning">₹{stats?.pendingRevenue?.toLocaleString()} Pending</div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-all border-l-4 border-l-destructive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <Wallet className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">₹{stats?.totalExpenses?.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-2">Business expenses</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-all border-l-4 border-l-success">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <TrendingUp className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">₹{stats?.netProfit?.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-2">Revenue - Expenses</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-all border-l-4 border-l-accent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
              <Star className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{stats?.avgRating?.toFixed(1) || "0"} ⭐</div>
              <p className="text-xs text-muted-foreground mt-2">{stats?.totalReviews} reviews</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-all border-l-4 border-l-info">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
              <Repeat className="h-5 w-5 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-info">{stats?.retentionRate?.toFixed(0)}%</div>
              <p className="text-xs text-muted-foreground mt-2">{stats?.repeatCustomers} repeat customers</p>
            </CardContent>
          </Card>
        </div>

        {/* KPI Cards - Row 2 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="shadow-md hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">Active customer base</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalVehicles}</div>
              <p className="text-xs text-muted-foreground">Registered vehicles</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bookings</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.completedBookings}/{stats?.totalBookings}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="text-success">{stats?.completedBookings} completed</span>
                <span className="text-destructive">{stats?.cancelledBookings} cancelled</span>
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Ticket Size</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats?.avgTicketSize?.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">Per invoice average</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.inProgressJobs}</div>
              <p className="text-xs text-muted-foreground">In progress now</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-md">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Revenue Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="paid" stroke="hsl(var(--success))" fillOpacity={1} fill="url(#colorPaid)" name="Paid (₹)" />
                  <Area type="monotone" dataKey="pending" stroke="hsl(var(--warning))" fillOpacity={1} fill="url(#colorPending)" name="Pending (₹)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-destructive" />
                Expense Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
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
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-md">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-info" />
                Customer Retention Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={customerRetention}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="newCustomers" fill="hsl(var(--primary))" name="New Customers" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="repeatCustomers" fill="hsl(var(--success))" name="Repeat Customers" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Service Popularity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={serviceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" name="Bookings" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 3 */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-md">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-accent" />
                Rating Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ratingDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="rating" type="category" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip />
                  <Bar dataKey="count" name="Reviews" radius={[0, 4, 4, 0]}>
                    {ratingDistribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Weekly Service Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={serviceTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="bookings" stroke="hsl(var(--primary))" strokeWidth={2} name="Bookings" />
                  <Line type="monotone" dataKey="services" stroke="hsl(var(--accent))" strokeWidth={2} name="Services" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                Staff Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={staffPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" fill="hsl(var(--success))" name="Completed" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="total" fill="hsl(var(--muted))" name="Total" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
