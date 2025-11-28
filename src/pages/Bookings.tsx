import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar as CalendarIcon, Clock, User, Car, Filter } from "lucide-react";
import { format } from "date-fns";

const Bookings = () => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    customer_id: "",
    vehicle_id: "",
    booking_date: "",
    booking_time: "",
    expected_end_time: "",
    services: [] as any[],
    notes: ""
  });

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("bookings")
        .select(`
          *,
          customers (name, phone),
          vehicles (vehicle_number, vehicle_type, brand, model)
        `)
        .order("booking_date", { ascending: false })
        .order("booking_time", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone")
        .order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles", formData.customer_id],
    queryFn: async () => {
      if (!formData.customer_id) return [];
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("customer_id", formData.customer_id);
      if (error) throw error;
      return data;
    },
    enabled: !!formData.customer_id
  });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    }
  });

  const addBooking = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("bookings").insert({
        ...data,
        user_id: user.id,
        status: "pending"
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: "Booking created successfully" });
      setIsAddOpen(false);
      setFormData({
        customer_id: "",
        vehicle_id: "",
        booking_date: "",
        booking_time: "",
        expected_end_time: "",
        services: [],
        notes: ""
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, booking }: { id: string; status: any; booking?: any }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", id);
      if (error) throw error;

      // Auto-create job card when status becomes "confirmed"
      if (status === "confirmed" && booking) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Check if job card already exists for this booking
        const { data: existingJobCard, error: existingJobCardError } = await supabase
          .from("job_cards")
          .select("id")
          .eq("booking_id", id)
          .maybeSingle();

        if (existingJobCardError) {
          console.error("Error checking existing job card:", existingJobCardError);
          throw existingJobCardError;
        }
        if (!existingJobCard) {
          const { error: jobCardError } = await supabase.from("job_cards").insert({
            user_id: user.id,
            booking_id: id,
            customer_id: booking.customer_id,
            vehicle_id: booking.vehicle_id,
            services: booking.services,
            status: "check_in",
            check_in_time: new Date().toISOString()
          });

          if (jobCardError) {
            console.error("Error creating job card:", jobCardError);
            throw jobCardError;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["jobCards"] });
      toast({ title: "Status updated" });
    }
  });

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500",
    confirmed: "bg-blue-500",
    in_progress: "bg-purple-500",
    completed: "bg-green-500",
    cancelled: "bg-red-500"
  };

  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Bookings</h1>
            <p className="text-muted-foreground">Manage appointments and reservations</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Booking
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Booking</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select value={formData.customer_id} onValueChange={(value) => setFormData({ ...formData, customer_id: value, vehicle_id: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} - {c.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.customer_id && (
                  <div className="space-y-2">
                    <Label>Vehicle *</Label>
                    <Select value={formData.vehicle_id} onValueChange={(value) => setFormData({ ...formData, vehicle_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles?.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.vehicle_number} - {v.brand} {v.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setFormData({ ...formData, booking_date: date ? format(date, "yyyy-MM-dd") : "" });
                      }}
                      disabled={(date) => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        yesterday.setHours(0, 0, 0, 0);
                        return date < yesterday;
                      }}
                      className="rounded-md border"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Start Time Slot *</Label>
                      <Select value={formData.booking_time} onValueChange={(value) => setFormData({ ...formData, booking_time: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select start time" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots
                            .filter((time) => {
                              const today = new Date().toISOString().split("T")[0];
                              if (formData.booking_date !== today) return true;
                              
                              const now = new Date();
                              const [hours, minutes] = time.split(":").map(Number);
                              const slotTime = new Date();
                              slotTime.setHours(hours, minutes, 0, 0);
                              
                              return slotTime > now;
                            })
                            .map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Expected End Time</Label>
                      <Select value={formData.expected_end_time} onValueChange={(value) => setFormData({ ...formData, expected_end_time: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select end time" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Services *</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                    {services?.map((service) => (
                      <label key={service.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.services.some(s => s.id === service.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const newServices = [...formData.services, { 
                                id: service.id, 
                                name: service.name, 
                                price: service.base_price,
                                duration: service.duration_minutes 
                              }];
                              
                              // Auto-calculate expected end time
                              if (formData.booking_time) {
                                const totalMinutes = newServices.reduce((sum, s) => sum + (s.duration || 0), 0);
                                const [hours, minutes] = formData.booking_time.split(":").map(Number);
                                const endTime = new Date();
                                endTime.setHours(hours, minutes + totalMinutes, 0, 0);
                                const expectedEnd = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
                                
                                setFormData({
                                  ...formData,
                                  services: newServices,
                                  expected_end_time: expectedEnd
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  services: newServices
                                });
                              }
                            } else {
                              const newServices = formData.services.filter(s => s.id !== service.id);
                              
                              // Recalculate expected end time
                              if (formData.booking_time && newServices.length > 0) {
                                const totalMinutes = newServices.reduce((sum, s) => sum + (s.duration || 0), 0);
                                const [hours, minutes] = formData.booking_time.split(":").map(Number);
                                const endTime = new Date();
                                endTime.setHours(hours, minutes + totalMinutes, 0, 0);
                                const expectedEnd = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;
                                
                                setFormData({
                                  ...formData,
                                  services: newServices,
                                  expected_end_time: expectedEnd
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  services: newServices,
                                  expected_end_time: ""
                                });
                              }
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{service.name} - ₹{service.base_price} ({service.duration_minutes}m)</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Any special requests..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <Button
                  onClick={() => addBooking.mutate(formData)}
                  disabled={!formData.customer_id || !formData.vehicle_id || !formData.booking_date || !formData.booking_time || formData.services.length === 0 || addBooking.isPending}
                >
                  {addBooking.isPending ? "Creating..." : "Create Booking"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bookings</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading bookings...</div>
            ) : bookings?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No bookings found</div>
            ) : (
              <div className="space-y-4">
                {bookings?.map((booking) => (
                  <Card key={booking.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3">
                            <Badge className={`${statusColors[booking.status]} text-white capitalize`}>
                              {booking.status.replace("_", " ")}
                            </Badge>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CalendarIcon className="h-4 w-4" />
                              {format(new Date(booking.booking_date), "MMM dd, yyyy")}
                              <Clock className="h-4 w-4 ml-2" />
                              {booking.booking_time}
                              {booking.expected_end_time && (
                                <span className="text-xs">→ {booking.expected_end_time}</span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{booking.customers?.name}</p>
                                <p className="text-xs text-muted-foreground">{booking.customers?.phone}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{booking.vehicles?.vehicle_number}</p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {booking.vehicles?.brand} {booking.vehicles?.model} - {booking.vehicles?.vehicle_type}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {Array.isArray(booking.services) && booking.services.map((service: any, idx: number) => (
                              <Badge key={idx} variant="secondary">{service.name}</Badge>
                            ))}
                          </div>
                          {booking.notes && (
                            <p className="text-sm text-muted-foreground border-t pt-2">{booking.notes}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          <Select
                            value={booking.status}
                            onValueChange={(value) => updateStatus.mutate({ id: booking.id, status: value as any, booking })}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => navigate(`/job-cards?booking=${booking.id}`)}
                          >
                            View Job Card
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Bookings;
