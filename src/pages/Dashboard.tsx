import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Car, Calendar, IndianRupee, TrendingUp, Clock, Star, FileText } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

interface Stats {
  totalCustomers: number;
  totalVehicles: number;
  todayBookings: number;
  monthlyRevenue: number;
  todayRevenue: number;
  pendingJobs: number;
  todayDueCars: number;
  avgRating: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    totalVehicles: 0,
    todayBookings: 0,
    monthlyRevenue: 0,
    todayRevenue: 0,
    pendingJobs: 0,
    todayDueCars: 0,
    avgRating: 0,
  });
  const [loading, setLoading] = useState(true);
  const [todayBookings, setTodayBookings] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
    fetchTodayBookings();
    
    const today = new Date().toISOString().split("T")[0];
    const subscription = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `booking_date=eq.${today}` }, () => fetchTodayBookings())
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

      const [customers, vehicles, todayBookingsRes, invoices, todayInvoices, pendingJobs, todayDueBookings, reviews] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact" }),
        supabase.from("vehicles").select("id", { count: "exact" }),
        supabase.from("bookings").select("id", { count: "exact" }).eq("booking_date", today),
        supabase.from("invoices").select("total_amount").gte("created_at", firstDayOfMonth).eq("payment_status", "paid"),
        supabase.from("invoices").select("total_amount").gte("created_at", today).eq("payment_status", "paid"),
        supabase.from("job_cards").select("id", { count: "exact" }).neq("status", "completed").neq("status", "delivered"),
        supabase.from("bookings").select("id", { count: "exact" }).eq("booking_date", today).in("status", ["confirmed", "pending"]),
        supabase.from("reviews").select("rating")
      ]);

      const monthlyRevenue = invoices.data?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      const todayRevenue = todayInvoices.data?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      const avgRating = reviews.data?.length ? (reviews.data.reduce((sum, r) => sum + r.rating, 0) / reviews.data.length) : 0;

      setStats({
        totalCustomers: customers?.data?.length || 0,
        totalVehicles: vehicles?.data?.length || 0,
        todayBookings: todayBookingsRes?.data?.length || 0,
        monthlyRevenue,
        todayRevenue,
        pendingJobs: pendingJobs?.data?.length || 0,
        todayDueCars: todayDueBookings?.data?.length || 0,
        avgRating: Number(avgRating.toFixed(1)),
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayBookings = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("bookings")
      .select(`*, customers (name, phone), vehicles (vehicle_number, brand, model)`)
      .eq("booking_date", today)
      .order("booking_time", { ascending: true });
    if (data) setTodayBookings(data);
  };

  const startJobCard = async (booking: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase.from("job_cards").select("id").eq("booking_id", booking.id).maybeSingle();
    if (existing) { navigate('/job-cards'); return; }

    await supabase.from("job_cards").insert({
      user_id: user.id,
      booking_id: booking.id,
      customer_id: booking.customer_id,
      vehicle_id: booking.vehicle_id,
      services: booking.services,
      status: "check_in",
      check_in_time: new Date().toISOString()
    });
    navigate('/job-cards');
  };

  const statCards = [
    { title: "Total Customers", value: stats.totalCustomers, icon: Users, color: "text-color-blue", bgColor: "bg-color-blue/10" },
    { title: "Total Vehicles", value: stats.totalVehicles, icon: Car, color: "text-color-purple", bgColor: "bg-color-purple/10" },
    { title: "Today's Bookings", value: stats.todayBookings, icon: Calendar, color: "text-color-orange", bgColor: "bg-color-orange/10" },
    { title: "Monthly Revenue", value: `₹${stats.monthlyRevenue.toLocaleString()}`, icon: IndianRupee, color: "text-color-green", bgColor: "bg-color-green/10" },
    { title: "Today's Revenue", value: `₹${stats.todayRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-color-cyan", bgColor: "bg-color-cyan/10" },
    { title: "Pending Jobs", value: stats.pendingJobs, icon: Clock, color: "text-color-red", bgColor: "bg-color-red/10" },
    { title: "Due Today", value: stats.todayDueCars, icon: FileText, color: "text-color-pink", bgColor: "bg-color-pink/10" },
    { title: "Avg Rating", value: stats.avgRating > 0 ? `${stats.avgRating} ★` : "N/A", icon: Star, color: "text-color-yellow", bgColor: "bg-color-yellow/10" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Welcome Section */}
        <div className="bg-foreground text-background p-8 rounded-lg">
          <h1 className="text-3xl font-bold mb-1">Welcome to AutoWash Pro</h1>
          <p className="text-background/70">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="border hover:shadow-md transition-all">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stat.color}`}>
                    {loading ? <div className="h-8 w-20 bg-muted animate-pulse rounded" /> : stat.value}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Today's Schedule */}
        <Card className="border">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Today's Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {todayBookings.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground">No bookings scheduled for today</p>
                <Button className="mt-4" size="sm" onClick={() => navigate('/bookings')}>Create Booking</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {todayBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center gap-4 p-4 rounded-lg border hover:bg-secondary/50 transition-all">
                    <div className="bg-foreground text-background px-3 py-2 rounded-md text-sm font-semibold min-w-[70px] text-center">
                      {booking.booking_time}
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-semibold">{booking.customers?.name}</p>
                        <p className="text-sm text-muted-foreground">{booking.customers?.phone}</p>
                      </div>
                      <div>
                        <p className="font-semibold">{booking.vehicles?.vehicle_number}</p>
                        <p className="text-sm text-muted-foreground">{booking.vehicles?.brand} {booking.vehicles?.model}</p>
                      </div>
                    </div>
                    <Button onClick={() => startJobCard(booking)} size="sm">
                      Start Job
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/invoices')}>
            <CardHeader className="border-b bg-color-green/5">
              <CardTitle className="flex items-center gap-2 text-color-green text-base">
                <TrendingUp className="h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">View latest invoices and transactions</p>
            </CardContent>
          </Card>

          <Card className="border cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/job-cards')}>
            <CardHeader className="border-b bg-color-orange/5">
              <CardTitle className="flex items-center gap-2 text-color-orange text-base">
                <Clock className="h-4 w-4" />
                Pending Jobs
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-3xl font-bold text-color-orange mb-1">{stats.pendingJobs}</div>
              <p className="text-sm text-muted-foreground">Track ongoing job cards</p>
            </CardContent>
          </Card>

          <Card className="border cursor-pointer hover:shadow-md transition-all" onClick={() => navigate('/staff')}>
            <CardHeader className="border-b bg-color-purple/5">
              <CardTitle className="flex items-center gap-2 text-color-purple text-base">
                <Users className="h-4 w-4" />
                Staff
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Manage team and performance</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
