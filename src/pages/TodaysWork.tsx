import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Clock, User, Car, Calendar as CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

const TodaysWork = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const todayString = new Date().toISOString().split("T")[0];
  const selectedDateString = selectedDate.toISOString().split("T")[0];

  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"
  ];

  // Get current time for comparison
  const now = new Date();
  const currentTime = format(now, "HH:mm");
  const todayLocal = format(new Date(), "yyyy-MM-dd");
  const selectedDateLocal = format(selectedDate, "yyyy-MM-dd");
  const isToday = todayLocal === selectedDateLocal;

  const { data: bookings, refetch } = useQuery({
    queryKey: ["today-bookings", selectedDateLocal],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          customers (name, phone),
          vehicles (vehicle_number, vehicle_type, brand, model)
        `)
        .eq("booking_date", selectedDateLocal)
        .order("booking_time", { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    const subscription = supabase
      .channel('today-work')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `booking_date=eq.${selectedDateString}`
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedDateString, refetch]);

  const getBookingsForSlot = (slot: string) => {
    return bookings?.filter(b => b.booking_time === slot) || [];
  };

  const isSlotPast = (slot: string) => {
    if (!isToday) return false;
    return slot < currentTime;
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500",
    confirmed: "bg-blue-500",
    in_progress: "bg-purple-500",
    completed: "bg-green-500",
    cancelled: "bg-red-500"
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Today's Work</h1>
            <p className="text-muted-foreground">Time slot-based view of today's scheduled bookings</p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{format(selectedDate, "MMM dd, yyyy")}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-3">
        {timeSlots.map((slot) => {
            const slotBookings = getBookingsForSlot(slot);
            const isEmpty = slotBookings.length === 0;
            
            // Mark past slots for current day
            let isPast = false;
            if (selectedDateLocal === todayLocal) {
              const now = new Date();
              const [hours, minutes] = slot.split(":").map(Number);
              const slotTime = new Date();
              slotTime.setHours(hours, minutes, 0, 0);
              isPast = slotTime < now;
            }
            
            return (
              <Card key={slot} className={`${isEmpty ? "opacity-50" : "hover:shadow-md"} ${isPast ? "bg-muted/30" : ""} transition-shadow`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      <span className="text-lg font-bold">{slot}</span>
                      {isPast && <Badge variant="outline" className="text-xs">Past</Badge>}
                    </div>
                    {slotBookings.length > 0 && (
                      <Badge variant="secondary">{slotBookings.length} booking(s)</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isEmpty ? (
                    <p className="text-sm text-muted-foreground">No bookings</p>
                  ) : (
                    <div className="space-y-3">
                      {slotBookings.map((booking) => (
                        <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              <Badge className={`${statusColors[booking.status]} text-white capitalize`}>
                                {booking.status.replace("_", " ")}
                              </Badge>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium text-sm">{booking.customers?.name}</p>
                                  <p className="text-xs text-muted-foreground">{booking.customers?.phone}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Car className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium text-sm">{booking.vehicles?.vehicle_number}</p>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {booking.vehicles?.brand} {booking.vehicles?.model}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(booking.services) && booking.services.map((service: any, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">{service.name}</Badge>
                              ))}
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            onClick={() => navigate(`/job-cards?booking=${booking.id}`)}
                          >
                            View Job
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TodaysWork;
