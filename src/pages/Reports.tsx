import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Download, TrendingUp, Users, Car, DollarSign, Calendar as CalendarIcon } from "lucide-react";
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

      const [customers, vehicles, bookings, invoices] = await Promise.all([
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
          .lte("created_at", dateRange.to.toISOString())
      ]);

      const totalRevenue = invoices.data?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      const paidRevenue = invoices.data?.filter(inv => inv.payment_status === "paid").reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

      return {
        totalCustomers: customers.count || 0,
        totalVehicles: vehicles.count || 0,
        totalBookings: bookings.count || 0,
        completedBookings: bookings.data?.filter(b => b.status === "completed").length || 0,
        totalRevenue,
        paidRevenue
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
        .select("created_at, total_amount")
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at");

      const grouped = data?.reduce((acc: any, inv) => {
        const date = format(new Date(inv.created_at), "MMM dd");
        if (!acc[date]) acc[date] = 0;
        acc[date] += Number(inv.total_amount);
        return acc;
      }, {});

      return Object.entries(grouped || {}).map(([date, amount]) => ({ date, amount }));
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

  const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#8884d8", "#82ca9d", "#ffc658"];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">Business insights and performance metrics</p>
          </div>
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>

        <div className="flex gap-4 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
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
            <SelectTrigger className="w-48">
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">Active customer base</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalVehicles}</div>
              <p className="text-xs text-muted-foreground">Registered vehicles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bookings</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.completedBookings}/{stats?.totalBookings}</div>
              <p className="text-xs text-muted-foreground">Completed bookings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{stats?.paidRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Total: ₹{stats?.totalRevenue.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} name="Revenue (₹)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue by Department</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue (₹)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Service Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={serviceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
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
      </div>
    </DashboardLayout>
  );
};

export default Reports;