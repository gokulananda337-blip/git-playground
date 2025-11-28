import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Download, TrendingUp, Users, Car, DollarSign, Calendar as CalendarIcon, Package, Activity, TrendingDown, UserCheck } from "lucide-react";
import { useState } from "react";
import { format, subDays } from "date-fns";

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

      const [customers, vehicles, bookings, invoices, services, jobCards] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("vehicles").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("bookings")
          .select("id, status, booking_date", { count: "exact" })
          .eq("user_id", user.id)
          .gte("booking_date", format(dateRange.from, "yyyy-MM-dd"))
          .lte("booking_date", format(dateRange.to, "yyyy-MM-dd")),
        supabase.from("invoices")
          .select("total_amount, payment_status, created_at")
          .eq("user_id", user.id)
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString()),
        supabase.from("services").select("id, is_active", { count: "exact" }).eq("user_id", user.id),
        supabase.from("job_cards")
          .select("status, check_in_time, check_out_time")
          .eq("user_id", user.id)
          .gte("created_at", dateRange.from.toISOString())
          .lte("created_at", dateRange.to.toISOString())
      ]);

      const totalRevenue = invoices.data?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      const paidRevenue = invoices.data?.filter(inv => inv.payment_status === "paid").reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      const pendingRevenue = totalRevenue - paidRevenue;

      const avgTicketSize = invoices.data?.length ? totalRevenue / invoices.data.length : 0;
      const conversionRate = bookings.data?.length ? (bookings.data.filter(b => b.status === "completed").length / bookings.data.length) * 100 : 0;

      return {
        totalCustomers: customers.count || 0,
        totalVehicles: vehicles.count || 0,
        totalBookings: bookings.count || 0,
        completedBookings: bookings.data?.filter(b => b.status === "completed").length || 0,
        cancelledBookings: bookings.data?.filter(b => b.status === "cancelled").length || 0,
        totalRevenue,
        paidRevenue,
        pendingRevenue,
        avgTicketSize,
        conversionRate,
        activeServices: services.data?.filter(s => s.is_active).length || 0,
        totalServices: services.count || 0,
        inProgressJobs: jobCards.data?.filter(j => j.status !== "completed" && j.status !== "delivered").length || 0
      };
    }
  });

  const { data: revenueByDepartment } = useQuery({
    queryKey: ["revenue-by-department", dateRange],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: branches } = await supabase.from("branches").select("id, name").eq("user_id", user.id);
      if (!branches) return [];

      const revenueData = await Promise.all(
        branches.map(async (branch) => {
          const { data: invoices } = await supabase
            .from("invoices")
            .select("total_amount")
            .eq("user_id", user.id)
            .gte("created_at", dateRange.from.toISOString())
            .lte("created_at", dateRange.to.toISOString());

          const total = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
          return { name: branch.name, revenue: total };
        })
      );

      return revenueData;
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
        if (!acc[date]) acc[date] = { date, paid: 0, pending: 0 };
        if (inv.payment_status === "paid") {
          acc[date].paid += Number(inv.total_amount);
        } else {
          acc[date].pending += Number(inv.total_amount);
        }
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

      return Object.entries(serviceCounts).map(([name, value]) => ({ name, value }));
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

  const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "#8884d8", "#82ca9d", "#ffc658"];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 bg-gradient-to-br from-background via-muted/20 to-background min-h-screen">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">Business insights and performance metrics</p>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-md hover:shadow-lg transition-all border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">₹{stats?.totalRevenue.toFixed(2)}</div>
              <div className="flex items-center gap-2 mt-2">
                <div className="text-xs text-green-600 font-semibold">₹{stats?.paidRevenue.toFixed(2)} Paid</div>
                <div className="text-xs text-amber-600">₹{stats?.pendingRevenue.toFixed(2)} Pending</div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-all border-l-4 border-l-accent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Ticket Size</CardTitle>
              <TrendingUp className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">₹{stats?.avgTicketSize.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground mt-2">Per invoice average</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-all border-l-4 border-l-success">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Activity className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{stats?.conversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-2">Bookings completed</p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-all border-l-4 border-l-info">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
              <Package className="h-5 w-5 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-info">{stats?.inProgressJobs}</div>
              <p className="text-xs text-muted-foreground mt-2">In progress now</p>
            </CardContent>
          </Card>
        </div>

        {/* KPI Cards - Row 2 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <span className="text-green-600">{stats?.completedBookings} completed</span>
                <span className="text-red-600">{stats?.cancelledBookings} cancelled</span>
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-md hover:shadow-lg transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Services</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeServices}/{stats?.totalServices}</div>
              <p className="text-xs text-muted-foreground">Active services</p>
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
                <DollarSign className="h-5 w-5 text-primary" />
                Revenue by Department
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={revenueByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue (₹)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-md">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Service Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={serviceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {serviceData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
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
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={staffPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" fill="hsl(var(--success))" name="Completed" radius={[0, 8, 8, 0]} />
                  <Bar dataKey="total" fill="hsl(var(--muted))" name="Total Assigned" radius={[0, 8, 8, 0]} />
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