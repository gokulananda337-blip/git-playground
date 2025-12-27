import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Car, Clock, Calendar as CalendarIcon, CheckCircle2, Package } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const BookingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          customers (name, phone, email),
          vehicles (vehicle_number, vehicle_type, brand, model)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: jobCard } = useQuery({
    queryKey: ["job-card-for-booking", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_cards")
        .select("*")
        .eq("booking_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*");
      if (error) throw error;
      return data;
    }
  });

  // Get lifecycle stages from selected services
  const getLifecycleStages = (): string[] => {
    if (!booking?.services || !Array.isArray(booking.services)) {
      return ["check_in", "pre_wash", "foam_wash", "interior", "polishing", "qc", "completed", "delivered"];
    }

    const bookingServiceIds = booking.services.map((s: any) => s.id);
    const matchingServices = services?.filter(s => bookingServiceIds.includes(s.id));
    
    if (matchingServices && matchingServices.length > 0) {
      const firstService = matchingServices[0];
      if (firstService.lifecycle_stages && Array.isArray(firstService.lifecycle_stages)) {
        return firstService.lifecycle_stages as string[];
      }
    }
    
    return ["check_in", "pre_wash", "foam_wash", "interior", "polishing", "qc", "completed", "delivered"];
  };

  const lifecycleStages = getLifecycleStages();
  const currentStageIndex = jobCard ? lifecycleStages.indexOf(jobCard.status) : -1;

  const updateJobCardStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!jobCard) {
        const { error } = await supabase.from("job_cards").insert({
          user_id: user.id,
          booking_id: id,
          customer_id: booking?.customer_id,
          vehicle_id: booking?.vehicle_id,
          services: booking?.services,
          status: newStatus as any,
          check_in_time: newStatus === "check_in" ? new Date().toISOString() : null
        });
        if (error) throw error;
      } else {
        const updateData: any = { status: newStatus };
        if (newStatus === "check_in") {
          updateData.check_in_time = new Date().toISOString();
        }
        if (newStatus === "delivered") {
          updateData.check_out_time = new Date().toISOString();
        }

        const { error } = await supabase
          .from("job_cards")
          .update(updateData)
          .eq("id", jobCard.id);
        if (error) throw error;
      }

      // Update booking status based on job card status
      type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
      let bookingStatus: BookingStatus = "confirmed";
      if (["check_in", "pre_wash", "foam_wash", "interior", "polishing", "qc"].includes(newStatus)) {
        bookingStatus = "in_progress";
      } else if (newStatus === "completed" || newStatus === "delivered") {
        bookingStatus = "completed";
      }

      const { error: bookingError } = await supabase
        .from("bookings")
        .update({ status: bookingStatus })
        .eq("id", id);
      if (bookingError) throw bookingError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["job-card-for-booking", id] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: "Status updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const stageColors: Record<string, string> = {
    check_in: "bg-color-blue text-white",
    pre_wash: "bg-color-cyan text-white",
    foam_wash: "bg-color-purple text-white",
    interior: "bg-color-pink text-white",
    polishing: "bg-color-orange text-white",
    qc: "bg-color-yellow text-foreground",
    completed: "bg-color-green text-white",
    delivered: "bg-color-green text-white"
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-foreground border-t-transparent"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!booking) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Booking not found</p>
              <Button onClick={() => navigate("/bookings")} className="mt-4">
                Back to Bookings
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/bookings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Booking Details</h1>
            <p className="text-muted-foreground">
              {format(new Date(booking.booking_date), "MMMM dd, yyyy")} at {booking.booking_time}
            </p>
          </div>
          <Badge className={cn("ml-auto", stageColors[jobCard?.status || "check_in"] || "bg-secondary")}>
            {(jobCard?.status || "pending").replace(/_/g, " ").toUpperCase()}
          </Badge>
        </div>

        {/* Customer & Vehicle Info */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-md">
            <CardHeader className="border-b bg-secondary/30 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              <p className="font-semibold text-lg">{booking.customers?.name}</p>
              <p className="text-muted-foreground">{booking.customers?.phone}</p>
              {booking.customers?.email && (
                <p className="text-muted-foreground text-sm">{booking.customers?.email}</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="border-b bg-secondary/30 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Car className="h-4 w-4" />
                Vehicle Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              <p className="font-semibold text-lg">{booking.vehicles?.vehicle_number}</p>
              <p className="text-muted-foreground">
                {booking.vehicles?.brand} {booking.vehicles?.model}
              </p>
              <Badge variant="outline" className="capitalize">
                {booking.vehicles?.vehicle_type}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Services */}
        <Card className="shadow-md">
          <CardHeader className="border-b bg-secondary/30 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Selected Services
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2">
              {Array.isArray(booking.services) && booking.services.map((service: any, idx: number) => (
                <Badge key={idx} variant="secondary" className="py-1.5 px-3">
                  {service.name} - ₹{service.price}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <Card className="shadow-md">
          <CardHeader className="border-b bg-secondary/30 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Service Lifecycle
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {lifecycleStages.map((stage, index) => {
                const isCompleted = index <= currentStageIndex;
                const isCurrent = index === currentStageIndex;
                const isNext = index === currentStageIndex + 1;

                return (
                  <div key={stage} className="flex flex-col items-center">
                    <button
                      onClick={() => {
                        if (isNext || (currentStageIndex === -1 && index === 0)) {
                          updateJobCardStatus.mutate(stage);
                        }
                      }}
                      disabled={!isNext && !(currentStageIndex === -1 && index === 0)}
                      className={cn(
                        "w-full p-4 rounded-lg border-2 transition-all text-center",
                        isCurrent && "ring-2 ring-color-green ring-offset-2 border-color-green",
                        isCompleted && !isCurrent && "bg-color-green/10 border-color-green",
                        !isCompleted && "border-border bg-secondary/30 hover:bg-secondary/50",
                        isNext && "border-dashed border-primary cursor-pointer hover:border-solid",
                        !isNext && !isCompleted && "cursor-not-allowed opacity-50"
                      )}
                    >
                      <div className="flex flex-col items-center gap-2">
                        {isCompleted ? (
                          <CheckCircle2 className="h-6 w-6 text-color-green" />
                        ) : (
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2",
                            isNext ? "border-primary" : "border-muted-foreground"
                          )} />
                        )}
                        <span className={cn(
                          "text-xs font-medium uppercase",
                          isCompleted ? "text-color-green" : "text-muted-foreground"
                        )}>
                          {stage.replace(/_/g, " ")}
                        </span>
                      </div>
                    </button>
                    {isCurrent && (
                      <Badge className="mt-2 bg-color-green text-white animate-pulse">
                        Current
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            {currentStageIndex === -1 && (
              <div className="mt-6 text-center">
                <p className="text-muted-foreground mb-3">Start the service process</p>
                <Button onClick={() => updateJobCardStatus.mutate("check_in")}>
                  Begin Check-in
                </Button>
              </div>
            )}

            {currentStageIndex >= 0 && currentStageIndex < lifecycleStages.length - 1 && (
              <div className="mt-6 text-center">
                <Button 
                  onClick={() => updateJobCardStatus.mutate(lifecycleStages[currentStageIndex + 1])}
                  className="bg-primary"
                >
                  Move to {lifecycleStages[currentStageIndex + 1].replace(/_/g, " ").toUpperCase()}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {booking.notes && (
          <Card className="shadow-md">
            <CardHeader className="border-b bg-secondary/30 pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-muted-foreground">{booking.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BookingDetail;
