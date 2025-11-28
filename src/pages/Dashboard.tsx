import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Car, Calendar, IndianRupee, TrendingUp, Clock } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

interface Stats {
  totalCustomers: number;
  totalVehicles: number;
  todayBookings: number;
  monthlyRevenue: number;
  todayRevenue: number;
  pendingJobs: number;
  todayDueCars: number;
  timeSlotsAvailable: number;
  timeSlotsFilled: number;
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
    timeSlotsAvailable: 0,
    timeSlotsFilled: 0,
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split("T")[0];

      const { data: customers } = await supabase
        .from("customers")
        .select("id", { count: "exact" });

      const { data: vehicles } = await supabase
        .from("vehicles")
        .select("id", { count: "exact" });

      const { data: todayBookings } = await supabase
        .from("bookings")
        .select("id", { count: "exact" })
        .eq("booking_date", today);

      const { data: invoices } = await supabase
        .from("invoices")
        .select("total_amount")
        .gte("created_at", firstDayOfMonth)
        .eq("payment_status", "paid");

      const { data: todayInvoices } = await supabase
        .from("invoices")
        .select("total_amount")
        .gte("created_at", today)
        .eq("payment_status", "paid");

      const { data: pendingJobs } = await supabase
        .from("job_cards")
        .select("id", { count: "exact" })
        .neq("status", "completed")
        .neq("status", "delivered");

      const { data: todayDueBookings } = await supabase
        .from("bookings")
        .select("id", { count: "exact" })
        .eq("booking_date", today)
        .in("status", ["confirmed", "pending"]);

      // Calculate time slots (assuming 9 AM to 6 PM, 30 min slots = 18 slots per day)
      const totalSlots = 18;
      const filledSlots = todayBookings?.length || 0;
      const availableSlots = Math.max(0, totalSlots - filledSlots);

      const monthlyRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
      const todayRevenue = todayInvoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

      setStats({
        totalCustomers: customers?.length || 0,
        totalVehicles: vehicles?.length || 0,
        todayBookings: todayBookings?.length || 0,
        monthlyRevenue,
        todayRevenue,
        pendingJobs: pendingJobs?.length || 0,
        todayDueCars: todayDueBookings?.length || 0,
        timeSlotsAvailable: availableSlots,
        timeSlotsFilled: filledSlots,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Customers",
      value: stats.totalCustomers,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Total Vehicles",
      value: stats.totalVehicles,
      icon: Car,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Today's Bookings",
      value: stats.todayBookings,
      icon: Calendar,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Monthly Revenue",
      value: `₹${stats.monthlyRevenue.toLocaleString()}`,
      icon: IndianRupee,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Today's Revenue",
      value: `₹${stats.todayRevenue.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Pending Jobs",
      value: stats.pendingJobs,
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Today's Due Cars",
      value: stats.todayDueCars,
      icon: Car,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Available Slots",
      value: `${stats.timeSlotsAvailable}/${stats.timeSlotsFilled + stats.timeSlotsAvailable}`,
      icon: Clock,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  const [todayBookings, setTodayBookings] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    
    const subscription = supabase
      .channel('today-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `booking_date=eq.${today}`
        },
        () => {
          fetchTodayBookings();
        }
      )
      .subscribe();

    fetchTodayBookings();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchTodayBookings = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("bookings")
      .select(`
        *,
        customers (name, phone),
        vehicles (vehicle_number, brand, model)
      `)
      .eq("booking_date", today)
      .order("booking_time", { ascending: true });
    
    if (data) setTodayBookings(data);
  };

  const startJobCard = async (booking: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if job card exists
    const { data: existing } = await supabase
      .from("job_cards")
      .select("id")
      .eq("booking_id", booking.id)
      .maybeSingle();

    if (existing) {
      navigate('/job-cards');
      return;
    }

    // Create job card
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

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20 p-8 rounded-lg">
          <h1 className="text-3xl font-bold mb-2 text-foreground">Welcome to AutoWash Pro</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-all hover:scale-105 border border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${stat.color}`}>
                    {loading ? (
                      <div className="h-9 w-28 bg-muted animate-pulse rounded"></div>
                    ) : (
                      stat.value
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Today's Bookings Timeline */}
        <Card className="border-border/50">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Today's Schedule - {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {todayBookings.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No bookings scheduled for today</p>
                <Button className="mt-4" size="sm" onClick={() => navigate('/bookings')}>
                  Create Booking
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {todayBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all">
                    <div className="flex items-center gap-2 min-w-24 bg-primary/10 px-3 py-2 rounded-md">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-primary">{booking.booking_time}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-semibold text-foreground">{booking.customers?.name}</p>
                        <p className="text-sm text-muted-foreground">{booking.customers?.phone}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{booking.vehicles?.vehicle_number}</p>
                        <p className="text-sm text-muted-foreground">{booking.vehicles?.brand} {booking.vehicles?.model}</p>
                      </div>
                    </div>
                    <Button onClick={() => startJobCard(booking)} className="shadow-md">
                      Start Job
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-border/50" onClick={() => navigate('/invoices')}>
            <CardHeader className="border-b bg-success/5">
              <CardTitle className="flex items-center gap-2 text-success">
                <TrendingUp className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">
                View your latest invoices and transactions
              </p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-border/50"
            onClick={() => navigate('/job-cards')}
          >
            <CardHeader className="border-b bg-warning/5">
              <CardTitle className="flex items-center gap-2 text-warning">
                <Clock className="h-5 w-5" />
                Pending Jobs
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-4xl font-bold text-warning mb-2">
                {stats.pendingJobs}
              </div>
              <p className="text-sm text-muted-foreground">
                Track ongoing job cards
              </p>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer border-border/50"
            onClick={() => navigate('/bookings')}
          >
            <CardHeader className="border-b bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Calendar className="h-5 w-5" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-4xl font-bold text-primary mb-2">
                {stats.todayDueCars}
              </div>
              <p className="text-sm text-muted-foreground">
                Due today - manage bookings
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
