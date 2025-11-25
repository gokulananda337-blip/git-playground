import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Download, TrendingUp, Users, Car, DollarSign, Calendar } from "lucide-react";
import { useState } from "react";

const Reports = () => {
  const [period, setPeriod] = useState("7");

  const { data: stats } = useQuery({
    queryKey: ["reports-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [customers, vehicles, bookings, invoices] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("vehicles").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("bookings").select("id, status", { count: "exact" }).eq("user_id", user.id),
        supabase.from("invoices").select("total_amount, payment_status").eq("user_id", user.id)
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

  const { data: revenueData } = useQuery({
    queryKey: ["revenue-trend", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("created_at, total_amount")
        .gte("created_at", new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at");

      const grouped = data?.reduce((acc: any, inv) => {
        const date = new Date(inv.created_at).toLocaleDateString();
        if (!acc[date]) acc[date] = 0;
        acc[date] += Number(inv.total_amount);
        return acc;
      }, {});

      return Object.entries(grouped || {}).map(([date, amount]) => ({ date, amount }));
    }
  });

  const { data: serviceData } = useQuery({
    queryKey: ["service-distribution"],
    queryFn: async () => {
      const { data } = await supabase.from("bookings").select("services");
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
              <Calendar className="h-4 w-4 text-muted-foreground" />
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
              <div className="flex items-center justify-between">
                <CardTitle>Revenue Trend</CardTitle>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
      </div>
    </DashboardLayout>
  );
};

export default Reports;
