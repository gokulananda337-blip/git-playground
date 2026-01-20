import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Truck, User, Car, Clock, MapPin, Calendar, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { CarWashLoader } from "@/components/CarWashLoader";
import { CarSVG, BubblesSVG } from "@/components/CarWashSVG";

const DoorStepService = () => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    booking_id: "",
    pickup_address: "",
    delivery_address: "",
    estimated_pickup_time: "",
    estimated_delivery_time: "",
    employee_name: "",
    notes: ""
  });

  const { data: doorStepServices, isLoading } = useQuery({
    queryKey: ["doorStepServices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("door_step_services")
        .select(`
          *,
          bookings (
            id,
            booking_date,
            booking_time,
            status,
            services
          ),
          customers (name, phone, address),
          vehicles (vehicle_number, vehicle_type, brand, model),
          profiles:assigned_staff_id (full_name, phone)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: availableBookings } = useQuery({
    queryKey: ["availableBookingsForDoorStep"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          customers (name, phone, address),
          vehicles (vehicle_number, brand, model)
        `)
        .in("status", ["pending", "confirmed"])
        .order("booking_date", { ascending: true });
      if (error) throw error;
      return data;
    }
  });


  const addDoorStepService = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const booking = availableBookings?.find(b => b.id === data.booking_id);
      if (!booking) throw new Error("Booking not found");

      const { error } = await supabase.from("door_step_services").insert({
        user_id: user.id,
        booking_id: data.booking_id,
        customer_id: booking.customer_id,
        vehicle_id: booking.vehicle_id,
        pickup_address: data.pickup_address || booking.customers?.address || "",
        delivery_address: data.delivery_address || data.pickup_address || booking.customers?.address || "",
        estimated_pickup_time: data.estimated_pickup_time ? new Date(data.estimated_pickup_time).toISOString() : null,
        estimated_delivery_time: data.estimated_delivery_time ? new Date(data.estimated_delivery_time).toISOString() : null,
        notes: data.employee_name ? `Employee: ${data.employee_name}\n${data.notes || ""}` : (data.notes || null),
        status: "scheduled"
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doorStepServices"] });
      queryClient.invalidateQueries({ queryKey: ["availableBookingsForDoorStep"] });
      toast({ title: "Door step service created successfully" });
      setIsAddOpen(false);
      setFormData({
        booking_id: "",
        pickup_address: "",
        delivery_address: "",
        estimated_pickup_time: "",
        estimated_delivery_time: "",
        employee_name: "",
        notes: ""
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, actualTime }: { id: string; status: string; actualTime?: string }) => {
      const updateData: any = { status };
      
      if (status === "picking_up") {
        updateData.pickup_time = new Date().toISOString();
      } else if (status === "delivering") {
        updateData.delivery_time = null; // Will set when delivered
      } else if (status === "completed") {
        updateData.delivery_time = new Date().toISOString();
      }

      const { error } = await supabase
        .from("door_step_services")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doorStepServices"] });
      toast({ title: "Status updated" });
    }
  });

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-500",
    picking_up: "bg-orange-500",
    in_service: "bg-purple-500",
    delivering: "bg-cyan-500",
    completed: "bg-green-500",
    cancelled: "bg-red-500"
  };

  const statusLabels: Record<string, string> = {
    scheduled: "Scheduled",
    picking_up: "Picking Up",
    in_service: "In Service",
    delivering: "Delivering",
    completed: "Completed",
    cancelled: "Cancelled"
  };

  const nextStatus: Record<string, string> = {
    scheduled: "picking_up",
    picking_up: "in_service",
    in_service: "delivering",
    delivering: "completed"
  };

  const selectedBooking = availableBookings?.find(b => b.id === formData.booking_id);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <CarWashLoader text="Loading door step services..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div className="relative">
            <div className="absolute -left-8 -top-4 text-primary opacity-10">
              <BubblesSVG className="w-24 h-24" />
            </div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Truck className="h-8 w-8 text-primary" />
              Door Step Service
            </h1>
            <p className="text-muted-foreground">Manage vehicle pickup and delivery services</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Door Step Service
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Door Step Service</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Select Booking *</Label>
                  <Select 
                    value={formData.booking_id} 
                    onValueChange={(value) => {
                      const booking = availableBookings?.find(b => b.id === value);
                      setFormData({ 
                        ...formData, 
                        booking_id: value,
                        pickup_address: booking?.customers?.address || ""
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a booking" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBookings?.map((booking) => (
                        <SelectItem key={booking.id} value={booking.id}>
                          {booking.booking_date} - {booking.customers?.name} - {booking.vehicles?.vehicle_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedBooking && (
                  <Card className="bg-secondary/30">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{selectedBooking.customers?.name}</span>
                        <span className="text-muted-foreground">- {selectedBooking.customers?.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedBooking.vehicles?.vehicle_number} - {selectedBooking.vehicles?.brand} {selectedBooking.vehicles?.model}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedBooking.booking_date} at {selectedBooking.booking_time}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pickup Address *</Label>
                    <Textarea
                      placeholder="Enter pickup address"
                      value={formData.pickup_address}
                      onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Delivery Address</Label>
                    <Textarea
                      placeholder="Same as pickup if empty"
                      value={formData.delivery_address}
                      onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estimated Pickup Time</Label>
                    <Input
                      type="datetime-local"
                      value={formData.estimated_pickup_time}
                      onChange={(e) => setFormData({ ...formData, estimated_pickup_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated Delivery Time</Label>
                    <Input
                      type="datetime-local"
                      value={formData.estimated_delivery_time}
                      onChange={(e) => setFormData({ ...formData, estimated_delivery_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Employee Name</Label>
                  <Input
                    placeholder="Enter employee name"
                    value={formData.employee_name}
                    onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Manually enter the employee responsible for pickup/delivery</p>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Any special instructions..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <Button
                  onClick={() => addDoorStepService.mutate(formData)}
                  disabled={!formData.booking_id || !formData.pickup_address || addDoorStepService.isPending}
                >
                  {addDoorStepService.isPending ? "Creating..." : "Create Door Step Service"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {["scheduled", "picking_up", "in_service", "delivering", "completed"].map((status) => {
            const count = doorStepServices?.filter(s => s.status === status).length || 0;
            return (
              <Card key={status} className="text-center">
                <CardContent className="pt-4">
                  <Badge className={`${statusColors[status]} text-white mb-2`}>
                    {statusLabels[status]}
                  </Badge>
                  <p className="text-2xl font-bold">{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Services List */}
        <div className="space-y-4">
          {doorStepServices?.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground">No door step services yet</p>
                <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
                  Create First Door Step Service
                </Button>
              </CardContent>
            </Card>
          ) : (
            doorStepServices?.map((service: any) => (
              <Card key={service.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className={`${statusColors[service.status]} text-white`}>
                          {statusLabels[service.status]}
                        </Badge>
                        {service.bookings && (
                          <Badge variant="outline">
                            Booking: {service.bookings.booking_date}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{service.customers?.name}</p>
                            <p className="text-xs text-muted-foreground">{service.customers?.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{service.vehicles?.vehicle_number}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {service.vehicles?.brand} {service.vehicles?.model}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Pickup</p>
                            <p className="text-sm">{service.pickup_address}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Delivery</p>
                            <p className="text-sm">{service.delivery_address || service.pickup_address}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {service.estimated_pickup_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Est. Pickup: {format(new Date(service.estimated_pickup_time), "MMM dd, hh:mm a")}</span>
                          </div>
                        )}
                        {service.estimated_delivery_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Est. Delivery: {format(new Date(service.estimated_delivery_time), "MMM dd, hh:mm a")}</span>
                          </div>
                        )}
                        {service.profiles && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>Assigned: {service.profiles.full_name}</span>
                          </div>
                        )}
                      </div>

                      {service.notes && (
                        <p className="text-sm text-muted-foreground border-t pt-2">{service.notes}</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      {service.status !== "completed" && service.status !== "cancelled" && (
                        <Button
                          size="sm"
                          onClick={() => updateStatus.mutate({ 
                            id: service.id, 
                            status: nextStatus[service.status] 
                          })}
                          disabled={updateStatus.isPending}
                        >
                          {statusLabels[nextStatus[service.status]]}
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                      {service.status !== "completed" && service.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateStatus.mutate({ id: service.id, status: "cancelled" })}
                          disabled={updateStatus.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoorStepService;
