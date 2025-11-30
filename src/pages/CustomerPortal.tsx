import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { FileText, Calendar as CalendarIcon, CreditCard, User, Car, Clock, CheckCircle2, Package, Plus } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [bookingForm, setBookingForm] = useState({
    vehicle_id: "",
    booking_date: "",
    booking_time: "",
    services: [] as any[],
    notes: ""
  });

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      toast({ title: "Invalid access", description: "No access token provided", variant: "destructive" });
      navigate("/");
      return;
    }
    fetchCustomerData(token);
  }, [searchParams]);

  const fetchCustomerData = async (token: string) => {
    try {
      const { data: portalAccess, error: accessError } = await supabase
        .from("customer_portal_access")
        .select("customer_id")
        .eq("access_token", token)
        .eq("is_active", true)
        .single();

      if (accessError || !portalAccess) {
        toast({ title: "Invalid or expired link", variant: "destructive" });
        navigate("/");
        return;
      }

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", portalAccess.customer_id)
        .single();

      if (customerError || !customer) {
        toast({ title: "Error loading customer data", variant: "destructive" });
        return;
      }

      setCustomerData(customer);

      // Fetch vehicles
      const { data: vehiclesData } = await supabase
        .from("vehicles")
        .select("*")
        .eq("customer_id", customer.id);
      setVehicles(vehiclesData || []);

      // Fetch services
      const { data: servicesData } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true);
      setServices(servicesData || []);

      // Fetch job cards
      const { data: jobs } = await supabase
        .from("job_cards")
        .select(`
          *,
          vehicles (vehicle_number, vehicle_type, brand, model)
        `)
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false });
      setJobCards(jobs || []);

      // Fetch invoices
      const { data: invs } = await supabase
        .from("invoices")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false });
      setInvoices(invs || []);

      await supabase
        .from("customer_portal_access")
        .update({ last_login: new Date().toISOString() })
        .eq("access_token", token);

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
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || customerData.id; // Fallback to customer ID

      const { error } = await supabase.from("bookings").insert({
        customer_id: customerData.id,
        vehicle_id: bookingForm.vehicle_id,
        booking_date: bookingForm.booking_date,
        booking_time: bookingForm.booking_time,
        services: bookingForm.services,
        notes: bookingForm.notes,
        status: "pending",
        user_id: userId
      });

      if (error) throw error;

      toast({ title: "Booking created successfully!", description: "We'll contact you soon." });
      setIsBookingOpen(false);
      setBookingForm({
        vehicle_id: "",
        booking_date: "",
        booking_time: "",
        services: [],
        notes: ""
      });
    } catch (error: any) {
      toast({ title: "Error creating booking", description: error.message, variant: "destructive" });
    }
  };

  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00"
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      check_in: "bg-blue-500 text-white",
      pre_wash: "bg-cyan-500 text-white",
      foam_wash: "bg-indigo-500 text-white",
      interior: "bg-purple-500 text-white",
      polishing: "bg-pink-500 text-white",
      qc: "bg-orange-500 text-white",
      completed: "bg-green-500 text-white",
      delivered: "bg-emerald-500 text-white"
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      paid: "bg-green-500 text-white",
      unpaid: "bg-red-500 text-white",
      partial: "bg-yellow-500 text-white"
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const downloadInvoice = (invoice: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', margin, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice: ${invoice.invoice_number}`, pageWidth - margin, 18, { align: 'right' });
    doc.text(`Date: ${format(new Date(invoice.created_at), 'MMM dd, yyyy')}`, pageWidth - margin, 25, { align: 'right' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', margin, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(customerData?.name || '', margin, 62);
    doc.text(customerData?.phone || '', margin, 68);
    if (customerData?.address) doc.text(customerData.address, margin, 74);

    const startY = 90;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, startY, pageWidth - margin, startY);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Service', margin, startY + 7);
    doc.text('Price', pageWidth - margin - 30, startY + 7, { align: 'right' });
    
    doc.line(margin, startY + 10, pageWidth - margin, startY + 10);

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    let yPos = startY + 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    items.forEach((item: any) => {
      doc.text(item.name || 'Service', margin, yPos);
      doc.text(`₹${Number(item.price || 0).toFixed(2)}`, pageWidth - margin - 30, yPos, { align: 'right' });
      yPos += 7;
    });

    yPos += 10;
    doc.setLineWidth(0.5);
    doc.line(pageWidth - margin - 60, yPos, pageWidth - margin, yPos);
    yPos += 10;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Total:', pageWidth - margin - 60, yPos);
    doc.text(`₹${Number(invoice.total_amount).toFixed(2)}`, pageWidth - margin - 30, yPos, { align: 'right' });

    yPos += 20;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Payment Status: ${invoice.payment_status.toUpperCase()}`, margin, yPos);

    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });

    doc.save(`invoice-${invoice.invoice_number}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!customerData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Unable to load customer data</p>
            <Button onClick={() => navigate("/")} className="mt-4">Go to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 border-b shadow-xl">
        <div className="container mx-auto px-4 md:px-6 py-6 md:py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-primary-foreground mb-2">
                Welcome, {customerData.name}!
              </h1>
              <p className="text-primary-foreground/90 text-sm md:text-base">
                Track your services and manage bookings
              </p>
            </div>
            <div className="bg-background/95 backdrop-blur rounded-xl p-4 shadow-lg border">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-full p-2">
                  <User className="h-6 w-6 text-primary" />
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
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
        <Tabs defaultValue="jobs" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <TabsList className="grid w-full grid-cols-3 md:w-auto">
              <TabsTrigger value="jobs" className="gap-2">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Job Cards</span> ({jobCards.length})
              </TabsTrigger>
              <TabsTrigger value="invoices" className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Invoices</span> ({invoices.length})
              </TabsTrigger>
              <TabsTrigger value="booking" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Book</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Job Cards Tab */}
          <TabsContent value="jobs" className="space-y-4">
            {jobCards.length === 0 ? (
              <Card className="border-2">
                <CardContent className="py-16 text-center">
                  <Package className="h-20 w-20 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground text-lg">No job cards found</p>
                </CardContent>
              </Card>
            ) : (
              jobCards.map((job) => {
                const services = Array.isArray(job.services) ? job.services : [];
                const firstService = services[0];
                const stages = (firstService?.lifecycle_stages as string[]) || ["check_in", "completed", "delivered"];
                const currentIndex = stages.indexOf(job.status);
                
                return (
                  <Card key={job.id} className="hover:shadow-xl transition-all border-2">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 border-b">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 rounded-full p-2">
                            <Car className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{job.vehicles?.vehicle_number}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {job.vehicles?.brand} {job.vehicles?.model}
                            </p>
                          </div>
                        </div>
                        <Badge className={cn("text-sm px-4 py-1.5", getStatusColor(job.status))}>
                          {job.status.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Check-in: {job.check_in_time ? format(new Date(job.check_in_time), "MMM dd, yyyy 'at' hh:mm a") : "N/A"}
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 text-sm uppercase text-muted-foreground">Services</h4>
                        <div className="flex flex-wrap gap-2">
                          {services.map((service: any, idx: number) => (
                            <Badge key={idx} variant="outline" className="bg-background">
                              {service.name}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-4 text-sm uppercase text-muted-foreground">Progress</h4>
                        <div className="relative pl-8">
                          {stages.map((stage, index) => {
                            const isCompleted = index <= currentIndex;
                            const isCurrent = index === currentIndex;
                            
                            return (
                              <div key={stage} className="relative pb-8 last:pb-0">
                                {index < stages.length - 1 && (
                                  <div 
                                    className={cn(
                                      "absolute left-[-20px] top-6 w-0.5 h-full transition-colors",
                                      isCompleted ? "bg-primary" : "bg-border"
                                    )}
                                  />
                                )}
                                
                                <div className="absolute left-[-26px] top-0">
                                  {isCompleted ? (
                                    <div className={cn(
                                      "w-4 h-4 rounded-full flex items-center justify-center transition-all",
                                      isCurrent ? "bg-primary ring-4 ring-primary/20 scale-125" : "bg-primary"
                                    )}>
                                      <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                                    </div>
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border-2 border-border bg-background" />
                                  )}
                                </div>
                                
                                <div className={cn(
                                  "transition-all",
                                  isCompleted ? "text-foreground font-medium" : "text-muted-foreground",
                                  isCurrent && "text-primary font-bold"
                                )}>
                                  {stage.replace(/_/g, ' ').toUpperCase()}
                                  {isCurrent && <span className="ml-2 text-xs">(Current)</span>}
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

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-4">
            {invoices.length === 0 ? (
              <Card className="border-2">
                <CardContent className="py-16 text-center">
                  <FileText className="h-20 w-20 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground text-lg">No invoices found</p>
                </CardContent>
              </Card>
            ) : (
              invoices.map((invoice) => {
                const items = Array.isArray(invoice.items) ? invoice.items : [];
                
                return (
                  <Card key={invoice.id} className="hover:shadow-xl transition-all border-2">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 border-b">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 rounded-full p-2">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Invoice #{invoice.invoice_number}</CardTitle>
                            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                              <CalendarIcon className="h-3 w-3" />
                              {format(new Date(invoice.created_at), "MMM dd, yyyy")}
                            </p>
                          </div>
                        </div>
                        <Badge className={cn("text-sm px-4 py-1.5", getPaymentStatusColor(invoice.payment_status))}>
                          {invoice.payment_status.toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <div>
                        <h4 className="font-semibold mb-3 text-sm uppercase text-muted-foreground">Services</h4>
                        <div className="space-y-2">
                          {items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center py-3 border-b last:border-0">
                              <span className="text-sm font-medium">{item.name}</span>
                              <span className="font-bold text-primary">₹{Number(item.price || 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-4 border-t-2 border-primary">
                        <span className="text-xl font-bold">Total Amount</span>
                        <span className="text-3xl font-bold text-primary">₹{Number(invoice.total_amount).toFixed(2)}</span>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button 
                          onClick={() => downloadInvoice(invoice)} 
                          className="flex-1 gap-2"
                          variant="outline"
                        >
                          <FileText className="h-4 w-4" />
                          Download PDF
                        </Button>
                        {invoice.payment_status !== "paid" && (
                          <Button className="flex-1 gap-2">
                            <CreditCard className="h-4 w-4" />
                            Pay Now
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Booking Tab */}
          <TabsContent value="booking">
            <Card className="border-2">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 border-b">
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Book a New Service
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                  <Label>Select Vehicle *</Label>
                  <Select value={bookingForm.vehicle_id} onValueChange={(value) => setBookingForm({ ...bookingForm, vehicle_id: value })}>
                    <SelectTrigger>
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

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Date *</Label>
                    <Calendar
                      mode="single"
                      selected={bookingForm.booking_date ? new Date(bookingForm.booking_date) : undefined}
                      onSelect={(date) => setBookingForm({ ...bookingForm, booking_date: date ? format(date, "yyyy-MM-dd") : "" })}
                      disabled={(date) => date < new Date()}
                      className="rounded-md border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Select Time Slot *</Label>
                    <Select value={bookingForm.booking_time} onValueChange={(value) => setBookingForm({ ...bookingForm, booking_time: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose time" />
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

                <div className="space-y-2">
                  <Label>Select Services *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto border rounded-md p-4">
                    {services.map((service) => (
                      <label key={service.id} className="flex items-start gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={bookingForm.services.some(s => s.id === service.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBookingForm({
                                ...bookingForm,
                                services: [...bookingForm.services, { 
                                  id: service.id, 
                                  name: service.name, 
                                  price: service.base_price 
                                }]
                              });
                            } else {
                              setBookingForm({
                                ...bookingForm,
                                services: bookingForm.services.filter(s => s.id !== service.id)
                              });
                            }
                          }}
                          className="mt-1 rounded"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{service.name}</p>
                          <p className="text-xs text-muted-foreground">₹{service.base_price} • {service.duration_minutes} mins</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={createBooking}
                  disabled={!bookingForm.vehicle_id || !bookingForm.booking_date || !bookingForm.booking_time || bookingForm.services.length === 0}
                  className="w-full"
                  size="lg"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Create Booking
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CustomerPortal;
