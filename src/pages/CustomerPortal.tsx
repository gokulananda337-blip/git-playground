import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, Calendar as CalendarIcon, CreditCard, User, Car, Clock, 
  CheckCircle2, Package, Star, MessageSquare, Plus, Settings, Home, Wrench
} from "lucide-react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";

interface CustomerData {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
}

const CustomerPortal = () => {
  const [searchParams] = useSearchParams();
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [jobCards, setJobCards] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [selectedJobForReview, setSelectedJobForReview] = useState<any>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, feedback: "" });
  const [vehicleForm, setVehicleForm] = useState({
    vehicle_number: "",
    vehicle_type: "sedan" as const,
    brand: "",
    model: "",
    color: ""
  });
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("home");
  const { toast } = useToast();
  const navigate = useNavigate();

  const [bookingForm, setBookingForm] = useState({
    vehicle_id: "",
    booking_date: "",
    booking_time: "",
    services: [] as any[],
    notes: ""
  });

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      toast({ title: "Invalid access", description: "No access token provided", variant: "destructive" });
      navigate("/");
      return;
    }
    fetchCustomerData(token);
    setupRealtimeSubscription();
  }, [token]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('customer-portal-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'job_cards' },
        (payload) => {
          setJobCards(prev => prev.map(job => 
            job.id === payload.new.id ? { ...job, ...payload.new } : job
          ));
          toast({
            title: "Job Status Updated",
            description: `Your service is now: ${(payload.new as any).status?.replace(/_/g, ' ').toUpperCase()}`,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'invoices' },
        (payload) => {
          setInvoices(prev => prev.map(inv => 
            inv.id === payload.new.id ? { ...inv, ...payload.new } : inv
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchCustomerData = async (accessToken: string) => {
    try {
      const { data: portalAccess, error: accessError } = await supabase
        .from("customer_portal_access")
        .select("customer_id")
        .eq("access_token", accessToken)
        .eq("is_active", true)
        .single();

      if (accessError || !portalAccess) {
        toast({ title: "Invalid or expired link", variant: "destructive" });
        navigate("/");
        return;
      }

      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("id", portalAccess.customer_id)
        .single();

      if (!customer) {
        toast({ title: "Error loading customer data", variant: "destructive" });
        return;
      }

      setCustomerData(customer);

      const [vehiclesRes, servicesRes, jobsRes, invoicesRes, reviewsRes, bookingsRes, allBookingsRes] = await Promise.all([
        supabase.from("vehicles").select("*").eq("customer_id", customer.id),
        supabase.from("services").select("*").eq("is_active", true),
        supabase.from("job_cards").select(`*, vehicles (vehicle_number, vehicle_type, brand, model)`).eq("customer_id", customer.id).order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false }),
        supabase.from("reviews").select("*").eq("customer_id", customer.id),
        supabase.from("bookings").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false }),
        supabase.from("bookings").select("booking_date").gte("booking_date", format(new Date(), "yyyy-MM-dd"))
      ]);

      setVehicles(vehiclesRes.data || []);
      setServices(servicesRes.data || []);
      setJobCards(jobsRes.data || []);
      setInvoices(invoicesRes.data || []);
      setReviews(reviewsRes.data || []);
      setBookings(bookingsRes.data || []);
      
      // Get booked dates
      const bookedDatesList = allBookingsRes.data?.map(b => new Date(b.booking_date)) || [];
      setBookedDates(bookedDatesList);

      await supabase
        .from("customer_portal_access")
        .update({ last_login: new Date().toISOString() })
        .eq("access_token", accessToken);

    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const createBooking = async () => {
    if (!customerData) return;
    
    try {
      // Get the vehicle's user_id
      const selectedVehicle = vehicles.find(v => v.id === bookingForm.vehicle_id);
      if (!selectedVehicle) throw new Error("Vehicle not found");

      const { error } = await supabase.from("bookings").insert({
        customer_id: customerData.id,
        vehicle_id: bookingForm.vehicle_id,
        booking_date: bookingForm.booking_date,
        booking_time: bookingForm.booking_time,
        services: bookingForm.services,
        notes: bookingForm.notes,
        status: "pending",
        user_id: selectedVehicle.user_id
      });

      if (error) throw error;

      toast({ title: "Booking created!", description: "We'll contact you soon." });
      setBookingForm({ vehicle_id: "", booking_date: "", booking_time: "", services: [], notes: "" });
      
      // Refresh bookings
      const { data: newBookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("customer_id", customerData.id)
        .order("created_at", { ascending: false });
      setBookings(newBookings || []);
    } catch (error: any) {
      toast({ title: "Error creating booking", description: error.message, variant: "destructive" });
    }
  };

  const addVehicle = async () => {
    if (!customerData) return;
    
    try {
      // Get user_id from existing vehicle or customer
      const existingVehicle = vehicles[0];
      if (!existingVehicle) {
        toast({ title: "Error", description: "Cannot add vehicle without owner reference", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from("vehicles").insert({
        customer_id: customerData.id,
        user_id: existingVehicle.user_id,
        ...vehicleForm
      });

      if (error) throw error;

      toast({ title: "Vehicle added successfully!" });
      setVehicleDialogOpen(false);
      setVehicleForm({ vehicle_number: "", vehicle_type: "sedan", brand: "", model: "", color: "" });
      
      // Refresh vehicles
      const { data: newVehicles } = await supabase
        .from("vehicles")
        .select("*")
        .eq("customer_id", customerData.id);
      setVehicles(newVehicles || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const submitReview = async () => {
    if (!selectedJobForReview || !customerData) return;

    try {
      const { error } = await supabase.from("reviews").insert({
        customer_id: customerData.id,
        job_card_id: selectedJobForReview.id,
        rating: reviewForm.rating,
        feedback: reviewForm.feedback || null,
        user_id: selectedJobForReview.user_id
      });

      if (error) throw error;

      setReviews(prev => [...prev, { ...reviewForm, job_card_id: selectedJobForReview.id, created_at: new Date().toISOString() }]);
      toast({ title: "Thank you for your feedback!" });
      setReviewDialogOpen(false);
      setReviewForm({ rating: 5, feedback: "" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const initiatePayment = async (invoice: any) => {
    setPaymentLoading(invoice.id);
    toast({ 
      title: "Payment Gateway", 
      description: "Razorpay integration ready. Contact support to enable payments." 
    });
    setPaymentLoading(null);
  };

  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00"
  ];

  const getAvailableTimeSlots = () => {
    if (!bookingForm.booking_date) return timeSlots;
    
    const selectedDate = new Date(bookingForm.booking_date);
    const today = startOfDay(new Date());
    
    if (selectedDate.getTime() === today.getTime()) {
      const now = new Date();
      return timeSlots.filter(slot => {
        const [hours, minutes] = slot.split(":").map(Number);
        const slotTime = new Date();
        slotTime.setHours(hours, minutes, 0, 0);
        return slotTime > now;
      });
    }
    
    return timeSlots;
  };

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

  const downloadInvoice = (invoice: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', margin, 28);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`#${invoice.invoice_number}`, pageWidth - margin, 20, { align: 'right' });
    doc.text(`${format(new Date(invoice.created_at), 'MMM dd, yyyy')}`, pageWidth - margin, 28, { align: 'right' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', margin, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(customerData?.name || '', margin, 68);
    doc.text(customerData?.phone || '', margin, 75);

    let yPos = 95;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Service', margin, yPos + 8);
    doc.text('Amount', pageWidth - margin, yPos + 8, { align: 'right' });
    doc.line(margin, yPos + 12, pageWidth - margin, yPos + 12);

    yPos += 22;
    doc.setFont('helvetica', 'normal');
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    items.forEach((item: any) => {
      doc.text(item.name || 'Service', margin, yPos);
      doc.text(`₹${Number(item.price || 0).toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 8;
    });

    yPos += 10;
    doc.line(pageWidth - 80, yPos, pageWidth - margin, yPos);
    yPos += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Total:', pageWidth - 80, yPos);
    doc.text(`₹${Number(invoice.total_amount).toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });

    doc.save(`invoice-${invoice.invoice_number}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-foreground border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!customerData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Unable to load customer data</p>
            <Button onClick={() => navigate("/")} className="mt-4">Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasReviewedJob = (jobId: string) => reviews.some(r => r.job_card_id === jobId);
  const activeJobCards = jobCards.filter(j => j.status !== "delivered");
  const completedJobCards = jobCards.filter(j => j.status === "delivered" || j.status === "completed");

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Mobile Header */}
      <div className="bg-foreground sticky top-0 z-50">
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-background">Hi, {customerData.name.split(" ")[0]}</h1>
            <p className="text-xs text-background/70">{customerData.phone}</p>
          </div>
          <div className="bg-background rounded-full w-10 h-10 flex items-center justify-center">
            <User className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {activeTab === "home" && (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center p-3">
                <p className="text-2xl font-bold text-color-blue">{vehicles.length}</p>
                <p className="text-xs text-muted-foreground">Vehicles</p>
              </Card>
              <Card className="text-center p-3">
                <p className="text-2xl font-bold text-color-green">{activeJobCards.length}</p>
                <p className="text-xs text-muted-foreground">Active Jobs</p>
              </Card>
              <Card className="text-center p-3">
                <p className="text-2xl font-bold text-color-orange">{invoices.filter(i => i.payment_status !== "paid").length}</p>
                <p className="text-xs text-muted-foreground">Due</p>
              </Card>
            </div>

            {/* Active Job Cards */}
            {activeJobCards.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" /> Active Services
                </h3>
                <div className="space-y-3">
                  {activeJobCards.map((job) => {
                    const jobServices = Array.isArray(job.services) ? job.services : [];
                    const firstService = jobServices[0];
                    const stages = (firstService?.lifecycle_stages as string[]) || ["check_in", "completed", "delivered"];
                    const currentIndex = stages.indexOf(job.status);
                    const progress = ((currentIndex + 1) / stages.length) * 100;

                    return (
                      <Card key={job.id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{job.vehicles?.vehicle_number}</span>
                            </div>
                            <Badge className={stageColors[job.status]}>
                              {job.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          
                          <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
                            <div 
                              className="h-full bg-color-green transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{stages[0].replace(/_/g, " ")}</span>
                            <span>{stages[stages.length - 1].replace(/_/g, " ")}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Bookings */}
            {bookings.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" /> Recent Bookings
                </h3>
                <div className="space-y-2">
                  {bookings.slice(0, 3).map((booking) => (
                    <Card key={booking.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            {format(new Date(booking.booking_date), "MMM dd")} at {booking.booking_time}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {Array.isArray(booking.services) ? booking.services.map((s: any) => s.name).join(", ") : ""}
                          </p>
                        </div>
                        <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                          {booking.status}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "jobs" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Job Cards</h2>
            {jobCards.length === 0 ? (
              <Card className="p-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="text-muted-foreground">No job cards yet</p>
              </Card>
            ) : (
              jobCards.map((job) => {
                const jobServices = Array.isArray(job.services) ? job.services : [];
                const firstService = jobServices[0];
                const stages = (firstService?.lifecycle_stages as string[]) || ["check_in", "completed", "delivered"];
                const currentIndex = stages.indexOf(job.status);
                const isCompleted = job.status === "completed" || job.status === "delivered";
                const reviewed = hasReviewedJob(job.id);
                
                return (
                  <Card key={job.id} className="overflow-hidden">
                    <CardHeader className="pb-2 bg-secondary/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4" />
                          <span className="font-semibold">{job.vehicles?.vehicle_number}</span>
                        </div>
                        <Badge className={stageColors[job.status]}>
                          {job.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {job.check_in_time ? format(new Date(job.check_in_time), "MMM dd, hh:mm a") : "N/A"}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {jobServices.map((service: any, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {service.name}
                          </Badge>
                        ))}
                      </div>

                      {/* Progress */}
                      <div className="relative">
                        <div className="flex justify-between mb-1">
                          {stages.map((stage, index) => {
                            const isStageCompleted = index <= currentIndex;
                            return (
                              <div key={stage} className="flex flex-col items-center flex-1">
                                <div className={cn(
                                  "w-4 h-4 rounded-full flex items-center justify-center",
                                  isStageCompleted ? "bg-color-green" : "bg-secondary border"
                                )}>
                                  {isStageCompleted && <CheckCircle2 className="h-3 w-3 text-white" />}
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-1 text-center">
                                  {stage.replace(/_/g, " ")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {isCompleted && !reviewed && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setSelectedJobForReview(job);
                            setReviewDialogOpen(true);
                          }}
                        >
                          <Star className="h-4 w-4 mr-1" /> Rate Service
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {activeTab === "book" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Book a Service</h2>
            
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Select Vehicle</Label>
                  <Select value={bookingForm.vehicle_id} onValueChange={(v) => setBookingForm({...bookingForm, vehicle_id: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.vehicle_number} - {v.brand} {v.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Select Date</Label>
                  <Calendar
                    mode="single"
                    selected={bookingForm.booking_date ? new Date(bookingForm.booking_date) : undefined}
                    onSelect={(date) => date && setBookingForm({...bookingForm, booking_date: format(date, "yyyy-MM-dd"), booking_time: ""})}
                    disabled={(date) => {
                      const today = startOfDay(new Date());
                      return isBefore(date, today);
                    }}
                    className="rounded-md border mx-auto"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Select Time</Label>
                  <Select 
                    value={bookingForm.booking_time} 
                    onValueChange={(v) => setBookingForm({...bookingForm, booking_time: v})}
                    disabled={!bookingForm.booking_date}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose time" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableTimeSlots().map((slot) => (
                        <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Select Services</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {services.map((service) => {
                      const isSelected = bookingForm.services.some(s => s.id === service.id);
                      return (
                        <div
                          key={service.id}
                          onClick={() => {
                            if (isSelected) {
                              setBookingForm({...bookingForm, services: bookingForm.services.filter(s => s.id !== service.id)});
                            } else {
                              setBookingForm({...bookingForm, services: [...bookingForm.services, { 
                                id: service.id, 
                                name: service.name, 
                                price: service.base_price,
                                lifecycle_stages: service.lifecycle_stages
                              }]});
                            }
                          }}
                          className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center",
                            isSelected ? "border-foreground bg-foreground/5" : "border-border"
                          )}
                        >
                          <div>
                            <p className="font-medium text-sm">{service.name}</p>
                            <p className="text-xs text-muted-foreground">{service.duration_minutes} mins</p>
                          </div>
                          <p className="font-bold text-color-blue">₹{service.base_price}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  onClick={createBooking}
                  disabled={!bookingForm.vehicle_id || !bookingForm.booking_date || !bookingForm.booking_time || bookingForm.services.length === 0}
                  className="w-full"
                >
                  Confirm Booking
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Invoices</h2>
            {invoices.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="text-muted-foreground">No invoices yet</p>
              </Card>
            ) : (
              invoices.map((invoice) => (
                <Card key={invoice.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold">{invoice.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(invoice.created_at), "MMM dd, yyyy")}
                        </p>
                      </div>
                      <Badge className={cn(
                        invoice.payment_status === "paid" ? "bg-color-green text-white" :
                        invoice.payment_status === "partial" ? "bg-color-orange text-white" :
                        "bg-color-red text-white"
                      )}>
                        {invoice.payment_status}
                      </Badge>
                    </div>
                    
                    <p className="text-2xl font-bold text-color-blue mb-3">
                      ₹{Number(invoice.total_amount).toLocaleString()}
                    </p>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => downloadInvoice(invoice)}>
                        Download
                      </Button>
                      {invoice.payment_status !== "paid" && (
                        <Button 
                          size="sm" 
                          className="flex-1 bg-color-green hover:bg-color-green/90"
                          onClick={() => initiatePayment(invoice)}
                          disabled={paymentLoading === invoice.id}
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          Pay
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === "vehicles" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">My Vehicles</h2>
              {vehicles.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setVehicleDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              )}
            </div>
            
            {vehicles.length === 0 ? (
              <Card className="p-8 text-center">
                <Car className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="text-muted-foreground">No vehicles added</p>
              </Card>
            ) : (
              vehicles.map((vehicle) => (
                <Card key={vehicle.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-secondary rounded-lg p-3">
                        <Car className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{vehicle.vehicle_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {vehicle.brand} {vehicle.model}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="capitalize text-xs">
                            {vehicle.vehicle_type}
                          </Badge>
                          {vehicle.color && (
                            <Badge variant="outline" className="text-xs">
                              {vehicle.color}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Services List */}
            <h2 className="text-lg font-bold pt-4">Available Services</h2>
            <div className="grid gap-2">
              {services.map((service) => (
                <Card key={service.id}>
                  <CardContent className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{service.name}</p>
                      <p className="text-xs text-muted-foreground">{service.duration_minutes} mins</p>
                    </div>
                    <p className="font-bold text-color-blue">₹{service.base_price}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t md:hidden z-50">
        <div className="grid grid-cols-5 gap-1 p-2">
          {[
            { id: "home", icon: Home, label: "Home" },
            { id: "jobs", icon: Package, label: "Jobs" },
            { id: "book", icon: CalendarIcon, label: "Book" },
            { id: "invoices", icon: FileText, label: "Bills" },
            { id: "vehicles", icon: Car, label: "More" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center py-2 rounded-lg transition-colors",
                activeTab === tab.id ? "bg-foreground text-background" : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] mt-1">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Tabs */}
      <div className="hidden md:block fixed top-16 left-0 right-0 bg-background border-b z-40">
        <div className="container mx-auto px-4">
          <div className="flex gap-4">
            {[
              { id: "home", icon: Home, label: "Home" },
              { id: "jobs", icon: Package, label: "Job Cards" },
              { id: "book", icon: CalendarIcon, label: "Book Service" },
              { id: "invoices", icon: FileText, label: "Invoices" },
              { id: "vehicles", icon: Car, label: "Vehicles & Services" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 py-3 px-4 border-b-2 transition-colors",
                  activeTab === tab.id 
                    ? "border-foreground text-foreground font-medium" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-color-yellow" />
              Rate Your Service
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewForm({...reviewForm, rating: star})}
                    className="focus:outline-none"
                  >
                    <Star
                      className={cn(
                        "h-10 w-10 transition-colors",
                        star <= reviewForm.rating ? "fill-color-yellow text-color-yellow" : "text-muted-foreground"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Feedback (Optional)</Label>
              <Textarea
                placeholder="Share your experience..."
                value={reviewForm.feedback}
                onChange={(e) => setReviewForm({...reviewForm, feedback: e.target.value})}
              />
            </div>
            <Button onClick={submitReview} className="w-full">
              Submit Review
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Vehicle Dialog */}
      <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>Add Vehicle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vehicle Number *</Label>
              <Input
                placeholder="e.g., KA01AB1234"
                value={vehicleForm.vehicle_number}
                onChange={(e) => setVehicleForm({...vehicleForm, vehicle_number: e.target.value.toUpperCase()})}
              />
            </div>
            <div className="space-y-2">
              <Label>Vehicle Type</Label>
              <Select 
                value={vehicleForm.vehicle_type} 
                onValueChange={(v: any) => setVehicleForm({...vehicleForm, vehicle_type: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hatchback">Hatchback</SelectItem>
                  <SelectItem value="sedan">Sedan</SelectItem>
                  <SelectItem value="suv">SUV</SelectItem>
                  <SelectItem value="luxury">Luxury</SelectItem>
                  <SelectItem value="bike">Bike</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Brand</Label>
                <Input
                  placeholder="e.g., Toyota"
                  value={vehicleForm.brand}
                  onChange={(e) => setVehicleForm({...vehicleForm, brand: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  placeholder="e.g., Camry"
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm({...vehicleForm, model: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input
                placeholder="e.g., White"
                value={vehicleForm.color}
                onChange={(e) => setVehicleForm({...vehicleForm, color: e.target.value})}
              />
            </div>
            <Button 
              onClick={addVehicle} 
              className="w-full"
              disabled={!vehicleForm.vehicle_number}
            >
              Add Vehicle
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerPortal;
