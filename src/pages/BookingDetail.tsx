import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, User, Car, Clock, Calendar as CalendarIcon, CheckCircle2, Package, 
  Truck, FileText, Download, MapPin, DollarSign, Plus, Trash2, Send
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";

const BookingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Door step form
  const [doorStepDialogOpen, setDoorStepDialogOpen] = useState(false);
  const [doorStepForm, setDoorStepForm] = useState({
    pickup_address: "",
    delivery_address: "",
    estimated_pickup_time: "",
    estimated_delivery_time: "",
    assigned_staff_id: "",
    notes: ""
  });

  // Invoice edit
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editTaxRate, setEditTaxRate] = useState<number>(18);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          customers (id, name, phone, email, address),
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

  const { data: doorStepService } = useQuery({
    queryKey: ["door-step-for-booking", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("door_step_services")
        .select(`*, profiles:assigned_staff_id (full_name, phone)`)
        .eq("booking_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: invoice } = useQuery({
    queryKey: ["invoice-for-booking", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("booking_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: staff } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .order("full_name");
      if (error) throw error;
      return data;
    }
  });

  const { data: companyInfo } = useQuery({
    queryKey: ["company-info"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("branches")
        .select("name, email, phone, address, gst_number")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Valid job_status enum values from database
  const validJobStatuses = ["check_in", "pre_wash", "foam_wash", "interior", "polishing", "qc", "completed", "delivered"];

  const getLifecycleStages = (): string[] => validJobStatuses;

  const mapToValidStatus = (status: string): string => {
    const normalized = status.toLowerCase().replace(/\s+/g, '_');
    if (validJobStatuses.includes(normalized)) return normalized;
    const mapping: Record<string, string> = {
      'vehicle_in': 'check_in', 'vehicle in': 'check_in', 'checkin': 'check_in', 'check in': 'check_in',
      'washing': 'foam_wash', 'drying': 'interior', 'finish': 'completed', 'finished': 'completed',
      'done': 'completed', 'deliver': 'delivered',
    };
    return mapping[normalized] || mapping[status.toLowerCase()] || 'check_in';
  };

  const lifecycleStages = getLifecycleStages();
  const currentStageIndex = jobCard ? lifecycleStages.indexOf(jobCard.status) : -1;

  const updateJobCardStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const validStatus = mapToValidStatus(newStatus);

      if (!jobCard) {
        const { error } = await supabase.from("job_cards").insert({
          user_id: user.id,
          booking_id: id,
          customer_id: booking?.customer_id,
          vehicle_id: booking?.vehicle_id,
          services: booking?.services,
          status: validStatus as any,
          check_in_time: validStatus === "check_in" ? new Date().toISOString() : null
        });
        if (error) throw error;
      } else {
        const updateData: any = { status: validStatus };
        if (validStatus === "check_in") updateData.check_in_time = new Date().toISOString();
        if (validStatus === "delivered") updateData.check_out_time = new Date().toISOString();

        const { error } = await supabase.from("job_cards").update(updateData).eq("id", jobCard.id);
        if (error) throw error;
      }

      type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
      let bookingStatus: BookingStatus = "confirmed";
      if (["check_in", "pre_wash", "foam_wash", "interior", "polishing", "qc"].includes(validStatus)) {
        bookingStatus = "in_progress";
      } else if (validStatus === "completed" || validStatus === "delivered") {
        bookingStatus = "completed";
      }

      await supabase.from("bookings").update({ status: bookingStatus }).eq("id", id);
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

  // Door Step Service mutations
  const createDoorStepService = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("door_step_services").insert({
        user_id: user.id,
        booking_id: id,
        customer_id: booking?.customer_id,
        vehicle_id: booking?.vehicle_id,
        pickup_address: data.pickup_address,
        delivery_address: data.delivery_address || data.pickup_address,
        estimated_pickup_time: data.estimated_pickup_time ? new Date(data.estimated_pickup_time).toISOString() : null,
        estimated_delivery_time: data.estimated_delivery_time ? new Date(data.estimated_delivery_time).toISOString() : null,
        assigned_staff_id: data.assigned_staff_id || null,
        notes: data.notes || null,
        status: "scheduled"
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["door-step-for-booking", id] });
      toast({ title: "Door step service created" });
      setDoorStepDialogOpen(false);
      setDoorStepForm({ pickup_address: "", delivery_address: "", estimated_pickup_time: "", estimated_delivery_time: "", assigned_staff_id: "", notes: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateDoorStepStatus = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const updateData: any = { status };
      if (status === "picking_up") updateData.pickup_time = new Date().toISOString();
      if (status === "completed") updateData.delivery_time = new Date().toISOString();

      const { error } = await supabase.from("door_step_services").update(updateData).eq("id", doorStepService?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["door-step-for-booking", id] });
      toast({ title: "Status updated" });
    }
  });

  // Invoice mutations
  const generateInvoice = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      if (!booking?.customer_id) throw new Error("Customer ID missing");

      const { data: lastInvoice } = await supabase
        .from("invoices")
        .select("invoice_number")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextNumber = lastInvoice ? parseInt(lastInvoice.invoice_number.replace("INV-", "")) + 1 : 1001;
      const servicesArr: any[] = Array.isArray(booking?.services) ? (booking.services as any[]) : [];
      const subtotal = servicesArr.reduce((sum: number, s: any) => sum + (Number(s.price) || 0), 0);
      const taxAmount = subtotal * 0.18;
      const totalAmount = subtotal + taxAmount;

      const { error } = await supabase.from("invoices").insert([{
        user_id: user.id,
        booking_id: id,
        job_card_id: jobCard?.id || null,
        customer_id: booking.customer_id,
        invoice_number: `INV-${nextNumber}`,
        items: servicesArr,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_status: "unpaid" as const
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-for-booking", id] });
      toast({ title: "Invoice generated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ items, discount, taxAmount }: { items: any[]; discount: number; taxAmount: number }) => {
      const subtotal = items.reduce((sum, item) => sum + Number(item.price), 0);
      const totalAmount = subtotal - discount + taxAmount;

      const { error } = await supabase.from("invoices").update({
        items,
        subtotal,
        discount,
        tax_amount: taxAmount,
        total_amount: totalAmount
      }).eq("id", invoice?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-for-booking", id] });
      toast({ title: "Invoice updated" });
      setInvoiceDialogOpen(false);
    }
  });

  const recordPayment = useMutation({
    mutationFn: async (method: string) => {
      const { error } = await supabase.from("invoices").update({
        payment_status: "paid",
        payment_method: method as any,
        paid_at: new Date().toISOString()
      }).eq("id", invoice?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-for-booking", id] });
      toast({ title: "Payment recorded" });
    }
  });

  const openInvoiceEdit = () => {
    if (invoice) {
      const items = Array.isArray(invoice.items) ? invoice.items as any[] : [];
      setEditItems([...items]);
      setEditDiscount(Number(invoice.discount) || 0);
      const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.price), 0);
      setEditTaxRate(subtotal > 0 ? Math.round((Number(invoice.tax_amount) / subtotal) * 100) : 18);
      setInvoiceDialogOpen(true);
    }
  };

  const downloadPDF = () => {
    if (!invoice || !companyInfo) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 20;

    doc.setFillColor(254, 240, 138);
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(24);
    doc.setFont("helvetica", 'bold');
    doc.text(companyInfo.name || "Car Wash", 15, 20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", 'normal');
    if (companyInfo.address) doc.text(companyInfo.address, 15, 28);
    if (companyInfo.phone) doc.text(`Phone: ${companyInfo.phone}`, 15, 33);
    if (companyInfo.gst_number) doc.text(`GST: ${companyInfo.gst_number}`, 15, 38);

    doc.setFontSize(28);
    doc.setFont("helvetica", 'bold');
    doc.text("INVOICE", pageWidth - 15, 22, { align: "right" });
    doc.setFontSize(10);
    doc.setFont("helvetica", 'normal');
    doc.text(`#${invoice.invoice_number}`, pageWidth - 15, 32, { align: "right" });
    doc.text(format(new Date(invoice.created_at), "MMM dd, yyyy"), pageWidth - 15, 40, { align: "right" });

    y = 65;
    doc.setFontSize(9);
    doc.setFont("helvetica", 'bold');
    doc.text("BILL TO:", 15, y);
    doc.setFont("helvetica", 'normal');
    doc.text(booking?.customers?.name || "", 15, y + 8);
    doc.text(booking?.customers?.phone || "", 15, y + 14);

    y = 100;
    doc.setFillColor(245, 245, 245);
    doc.rect(15, y, pageWidth - 30, 10, 'F');
    doc.setFont("helvetica", 'bold');
    doc.text("DESCRIPTION", 20, y + 7);
    doc.text("AMOUNT", pageWidth - 20, y + 7, { align: "right" });

    y += 15;
    doc.setFont("helvetica", 'normal');
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    items.forEach((item: any) => {
      doc.text(item.name || "Service", 20, y);
      doc.text(`₹${Number(item.price).toFixed(2)}`, pageWidth - 20, y, { align: "right" });
      y += 8;
    });

    y += 10;
    doc.setFont("helvetica", 'bold');
    doc.text("TOTAL:", pageWidth - 60, y);
    doc.text(`₹${Number(invoice.total_amount).toFixed(2)}`, pageWidth - 20, y, { align: "right" });

    doc.save(`Invoice_${invoice.invoice_number}.pdf`);
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

  const doorStepStatusColors: Record<string, string> = {
    scheduled: "bg-color-blue text-white",
    picking_up: "bg-color-orange text-white",
    in_service: "bg-color-purple text-white",
    delivering: "bg-color-cyan text-white",
    completed: "bg-color-green text-white"
  };

  const nextDoorStepStatus: Record<string, string> = {
    scheduled: "picking_up",
    picking_up: "in_service",
    in_service: "delivering",
    delivering: "completed"
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6 flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-foreground border-t-transparent"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!booking) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Booking not found</p>
              <Button onClick={() => navigate("/bookings")} className="mt-4">Back to Bookings</Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/bookings")} className="self-start">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">Booking Details</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(booking.booking_date), "MMM dd, yyyy")} at {booking.booking_time}
            </p>
          </div>
          <Badge className={cn("self-start sm:self-auto", stageColors[jobCard?.status || "check_in"] || "bg-secondary")}>
            {(jobCard?.status || booking.status).replace(/_/g, " ").toUpperCase()}
          </Badge>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm py-2">Overview</TabsTrigger>
            <TabsTrigger value="job-card" className="text-xs sm:text-sm py-2">Job Card</TabsTrigger>
            <TabsTrigger value="door-step" className="text-xs sm:text-sm py-2">Door Step</TabsTrigger>
            <TabsTrigger value="invoice" className="text-xs sm:text-sm py-2">Invoice</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader className="border-b bg-secondary/30 py-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" /> Customer
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-1">
                  <p className="font-semibold">{booking.customers?.name}</p>
                  <p className="text-sm text-muted-foreground">{booking.customers?.phone}</p>
                  {booking.customers?.email && <p className="text-sm text-muted-foreground">{booking.customers?.email}</p>}
                  {booking.customers?.address && <p className="text-sm text-muted-foreground">{booking.customers?.address}</p>}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="border-b bg-secondary/30 py-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Car className="h-4 w-4" /> Vehicle
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-1">
                  <p className="font-semibold">{booking.vehicles?.vehicle_number}</p>
                  <p className="text-sm text-muted-foreground">{booking.vehicles?.brand} {booking.vehicles?.model}</p>
                  <Badge variant="outline" className="capitalize">{booking.vehicles?.vehicle_type}</Badge>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader className="border-b bg-secondary/30 py-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" /> Services
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

            {booking.notes && (
              <Card className="shadow-sm">
                <CardHeader className="border-b bg-secondary/30 py-3 px-4">
                  <CardTitle className="text-sm">Notes</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-muted-foreground">{booking.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Job Card Tab */}
          <TabsContent value="job-card" className="space-y-4 mt-4">
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-secondary/30 py-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" /> Service Lifecycle
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
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
                            "w-full p-3 rounded-lg border-2 transition-all text-center",
                            isCurrent && "ring-2 ring-color-green ring-offset-2 border-color-green",
                            isCompleted && !isCurrent && "bg-color-green/10 border-color-green",
                            !isCompleted && "border-border bg-secondary/30",
                            isNext && "border-dashed border-primary cursor-pointer hover:border-solid",
                            !isNext && !isCompleted && "cursor-not-allowed opacity-50"
                          )}
                        >
                          <div className="flex flex-col items-center gap-1">
                            {isCompleted ? (
                              <CheckCircle2 className="h-5 w-5 text-color-green" />
                            ) : (
                              <div className={cn("w-5 h-5 rounded-full border-2", isNext ? "border-primary" : "border-muted-foreground")} />
                            )}
                            <span className={cn("text-[10px] font-medium uppercase", isCompleted ? "text-color-green" : "text-muted-foreground")}>
                              {stage.replace(/_/g, " ")}
                            </span>
                          </div>
                        </button>
                        {isCurrent && <Badge className="mt-1 text-[10px] bg-color-green text-white animate-pulse">Current</Badge>}
                      </div>
                    );
                  })}
                </div>

                {currentStageIndex === -1 && (
                  <div className="mt-6 text-center">
                    <p className="text-muted-foreground mb-3">Start the service process</p>
                    <Button onClick={() => updateJobCardStatus.mutate("check_in")}>Begin Check-in</Button>
                  </div>
                )}

                {currentStageIndex >= 0 && currentStageIndex < lifecycleStages.length - 1 && (
                  <div className="mt-6 text-center">
                    <Button onClick={() => updateJobCardStatus.mutate(lifecycleStages[currentStageIndex + 1])}>
                      Move to {lifecycleStages[currentStageIndex + 1].replace(/_/g, " ").toUpperCase()}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {jobCard && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="shadow-sm">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Check-in:</span>
                      <span>{jobCard.check_in_time ? format(new Date(jobCard.check_in_time), "MMM dd, hh:mm a") : "N/A"}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Check-out:</span>
                      <span>{jobCard.check_out_time ? format(new Date(jobCard.check_out_time), "MMM dd, hh:mm a") : "Pending"}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Door Step Tab */}
          <TabsContent value="door-step" className="space-y-4 mt-4">
            {doorStepService ? (
              <Card className="shadow-sm">
                <CardHeader className="border-b bg-secondary/30 py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Truck className="h-4 w-4" /> Door Step Service
                    </CardTitle>
                    <Badge className={doorStepStatusColors[doorStepService.status]}>
                      {doorStepService.status.replace(/_/g, " ").toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Pickup Address</p>
                          <p className="text-sm">{doorStepService.pickup_address}</p>
                        </div>
                      </div>
                      {doorStepService.estimated_pickup_time && (
                        <p className="text-xs text-muted-foreground ml-6">
                          Est: {format(new Date(doorStepService.estimated_pickup_time), "MMM dd, hh:mm a")}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-color-green mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Delivery Address</p>
                          <p className="text-sm">{doorStepService.delivery_address || doorStepService.pickup_address}</p>
                        </div>
                      </div>
                      {doorStepService.estimated_delivery_time && (
                        <p className="text-xs text-muted-foreground ml-6">
                          Est: {format(new Date(doorStepService.estimated_delivery_time), "MMM dd, hh:mm a")}
                        </p>
                      )}
                    </div>
                  </div>

                  {doorStepService.profiles && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Assigned: {doorStepService.profiles.full_name}</span>
                    </div>
                  )}

                  {nextDoorStepStatus[doorStepService.status] && (
                    <Button
                      onClick={() => updateDoorStepStatus.mutate({ status: nextDoorStepStatus[doorStepService.status] })}
                      className="w-full"
                    >
                      Move to {nextDoorStepStatus[doorStepService.status].replace(/_/g, " ").toUpperCase()}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-sm">
                <CardContent className="py-12 text-center">
                  <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground mb-4">No door step service configured</p>
                  <Button onClick={() => {
                    setDoorStepForm({ ...doorStepForm, pickup_address: booking.customers?.address || "" });
                    setDoorStepDialogOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" /> Add Door Step Service
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Invoice Tab */}
          <TabsContent value="invoice" className="space-y-4 mt-4">
            {invoice ? (
              <Card className="shadow-sm">
                <CardHeader className="border-b bg-secondary/30 py-3 px-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4" /> {invoice.invoice_number}
                    </CardTitle>
                    <Badge className={invoice.payment_status === "paid" ? "bg-color-green text-white" : "bg-color-orange text-white"}>
                      {invoice.payment_status?.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-2">
                    {Array.isArray(invoice.items) && invoice.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.name}</span>
                        <span>₹{Number(item.price).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>₹{Number(invoice.subtotal).toFixed(2)}</span>
                      </div>
                      {invoice.discount > 0 && (
                        <div className="flex justify-between text-sm text-color-green">
                          <span>Discount</span>
                          <span>-₹{Number(invoice.discount).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span>Tax</span>
                        <span>₹{Number(invoice.tax_amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg pt-2 border-t">
                        <span>Total</span>
                        <span>₹{Number(invoice.total_amount).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={downloadPDF}>
                      <Download className="h-4 w-4 mr-1" /> Download
                    </Button>
                    <Button variant="outline" size="sm" onClick={openInvoiceEdit}>
                      Edit Invoice
                    </Button>
                    {invoice.payment_status !== "paid" && (
                      <Select value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v); recordPayment.mutate(v); }}>
                        <SelectTrigger className="w-[140px] h-9">
                          <DollarSign className="h-4 w-4 mr-1" />
                          <SelectValue placeholder="Record Payment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-sm">
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground mb-4">No invoice generated yet</p>
                  <Button onClick={() => generateInvoice.mutate()} disabled={generateInvoice.isPending}>
                    <Plus className="h-4 w-4 mr-2" /> Generate Invoice
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Door Step Dialog */}
      <Dialog open={doorStepDialogOpen} onOpenChange={setDoorStepDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Door Step Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pickup Address *</Label>
              <Textarea
                value={doorStepForm.pickup_address}
                onChange={(e) => setDoorStepForm({ ...doorStepForm, pickup_address: e.target.value })}
                placeholder="Enter pickup address"
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery Address</Label>
              <Textarea
                value={doorStepForm.delivery_address}
                onChange={(e) => setDoorStepForm({ ...doorStepForm, delivery_address: e.target.value })}
                placeholder="Same as pickup if empty"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Est. Pickup Time</Label>
                <Input
                  type="datetime-local"
                  value={doorStepForm.estimated_pickup_time}
                  onChange={(e) => setDoorStepForm({ ...doorStepForm, estimated_pickup_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Est. Delivery Time</Label>
                <Input
                  type="datetime-local"
                  value={doorStepForm.estimated_delivery_time}
                  onChange={(e) => setDoorStepForm({ ...doorStepForm, estimated_delivery_time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assign Staff</Label>
              <Select value={doorStepForm.assigned_staff_id} onValueChange={(v) => setDoorStepForm({ ...doorStepForm, assigned_staff_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staff?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name || "Unnamed"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={doorStepForm.notes}
                onChange={(e) => setDoorStepForm({ ...doorStepForm, notes: e.target.value })}
                placeholder="Special instructions..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createDoorStepService.mutate(doorStepForm)} disabled={!doorStepForm.pickup_address || createDoorStepService.isPending}>
              {createDoorStepService.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Edit Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button variant="ghost" size="sm" onClick={() => setEditItems([...editItems, { name: "", price: 0 }])}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              {editItems.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={item.name}
                    onChange={(e) => {
                      const updated = [...editItems];
                      updated[idx].name = e.target.value;
                      setEditItems(updated);
                    }}
                    placeholder="Service name"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={item.price}
                    onChange={(e) => {
                      const updated = [...editItems];
                      updated[idx].price = Number(e.target.value);
                      setEditItems(updated);
                    }}
                    className="w-24"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount (₹)</Label>
                <Input type="number" value={editDiscount} onChange={(e) => setEditDiscount(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Tax Rate (%)</Label>
                <Input type="number" value={editTaxRate} onChange={(e) => setEditTaxRate(Number(e.target.value))} />
              </div>
            </div>
            <div className="text-right font-bold">
              Total: ₹{(editItems.reduce((s, i) => s + Number(i.price), 0) - editDiscount + (editItems.reduce((s, i) => s + Number(i.price), 0) * editTaxRate / 100)).toFixed(2)}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              const subtotal = editItems.reduce((s, i) => s + Number(i.price), 0);
              const taxAmount = subtotal * editTaxRate / 100;
              updateInvoice.mutate({ items: editItems, discount: editDiscount, taxAmount });
            }} disabled={updateInvoice.isPending}>
              {updateInvoice.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default BookingDetail;