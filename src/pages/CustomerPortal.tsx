import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { FileText, Calendar as CalendarIcon, CreditCard, User, Car, Clock, CheckCircle2, Package, Star, MessageSquare } from "lucide-react";
import { format } from "date-fns";
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
  const [loading, setLoading] = useState(true);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedJobForReview, setSelectedJobForReview] = useState<any>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, feedback: "" });
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
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

      const [vehiclesRes, servicesRes, jobsRes, invoicesRes, reviewsRes] = await Promise.all([
        supabase.from("vehicles").select("*").eq("customer_id", customer.id),
        supabase.from("services").select("*").eq("is_active", true),
        supabase.from("job_cards").select(`*, vehicles (vehicle_number, vehicle_type, brand, model)`).eq("customer_id", customer.id).order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false }),
        supabase.from("reviews").select("*").eq("customer_id", customer.id)
      ]);

      setVehicles(vehiclesRes.data || []);
      setServices(servicesRes.data || []);
      setJobCards(jobsRes.data || []);
      setInvoices(invoicesRes.data || []);
      setReviews(reviewsRes.data || []);

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
      const { error } = await supabase.from("bookings").insert({
        customer_id: customerData.id,
        vehicle_id: bookingForm.vehicle_id,
        booking_date: bookingForm.booking_date,
        booking_time: bookingForm.booking_time,
        services: bookingForm.services,
        notes: bookingForm.notes,
        status: "pending",
        user_id: customerData.id
      });

      if (error) throw error;

      toast({ title: "Booking created!", description: "We'll contact you soon." });
      setBookingForm({ vehicle_id: "", booking_date: "", booking_time: "", services: [], notes: "" });
    } catch (error: any) {
      toast({ title: "Error creating booking", description: error.message, variant: "destructive" });
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
        user_id: customerData.id
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
      description: "Razorpay integration ready. Add RAZORPAY_KEY_ID in settings to enable payments." 
    });
    setPaymentLoading(null);
  };

  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00"
  ];

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md border">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Unable to load customer data</p>
            <Button onClick={() => navigate("/")} className="mt-4">Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasReviewedJob = (jobId: string) => reviews.some(r => r.job_card_id === jobId);

  return (
    <div className="min-h-screen bg-background">
      {/* Clean B&W Header */}
      <div className="bg-foreground border-b">
        <div className="container mx-auto px-4 md:px-6 py-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-background">
                Welcome back, {customerData.name}
              </h1>
              <p className="text-background/70 text-sm mt-1">
                Track services, view invoices, and manage bookings
              </p>
            </div>
            <div className="bg-background rounded-lg px-4 py-3 border">
              <div className="flex items-center gap-3">
                <div className="bg-foreground rounded-full p-2">
                  <User className="h-4 w-4 text-background" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{customerData.name}</p>
                  <p className="text-xs text-muted-foreground">{customerData.phone}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 md:px-6 py-6">
        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList className="bg-secondary border p-1">
            <TabsTrigger value="jobs" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background">
              <Package className="h-4 w-4" />
              Jobs ({jobCards.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background">
              <FileText className="h-4 w-4" />
              Invoices ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="booking" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background">
              <CalendarIcon className="h-4 w-4" />
              Book
            </TabsTrigger>
          </TabsList>

          {/* Job Cards Tab with Real-time Updates */}
          <TabsContent value="jobs" className="space-y-4">
            {jobCards.length === 0 ? (
              <Card className="border">
                <CardContent className="py-16 text-center">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground">No job cards found</p>
                </CardContent>
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
                  <Card key={job.id} className="border hover:shadow-md transition-all">
                    <CardHeader className="bg-secondary/50 border-b pb-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-foreground rounded-lg p-2">
                            <Car className="h-5 w-5 text-background" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{job.vehicles?.vehicle_number}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {job.vehicles?.brand} {job.vehicles?.model}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={cn("text-sm px-3 py-1", stageColors[job.status])}>
                            {job.status.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                          {isCompleted && !reviewed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedJobForReview(job);
                                setReviewDialogOpen(true);
                              }}
                              className="gap-1"
                            >
                              <Star className="h-3 w-3" />
                              Rate
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {job.check_in_time ? format(new Date(job.check_in_time), "MMM dd, yyyy 'at' hh:mm a") : "N/A"}
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2 text-xs uppercase text-muted-foreground tracking-wide">Services</h4>
                        <div className="flex flex-wrap gap-2">
                          {jobServices.map((service: any, idx: number) => (
                            <Badge key={idx} variant="outline" className="bg-background">
                              {service.name}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Live Progress Timeline */}
                      <div>
                        <h4 className="font-semibold mb-4 text-xs uppercase text-muted-foreground tracking-wide">Live Progress</h4>
                        <div className="relative pl-8">
                          {stages.map((stage, index) => {
                            const isStageCompleted = index <= currentIndex;
                            const isCurrent = index === currentIndex;
                            
                            return (
                              <div key={stage} className="relative pb-6 last:pb-0">
                                {index < stages.length - 1 && (
                                  <div className={cn(
                                    "absolute left-[-20px] top-5 w-0.5 h-full transition-colors duration-500",
                                    isStageCompleted ? "bg-color-green" : "bg-border"
                                  )} />
                                )}
                                
                                <div className="absolute left-[-26px] top-0">
                                  {isStageCompleted ? (
                                    <div className={cn(
                                      "w-4 h-4 rounded-full flex items-center justify-center transition-all duration-500",
                                      isCurrent ? "bg-color-green ring-4 ring-color-green/20 animate-pulse-slow" : "bg-color-green"
                                    )}>
                                      <CheckCircle2 className="h-3 w-3 text-white" />
                                    </div>
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border-2 border-border bg-background" />
                                  )}
                                </div>
                                
                                <div className={cn(
                                  "transition-all",
                                  isStageCompleted ? "text-foreground font-medium" : "text-muted-foreground"
                                )}>
                                  {stage.replace(/_/g, ' ').toUpperCase()}
                                  {isCurrent && (
                                    <span className="ml-2 text-xs text-color-green font-normal">(In Progress)</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Invoices Tab with Payment */}
          <TabsContent value="invoices" className="space-y-4">
            {invoices.length === 0 ? (
              <Card className="border">
                <CardContent className="py-16 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground">No invoices found</p>
                </CardContent>
              </Card>
            ) : (
              invoices.map((invoice) => (
                <Card key={invoice.id} className="border hover:shadow-md transition-all">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-secondary rounded-lg p-3">
                          <FileText className="h-6 w-6 text-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold">{invoice.invoice_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(invoice.created_at), "MMM dd, yyyy")}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-color-blue">₹{Number(invoice.total_amount).toLocaleString()}</p>
                          <Badge className={cn(
                            "mt-1",
                            invoice.payment_status === "paid" ? "bg-color-green text-white" :
                            invoice.payment_status === "partial" ? "bg-color-orange text-white" :
                            "bg-color-red text-white"
                          )}>
                            {invoice.payment_status.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => downloadInvoice(invoice)}>
                            Download
                          </Button>
                          {invoice.payment_status !== "paid" && (
                            <Button 
                              size="sm" 
                              onClick={() => initiatePayment(invoice)}
                              disabled={paymentLoading === invoice.id}
                              className="bg-color-green hover:bg-color-green/90"
                            >
                              <CreditCard className="h-4 w-4 mr-1" />
                              {paymentLoading === invoice.id ? "Processing..." : "Pay Now"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Booking Tab */}
          <TabsContent value="booking">
            <Card className="border">
              <CardHeader className="border-b bg-secondary/30">
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Book a Service
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Select Vehicle</Label>
                    <Select value={bookingForm.vehicle_id} onValueChange={(v) => setBookingForm({...bookingForm, vehicle_id: v})}>
                      <SelectTrigger className="border">
                        <SelectValue placeholder="Choose your vehicle" />
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
                    <Label className="text-sm font-medium">Select Time</Label>
                    <Select value={bookingForm.booking_time} onValueChange={(v) => setBookingForm({...bookingForm, booking_time: v})}>
                      <SelectTrigger className="border">
                        <SelectValue placeholder="Choose time slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((slot) => (
                          <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Select Date</Label>
                  <div className="border rounded-lg p-4 bg-background">
                    <Calendar
                      mode="single"
                      selected={bookingForm.booking_date ? new Date(bookingForm.booking_date) : undefined}
                      onSelect={(date) => date && setBookingForm({...bookingForm, booking_date: format(date, "yyyy-MM-dd")})}
                      disabled={(date) => date < new Date()}
                      className="mx-auto"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Select Services</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {services.map((service) => {
                      const isSelected = bookingForm.services.some(s => s.id === service.id);
                      return (
                        <div
                          key={service.id}
                          onClick={() => {
                            if (isSelected) {
                              setBookingForm({...bookingForm, services: bookingForm.services.filter(s => s.id !== service.id)});
                            } else {
                              setBookingForm({...bookingForm, services: [...bookingForm.services, { id: service.id, name: service.name, price: service.base_price, lifecycle_stages: service.lifecycle_stages }]});
                            }
                          }}
                          className={cn(
                            "p-4 rounded-lg border cursor-pointer transition-all",
                            isSelected ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/50"
                          )}
                        >
                          <p className="font-medium text-sm">{service.name}</p>
                          <p className="text-color-blue font-semibold">₹{service.base_price}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  onClick={createBooking}
                  disabled={!bookingForm.vehicle_id || !bookingForm.booking_date || !bookingForm.booking_time || bookingForm.services.length === 0}
                  className="w-full"
                  size="lg"
                >
                  Confirm Booking
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-color-yellow" />
              Rate Your Service
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewForm({...reviewForm, rating: star})}
                    className="focus:outline-none"
                  >
                    <Star
                      className={cn(
                        "h-8 w-8 transition-colors",
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
                className="border"
              />
            </div>
            <Button onClick={submitReview} className="w-full">
              <MessageSquare className="h-4 w-4 mr-2" />
              Submit Review
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerPortal;
