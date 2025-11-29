import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle2, Clock, User, Car, Calendar as CalendarIcon, Filter } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const JobCards = () => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    customer_id: "",
    vehicle_id: "",
    booking_id: "",
    services: [] as any[],
    damage_notes: "",
    internal_notes: ""
  });

  const { data: jobCards, isLoading } = useQuery({
    queryKey: ["jobCards", statusFilter, selectedDate],
    queryFn: async () => {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      let query = supabase
        .from("job_cards")
        .select(`
          *,
          customers (name, phone),
          vehicles (vehicle_number, vehicle_type, brand, model),
          bookings (booking_date, booking_time)
        `)
        .gte("created_at", `${dateStr}T00:00:00`)
        .lte("created_at", `${dateStr}T23:59:59`)
        .order("created_at", { ascending: false });

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

  const addJobCard = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload: any = {
        customer_id: data.customer_id,
        vehicle_id: data.vehicle_id,
        services: data.services,
        damage_notes: data.damage_notes || null,
        internal_notes: data.internal_notes || null,
        user_id: user.id,
        status: "check_in",
        check_in_time: new Date().toISOString()
      };

      if (data.booking_id) {
        payload.booking_id = data.booking_id;
      }

      const { error } = await supabase.from("job_cards").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobCards"] });
      toast({ title: "Job card created successfully" });
      setIsAddOpen(false);
      setFormData({
        customer_id: "",
        vehicle_id: "",
        booking_id: "",
        services: [],
        damage_notes: "",
        internal_notes: ""
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("job_cards")
        .update({ status: status as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobCards"] });
      toast({ title: "Status updated" });
    }
  });

  const createInvoice = useMutation({
    mutationFn: async (job: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existingInvoice } = await supabase
        .from("invoices")
        .select("id")
        .eq("job_card_id", job.id)
        .maybeSingle();

      if (existingInvoice) throw new Error("Invoice already exists");

      const services = Array.isArray(job.services) ? job.services : [];
      const subtotal = services.reduce((sum: number, s: any) => sum + Number(s.price || 0), 0);
      const invoiceNumber = `INV-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;

      const { error } = await supabase.from("invoices").insert({
        user_id: user.id,
        customer_id: job.customer_id,
        booking_id: job.booking_id,
        job_card_id: job.id,
        invoice_number: invoiceNumber,
        items: services,
        subtotal,
        tax_amount: 0,
        discount: 0,
        total_amount: subtotal,
        payment_status: "unpaid"
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Invoice created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Job Cards</h1>
            <p className="text-muted-foreground">Track service workflow</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Job Card
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Job Card</DialogTitle>
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
                              setFormData({
                                ...formData,
                                services: [...formData.services, { id: service.id, name: service.name, price: service.base_price }]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                services: formData.services.filter(s => s.id !== service.id)
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{service.name} - ₹{service.base_price}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Damage Notes</Label>
                  <Textarea
                    placeholder="Document any existing damage..."
                    value={formData.damage_notes}
                    onChange={(e) => setFormData({ ...formData, damage_notes: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Internal Notes</Label>
                  <Textarea
                    placeholder="Internal notes..."
                    value={formData.internal_notes}
                    onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                  />
                </div>

                <Button
                  onClick={() => addJobCard.mutate(formData)}
                  disabled={!formData.customer_id || !formData.vehicle_id || formData.services.length === 0 || addJobCard.isPending}
                >
                  {addJobCard.isPending ? "Creating..." : "Create Job Card"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="check_in">Check In</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {format(selectedDate, "MMM dd, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading job cards...</div>
            ) : jobCards?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No job cards for this date</div>
            ) : (
              <div className="space-y-4">
                {jobCards?.map((job) => (
                  <Card key={job.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              <Badge className="bg-primary text-primary-foreground">
                                {job.status}
                              </Badge>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                {job.check_in_time ? new Date(job.check_in_time).toLocaleString() : "N/A"}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{job.customers?.name}</p>
                                  <p className="text-xs text-muted-foreground">{job.customers?.phone}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Car className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{job.vehicles?.vehicle_number}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {job.vehicles?.brand} {job.vehicles?.model}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 items-center">
                            <Select
                              value={job.status}
                              onValueChange={(value) => updateStatus.mutate({ id: job.id, status: value })}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(() => {
                                  const firstService = Array.isArray(job.services) && job.services[0];
                                  const stages = (firstService as any)?.lifecycle_stages || ["check_in", "completed", "delivered"];
                                  return stages.map((stage: string, index: number) => (
                                    <SelectItem key={stage} value={stage}>
                                      {index + 1}. {stage.replace(/_/g, " ").toUpperCase()}
                                    </SelectItem>
                                  ));
                                })()}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => createInvoice.mutate(job)}
                              disabled={job.status !== "delivered" && job.status !== "completed"}
                            >
                              Create Invoice
                            </Button>
                          </div>
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

export default JobCards;
