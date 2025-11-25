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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle2, Clock, User, Car, Camera } from "lucide-react";

const JobCards = () => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
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

  const jobStages = [
    { value: "check_in", label: "Check In", icon: "🚗" },
    { value: "pre_wash", label: "Pre-Wash", icon: "💧" },
    { value: "foam_wash", label: "Foam Wash", icon: "🫧" },
    { value: "interior", label: "Interior", icon: "🧹" },
    { value: "polishing", label: "Polishing", icon: "✨" },
    { value: "qc", label: "Quality Check", icon: "👁️" },
    { value: "completed", label: "Completed", icon: "✅" },
    { value: "delivered", label: "Delivered", icon: "🎉" }
  ];

  const { data: jobCards, isLoading } = useQuery({
    queryKey: ["jobCards", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("job_cards")
        .select(`
          *,
          customers (name, phone),
          vehicles (vehicle_number, vehicle_type, brand, model),
          bookings (booking_date, booking_time)
        `)
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
    mutationFn: async ({ id, status, jobCard }: { id: string; status: string; jobCard?: any }) => {
      const updates: any = { status };
      if (status === "delivered") {
        updates.check_out_time = new Date().toISOString();
      }
      const { error } = await supabase
        .from("job_cards")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      // Sync status back to booking if exists
      if (jobCard?.booking_id) {
        let bookingStatus = "pending";
        if (status === "check_in") bookingStatus = "confirmed";
        else if (status === "pre_wash" || status === "foam_wash" || status === "interior" || status === "polishing" || status === "qc") bookingStatus = "in_progress";
        else if (status === "completed") bookingStatus = "completed";
        else if (status === "delivered") bookingStatus = "completed";

        const { error: bookingError } = await supabase
          .from("bookings")
          .update({ status: bookingStatus as any })
          .eq("id", jobCard.booking_id);

        if (bookingError) {
          console.error("Error syncing booking status:", bookingError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobCards"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast({ title: "Status updated" });
    }
  });

  const createInvoice = useMutation({
    mutationFn: async (job: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existingInvoice, error: existingError } = await supabase
        .from("invoices")
        .select("id")
        .eq("job_card_id", job.id)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existingInvoice) {
        throw new Error("Invoice already exists for this job card");
      }

      const services = Array.isArray(job.services) ? job.services : [];
      const subtotal = services.reduce((sum: number, s: any) => sum + Number(s.price || 0), 0);
      const taxAmount = 0;
      const discount = 0;
      const total = subtotal - discount + taxAmount;

      const invoiceNumber = `INV-${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;

      const { error } = await supabase.from("invoices").insert({
        user_id: user.id,
        customer_id: job.customer_id,
        booking_id: job.booking_id,
        job_card_id: job.id,
        invoice_number: invoiceNumber,
        items: services,
        subtotal,
        tax_amount: taxAmount,
        discount,
        total_amount: total,
        payment_status: "unpaid"
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Invoice created", description: "You can manage it from the Invoices page." });
    },
    onError: (error: any) => {
      toast({ title: "Error creating invoice", description: error.message, variant: "destructive" });
    }
  });

  const stageColors: Record<string, string> = {
    check_in: "bg-blue-500",
    pre_wash: "bg-cyan-500",
    foam_wash: "bg-purple-500",
    interior: "bg-orange-500",
    polishing: "bg-pink-500",
    qc: "bg-yellow-500",
    completed: "bg-green-500",
    delivered: "bg-emerald-600"
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Job Cards</h1>
            <p className="text-muted-foreground">Track service workflow and job progress</p>
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
                    placeholder="Internal notes for staff..."
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
                <Label>Filter by Stage:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    {jobStages.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.icon} {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>Filter by Service:</Label>
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    {services?.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading job cards...</div>
            ) : jobCards?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No job cards found</div>
            ) : (
              <div className="space-y-4">
                {jobCards
                  ?.filter((job) => {
                    if (serviceFilter === "all") return true;
                    return Array.isArray(job.services) && job.services.some((s: any) => s.id === serviceFilter);
                  })
                  .map((job) => {
                  const currentStageIndex = jobStages.findIndex(s => s.value === job.status);
                  return (
                    <Card key={job.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-3">
                                <Badge className={`${stageColors[job.status]} text-white`}>
                                  {jobStages.find(s => s.value === job.status)?.icon} {jobStages.find(s => s.value === job.status)?.label}
                                </Badge>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  Check-in: {job.check_in_time ? new Date(job.check_in_time).toLocaleString() : "N/A"}
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
                                    <p className="text-xs text-muted-foreground capitalize">
                                      {job.vehicles?.brand} {job.vehicles?.model}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {Array.isArray(job.services) && job.services.map((service: any, idx: number) => (
                                  <Badge key={idx} variant="secondary">{service.name}</Badge>
                                ))}
                              </div>
                              {job.damage_notes && (
                                <div className="border-t pt-2">
                                  <p className="text-xs font-medium text-red-600">Damage Notes:</p>
                                  <p className="text-sm text-muted-foreground">{job.damage_notes}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 ml-4">
                              <Select
                                value={job.status}
                                onValueChange={(value) => updateStatus.mutate({ id: job.id, status: value, jobCard: job })}
                              >
                                <SelectTrigger className="w-44">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {jobStages.map((stage) => (
                                    <SelectItem key={stage.value} value={stage.value}>
                                      {stage.icon} {stage.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant="outline" className="gap-1">
                                <Camera className="h-3 w-3" />
                                Photos
                              </Button>
                              {job.status === "completed" && (
                              <Button 
                                size="sm"
                                onClick={() => createInvoice.mutate(job)}
                                disabled={createInvoice.isPending}
                              >
                                {createInvoice.isPending ? "Generating..." : "Generate Invoice"}
                              </Button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {jobStages.map((stage, idx) => (
                              <div key={stage.value} className="flex items-center flex-1">
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${idx <= currentStageIndex ? stageColors[stage.value] : "bg-muted"} text-white text-xs`}>
                                  {idx <= currentStageIndex ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                                </div>
                                {idx < jobStages.length - 1 && (
                                  <div className={`flex-1 h-1 ${idx < currentStageIndex ? stageColors[stage.value] : "bg-muted"}`} />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default JobCards;
