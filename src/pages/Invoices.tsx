import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, FileText, Download, Send, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import jsPDF from "jspdf";

const Invoices = () => {
  const [search, setSearch] = useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const { toast } = useToast();

  const { data: companyInfo } = useQuery({
    queryKey: ["company-info"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("branches")
        .select("name, email, phone, address")
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
          customers (name, phone),
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
    let y = 20;

    // Company info (left)
    doc.setFontSize(14);
    doc.text(companyInfo.name || "", 20, y);
    doc.setFontSize(10);
    if (companyInfo.address) {
      doc.text(companyInfo.address, 20, (y += 6));
    }
    if (companyInfo.phone) {
      doc.text(`Phone: ${companyInfo.phone}`, 20, (y += 6));
    }
    if (companyInfo.email) {
      doc.text(`Email: ${companyInfo.email}`, 20, (y += 6));
    }

    // Invoice header (right)
    const invoiceTop = 20;
    doc.setFontSize(16);
    doc.text("INVOICE", 190, invoiceTop, { align: "right" });
    doc.setFontSize(10);
    doc.text(`Invoice No: ${invoice.invoice_number}`, 190, invoiceTop + 8, { align: "right" });
    doc.text(`Date: ${format(new Date(invoice.created_at), "MMM dd, yyyy")}`, 190, invoiceTop + 14, { align: "right" });

    // Customer details
    y += 14;
    doc.setFontSize(12);
    doc.text("Bill To:", 20, y);
    doc.setFontSize(10);
    doc.text(invoice.customers?.name || "", 20, (y += 6));
    if (invoice.customers?.phone) {
      doc.text(invoice.customers.phone, 20, (y += 6));
    }

    // Services table
    y += 10;
    doc.setFontSize(12);
    doc.text("Services", 20, y);
    y += 6;
    doc.setFontSize(10);
    doc.text("Description", 20, y);
    doc.text("Amount", 190, y, { align: "right" });
    y += 4;
    doc.line(20, y, 190, y);

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    items.forEach((item: any) => {
      y += 6;
      doc.text(item.name || "Service", 20, y);
      doc.text(`₹${Number(item.price || 0).toFixed(2)}`, 190, y, { align: "right" });
    });

    // Totals
    y += 10;
    doc.line(120, y, 190, y);
    y += 6;
    doc.text("Subtotal", 120, y);
    doc.text(`₹${Number(invoice.subtotal).toFixed(2)}`, 190, y, { align: "right" });
    if (invoice.discount && Number(invoice.discount) > 0) {
      y += 6;
      doc.text("Discount", 120, y);
      doc.text(`-₹${Number(invoice.discount).toFixed(2)}`, 190, y, { align: "right" });
    }
    if (invoice.tax_amount && Number(invoice.tax_amount) > 0) {
      y += 6;
      doc.text("Tax", 120, y);
      doc.text(`₹${Number(invoice.tax_amount).toFixed(2)}`, 190, y, { align: "right" });
    }
    y += 6;
    doc.setFontSize(12);
    doc.text("Total", 120, y);
    doc.text(`₹${Number(invoice.total_amount).toFixed(2)}`, 190, y, { align: "right" });

    doc.save(`${invoice.invoice_number}.pdf`);
    toast({ title: "Invoice downloaded" });
  };

  const sendWhatsApp = (invoice: any) => {
    const phone = invoice.customers?.phone?.replace(/[^0-9]/g, "");
    if (!phone) {
      toast({ title: "No customer phone number", variant: "destructive" });
      return;
    }
    const message = `Invoice ${invoice.invoice_number}\nTotal: ₹${Number(invoice.total_amount).toFixed(2)}\nStatus: ${invoice.payment_status || "unpaid"}`;
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
                  <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-bold text-lg">{invoice.invoice_number}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(invoice.created_at), "MMM dd, yyyy HH:mm")}
                              </p>
                            </div>
                            <Badge className={`${statusColors[invoice.payment_status || "unpaid"]} text-white ml-2 capitalize`}>
                              {invoice.payment_status || "unpaid"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Customer</p>
                              <p className="font-medium">{invoice.customers?.name}</p>
                              <p className="text-xs text-muted-foreground">{invoice.customers?.phone}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Vehicle</p>
                              <p className="font-medium">{invoice.job_cards?.vehicles?.vehicle_number}</p>
                              <p className="text-xs text-muted-foreground">
                                {invoice.job_cards?.vehicles?.brand} {invoice.job_cards?.vehicles?.model}
                              </p>
                            </div>
                          </div>
                          <div className="border-t pt-3">
                            <div className="grid grid-cols-4 gap-2 text-sm">
                              <div>
                                <p className="text-muted-foreground">Subtotal</p>
                                <p className="font-medium">₹{Number(invoice.subtotal).toFixed(2)}</p>
                              </div>
                              {invoice.discount && Number(invoice.discount) > 0 && (
                                <div>
                                  <p className="text-muted-foreground">Discount</p>
                                  <p className="font-medium text-green-600">-₹{Number(invoice.discount).toFixed(2)}</p>
                                </div>
                              )}
                              {invoice.tax_amount && Number(invoice.tax_amount) > 0 && (
                                <div>
                                  <p className="text-muted-foreground">Tax</p>
                                  <p className="font-medium">₹{Number(invoice.tax_amount).toFixed(2)}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-muted-foreground">Total</p>
                                <p className="font-bold text-lg text-primary">₹{Number(invoice.total_amount).toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                          {invoice.payment_method && (
                            <p className="text-xs text-muted-foreground">
                              Payment: <span className="capitalize">{invoice.payment_method}</span>
                              {invoice.paid_at && ` on ${format(new Date(invoice.paid_at), "MMM dd, yyyy")}`}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadPDF(invoice)}>
                            <Download className="h-3 w-3" />
                            PDF
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => sendWhatsApp(invoice)}>
                            <Send className="h-3 w-3" />
                            WhatsApp
                          </Button>
                          {invoice.payment_status !== "paid" && (
                            <Button 
                              size="sm" 
                              className="gap-1"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setPaymentDialogOpen(true);
                              }}
                            >
                              <DollarSign className="h-3 w-3" />
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

        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Invoice: {selectedInvoice?.invoice_number}</p>
                <p className="text-lg font-bold">Amount: ₹{selectedInvoice && Number(selectedInvoice.total_amount).toFixed(2)}</p>
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
      </div>
    </DashboardLayout>
  );
};

export default Invoices;
