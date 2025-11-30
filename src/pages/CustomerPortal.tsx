import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FileText, Calendar, CreditCard, User, Car, Clock, CheckCircle2, Package } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

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
      // Verify token and get customer ID
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

      // Fetch customer data
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

      // Update last login
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      check_in: "bg-info text-info-foreground",
      pre_wash: "bg-primary text-primary-foreground",
      foam_wash: "bg-warning text-warning-foreground",
      interior: "bg-accent text-accent-foreground",
      polishing: "bg-secondary text-secondary-foreground",
      qc: "bg-muted text-muted-foreground",
      completed: "bg-success text-success-foreground",
      delivered: "bg-primary text-primary-foreground"
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      paid: "bg-success text-success-foreground",
      unpaid: "bg-destructive text-destructive-foreground",
      partial: "bg-warning text-warning-foreground"
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const downloadInvoice = (invoice: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // Header
    doc.setFillColor(45, 100, 51);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', margin, 22);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice #: ${invoice.invoice_number}`, pageWidth - margin, 15, { align: 'right' });
    doc.text(`Date: ${format(new Date(invoice.created_at), 'MMM dd, yyyy')}`, pageWidth - margin, 22, { align: 'right' });
    
    // Customer Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', margin, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(customerData?.name || '', margin, 58);
    doc.text(customerData?.phone || '', margin, 64);
    if (customerData?.address) doc.text(customerData.address, margin, 70);

    // Items Table
    const startY = 85;
    doc.setDrawColor(45, 100, 51);
    doc.setLineWidth(0.5);
    doc.line(margin, startY, pageWidth - margin, startY);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Service', margin, startY + 7);
    doc.text('Price', pageWidth - margin - 30, startY + 7, { align: 'right' });
    
    doc.line(margin, startY + 10, pageWidth - margin, startY + 10);

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    let yPos = startY + 18;
    doc.setFont('helvetica', 'normal');
    
    items.forEach((item: any) => {
      doc.text(item.name || 'Service', margin, yPos);
      doc.text(`₹${Number(item.price || 0).toFixed(2)}`, pageWidth - margin - 30, yPos, { align: 'right' });
      yPos += 7;
    });

    // Totals
    yPos += 5;
    doc.setLineWidth(0.3);
    doc.line(pageWidth - margin - 60, yPos, pageWidth - margin, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Total:', pageWidth - margin - 60, yPos);
    doc.text(`₹${Number(invoice.total_amount).toFixed(2)}`, pageWidth - margin - 30, yPos, { align: 'right' });

    // Payment Status
    yPos += 15;
    doc.setFontSize(10);
    doc.text(`Payment Status: ${invoice.payment_status.toUpperCase()}`, margin, yPos);

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });

    doc.save(`invoice-${invoice.invoice_number}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!customerData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-accent to-primary border-b shadow-lg">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary-foreground mb-2">Welcome, {customerData.name}!</h1>
              <p className="text-primary-foreground/80">Track your service history and manage invoices</p>
            </div>
            <div className="bg-background/95 backdrop-blur rounded-lg p-4 shadow-md">
              <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-semibold">{customerData.name}</p>
                  <p className="text-sm text-muted-foreground">{customerData.phone}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto">
            <TabsTrigger value="jobs" className="gap-2">
              <Package className="h-4 w-4" />
              Job Cards ({jobCards.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" />
              Invoices ({invoices.length})
            </TabsTrigger>
          </TabsList>

          {/* Job Cards Tab */}
          <TabsContent value="jobs" className="space-y-4">
            {jobCards.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No job cards found</p>
                </CardContent>
              </Card>
            ) : (
              jobCards.map((job) => {
                const services = Array.isArray(job.services) ? job.services : [];
                const firstService = services[0];
                const stages = (firstService?.lifecycle_stages as string[]) || ["check_in", "completed", "delivered"];
                const currentIndex = stages.indexOf(job.status);
                
                return (
                  <Card key={job.id} className="hover:shadow-lg transition-all border-2 border-border hover:border-primary/30">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 border-b">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-3">
                            <Car className="h-5 w-5 text-primary" />
                            {job.vehicles?.vehicle_number}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {job.vehicles?.brand} {job.vehicles?.model}
                          </p>
                        </div>
                        <Badge className={cn("text-sm px-4 py-1", getStatusColor(job.status))}>
                          {job.status.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                        <Clock className="h-4 w-4" />
                        Check-in: {job.check_in_time ? format(new Date(job.check_in_time), "MMM dd, yyyy 'at' hh:mm a") : "N/A"}
                      </div>

                      {/* Services */}
                      <div className="mb-6">
                        <h4 className="font-semibold mb-3 text-sm uppercase text-muted-foreground">Services</h4>
                        <div className="flex flex-wrap gap-2">
                          {services.map((service: any, idx: number) => (
                            <Badge key={idx} variant="outline" className="bg-background">
                              {service.name}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Progress Timeline */}
                      <div className="mb-4">
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
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No invoices found</p>
                </CardContent>
              </Card>
            ) : (
              invoices.map((invoice) => {
                const items = Array.isArray(invoice.items) ? invoice.items : [];
                
                return (
                  <Card key={invoice.id} className="hover:shadow-lg transition-all border-2 border-border hover:border-primary/30">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 border-b">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary" />
                            Invoice #{invoice.invoice_number}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(invoice.created_at), "MMM dd, yyyy")}
                          </p>
                        </div>
                        <Badge className={cn("text-sm px-4 py-1", getPaymentStatusColor(invoice.payment_status))}>
                          {invoice.payment_status.toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Items */}
                        <div>
                          <h4 className="font-semibold mb-3 text-sm uppercase text-muted-foreground">Services</h4>
                          <div className="space-y-2">
                            {items.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                                <span className="text-sm">{item.name}</span>
                                <span className="font-semibold">₹{Number(item.price || 0).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Total */}
                        <div className="flex justify-between items-center pt-4 border-t-2 border-primary">
                          <span className="text-lg font-bold">Total Amount</span>
                          <span className="text-2xl font-bold text-primary">₹{Number(invoice.total_amount).toFixed(2)}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4">
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
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CustomerPortal;