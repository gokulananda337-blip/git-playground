import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, FileText, Download, Send, DollarSign, Building2, Edit2, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import jsPDF from "jspdf";

const Invoices = () => {
  const [search, setSearch] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [editItems, setEditItems] = useState<any[]>([]);
  const { toast } = useToast();

  const { data: companyInfo } = useQuery({
    queryKey: ["company-info"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("branches")
        .select("name, email, phone, address, gst_number, company_logo_url")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          customers (name, phone, address),
          job_cards (
            vehicles (vehicle_number, brand, model)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const filteredInvoices = invoices?.filter(inv =>
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.customers?.name.toLowerCase().includes(search.toLowerCase())
  );

  const queryClient = useQueryClient();

  const recordPayment = useMutation({
    mutationFn: async ({ invoiceId, method }: { invoiceId: string; method: string }) => {
      const { error } = await supabase
        .from("invoices")
        .update({
          payment_status: "paid",
          payment_method: method as any,
          paid_at: new Date().toISOString()
        })
        .eq("id", invoiceId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Payment recorded successfully" });
      setPaymentDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ invoiceId, items }: { invoiceId: string; items: any[] }) => {
      const subtotal = items.reduce((sum, item) => sum + Number(item.price), 0);
      const { error } = await supabase
        .from("invoices")
        .update({
          items,
          subtotal,
          total_amount: subtotal + (selectedInvoice.tax_amount || 0) - (selectedInvoice.discount || 0)
        })
        .eq("id", invoiceId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Invoice updated successfully" });
      setEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const openEditDialog = (invoice: any) => {
    setSelectedInvoice(invoice);
    setEditItems(Array.isArray(invoice.items) ? [...invoice.items] : []);
    setEditDialogOpen(true);
  };

  const addEditItem = () => {
    setEditItems([...editItems, { name: "", price: 0 }]);
  };

  const removeEditItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const updateEditItem = (index: number, field: string, value: any) => {
    const updated = [...editItems];
    updated[index] = { ...updated[index], [field]: value };
    setEditItems(updated);
  };

  const downloadPDF = (invoice: any) => {
    if (!companyInfo) {
      toast({
        title: "Company info missing",
        description: "Please configure company details in Settings.",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 20;

    // Header with company info - Yellow gradient
    doc.setFillColor(253, 224, 71); // yellow-300
    doc.rect(0, 0, pageWidth, 60, 'F');
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text(companyInfo.name || "Car Wash", 20, 20);
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    if (companyInfo.address) doc.text(companyInfo.address, 20, 28);
    if (companyInfo.phone) doc.text(`Phone: ${companyInfo.phone}`, 20, 34);
    if (companyInfo.email) doc.text(`Email: ${companyInfo.email}`, 20, 40);
    if (companyInfo.gst_number) {
      doc.setFont(undefined, 'bold');
      doc.text(`GST: ${companyInfo.gst_number}`, 20, 46);
      doc.setFont(undefined, 'normal');
    }

    // Invoice details (right side)
    doc.setFontSize(26);
    doc.setFont(undefined, 'bold');
    doc.text("INVOICE", pageWidth - 20, 22, { align: "right" });
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`#${invoice.invoice_number}`, pageWidth - 20, 32, { align: "right" });
    doc.text(format(new Date(invoice.created_at), "MMM dd, yyyy"), pageWidth - 20, 40, { align: "right" });

    // Reset text color
    doc.setTextColor(0, 0, 0);
    y = 70;

    // Bill To section
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("BILL TO:", 20, y);
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    doc.text(invoice.customers?.name || "N/A", 20, y + 6);
    doc.setFontSize(9);
    if (invoice.customers?.phone) doc.text(invoice.customers.phone, 20, y + 12);
    if (invoice.customers?.address) doc.text(invoice.customers.address, 20, y + 18);

    // Vehicle info (right side)
    if (invoice.job_cards?.vehicles) {
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text("VEHICLE:", pageWidth - 80, y);
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(11);
      doc.text(invoice.job_cards.vehicles.vehicle_number, pageWidth - 80, y + 6);
      doc.setFontSize(9);
      const vehicleDetails = `${invoice.job_cards.vehicles.brand || ""} ${invoice.job_cards.vehicles.model || ""}`.trim();
      if (vehicleDetails) doc.text(vehicleDetails, pageWidth - 80, y + 12);
    }

    y += 30;

    // Services table header
    doc.setFillColor(240, 240, 240);
    doc.rect(20, y, pageWidth - 40, 10, 'F');
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("DESCRIPTION", 25, y + 7);
    doc.text("AMOUNT", pageWidth - 25, y + 7, { align: "right" });

    y += 12;
    doc.setDrawColor(220, 220, 220);
    doc.line(20, y, pageWidth - 20, y);

    // Services items
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    items.forEach((item: any) => {
      y += 8;
      doc.text(item.name || "Service", 25, y);
      doc.text(`₹${Number(item.price || 0).toFixed(2)}`, pageWidth - 25, y, { align: "right" });
    });

    y += 12;
    doc.line(20, y, pageWidth - 20, y);

    // Totals section
    y += 8;
    const totalsX = pageWidth - 80;
    
    doc.text("Subtotal:", totalsX, y);
    doc.text(`₹${Number(invoice.subtotal).toFixed(2)}`, pageWidth - 25, y, { align: "right" });

    if (invoice.discount && Number(invoice.discount) > 0) {
      y += 6;
      doc.setTextColor(34, 197, 94);
      doc.text("Discount:", totalsX, y);
      doc.text(`-₹${Number(invoice.discount).toFixed(2)}`, pageWidth - 25, y, { align: "right" });
      doc.setTextColor(0, 0, 0);
    }

    if (invoice.tax_amount && Number(invoice.tax_amount) > 0) {
      y += 6;
      doc.text("Tax:", totalsX, y);
      doc.text(`₹${Number(invoice.tax_amount).toFixed(2)}`, pageWidth - 25, y, { align: "right" });
    }

    y += 8;
    doc.setDrawColor(253, 224, 71);
    doc.setLineWidth(0.5);
    doc.line(totalsX - 5, y, pageWidth - 20, y);

    y += 8;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("TOTAL:", totalsX, y);
    doc.text(`₹${Number(invoice.total_amount).toFixed(2)}`, pageWidth - 25, y, { align: "right" });

    // Payment status
    y += 12;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    const status = invoice.payment_status || "unpaid";
    doc.text(`Payment Status: ${status.toUpperCase()}`, 20, y);
    if (invoice.payment_method) {
      doc.text(`Payment Method: ${invoice.payment_method}`, 20, y + 6);
    }

    // Footer
    const footerY = doc.internal.pageSize.height - 20;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text("Thank you for your business!", pageWidth / 2, footerY, { align: "center" });

    doc.save(`Invoice_${invoice.invoice_number}.pdf`);
    toast({ title: "Invoice downloaded successfully" });
  };

  const sendWhatsApp = (invoice: any) => {
    const phone = invoice.customers?.phone?.replace(/[^0-9]/g, "");
    if (!phone) {
      toast({ title: "No customer phone number", variant: "destructive" });
      return;
    }
    const message = `*Invoice ${invoice.invoice_number}*\n\nTotal Amount: ₹${Number(invoice.total_amount).toFixed(2)}\nStatus: ${invoice.payment_status || "unpaid"}\n\nThank you for your business!`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const statusColors: Record<string, string> = {
    paid: "bg-green-500",
    unpaid: "bg-red-500",
    partial: "bg-yellow-500"
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Invoices</h1>
            <p className="text-muted-foreground">Manage billing and payments</p>
          </div>
          {companyInfo && (
            <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-primary mt-1" />
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-base">{companyInfo.name}</p>
                  {companyInfo.phone && <p className="text-xs text-muted-foreground">{companyInfo.phone}</p>}
                  {companyInfo.gst_number && <p className="text-xs text-muted-foreground font-mono">GST: {companyInfo.gst_number}</p>}
                </div>
              </div>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number or customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading invoices...</div>
            ) : filteredInvoices?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No invoices found</div>
            ) : (
              <div className="space-y-4">
                {filteredInvoices?.map((invoice) => (
                  <Card key={invoice.id} className="hover:shadow-lg transition-all border-border/50">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-6">
                        <div className="space-y-4 flex-1">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FileText className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <p className="font-bold text-xl">{invoice.invoice_number}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(invoice.created_at), "MMM dd, yyyy 'at' HH:mm")}
                                </p>
                              </div>
                            </div>
                            <Badge className={`${statusColors[invoice.payment_status || "unpaid"]} text-white capitalize`}>
                              {invoice.payment_status || "unpaid"}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-6 pt-3 border-t">
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Customer</p>
                              <p className="font-semibold">{invoice.customers?.name}</p>
                              <p className="text-sm text-muted-foreground">{invoice.customers?.phone}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground mb-1">Vehicle</p>
                              <p className="font-semibold">{invoice.job_cards?.vehicles?.vehicle_number || "N/A"}</p>
                              <p className="text-sm text-muted-foreground">
                                {invoice.job_cards?.vehicles?.brand} {invoice.job_cards?.vehicles?.model}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-3 border-t">
                            <div className="flex gap-4 text-sm">
                              {invoice.discount && Number(invoice.discount) > 0 && (
                                <span className="text-green-600">Discount: ₹{Number(invoice.discount).toFixed(2)}</span>
                              )}
                              {invoice.tax_amount && Number(invoice.tax_amount) > 0 && (
                                <span>Tax: ₹{Number(invoice.tax_amount).toFixed(2)}</span>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total Amount</p>
                              <p className="text-3xl font-bold text-primary">₹{Number(invoice.total_amount).toFixed(2)}</p>
                            </div>
                          </div>
                          
                          {invoice.payment_method && (
                            <p className="text-xs text-muted-foreground pt-2 border-t">
                              Paid via <span className="capitalize font-medium">{invoice.payment_method}</span>
                              {invoice.paid_at && ` on ${format(new Date(invoice.paid_at), "MMM dd, yyyy")}`}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <Button size="sm" variant="outline" className="gap-2" onClick={() => openEditDialog(invoice)}>
                            <Edit2 className="h-4 w-4" />
                            Edit Invoice
                          </Button>
                          <Button size="sm" variant="outline" className="gap-2" onClick={() => downloadPDF(invoice)}>
                            <Download className="h-4 w-4" />
                            Download PDF
                          </Button>
                          <Button size="sm" variant="outline" className="gap-2" onClick={() => sendWhatsApp(invoice)}>
                            <Send className="h-4 w-4" />
                            Send WhatsApp
                          </Button>
                          {invoice.payment_status !== "paid" && (
                            <Button 
                              size="sm" 
                              className="gap-2"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setPaymentDialogOpen(true);
                              }}
                            >
                              <DollarSign className="h-4 w-4" />
                              Record Payment
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Invoice: {selectedInvoice?.invoice_number}</p>
                <p className="text-2xl font-bold text-primary mt-1">₹{selectedInvoice && Number(selectedInvoice.total_amount).toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full"
                onClick={() => recordPayment.mutate({ invoiceId: selectedInvoice.id, method: paymentMethod })}
                disabled={recordPayment.isPending}
              >
                {recordPayment.isPending ? "Recording..." : "Confirm Payment"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Invoice Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Invoice #{selectedInvoice?.invoice_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                {editItems.map((item, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>Service/Item</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateEditItem(index, "name", e.target.value)}
                        placeholder="Service name"
                      />
                    </div>
                    <div className="w-32">
                      <Label>Price (₹)</Label>
                      <Input
                        type="number"
                        value={item.price}
                        onChange={(e) => updateEditItem(index, "price", parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => removeEditItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={addEditItem} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
              <div className="pt-4 border-t">
                <p className="text-right text-sm text-muted-foreground">Subtotal</p>
                <p className="text-right text-2xl font-bold text-primary">
                  ₹{editItems.reduce((sum, item) => sum + Number(item.price), 0).toFixed(2)}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => updateInvoice.mutate({ invoiceId: selectedInvoice.id, items: editItems })}
                disabled={updateInvoice.isPending}
              >
                {updateInvoice.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Invoices;