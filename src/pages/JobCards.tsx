import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Car, User, Clock } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";

const JobCards = () => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  useRealtimeNotifications();

  const [formData, setFormData] = useState({
    customer_id: "",
    vehicle_id: "",
    services: [] as any[],
    damage_notes: "",
    internal_notes: ""
  });

  const { data: jobCards, isLoading } = useQuery({
    queryKey: ["jobCards", selectedDate],
    queryFn: async () => {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("job_cards")
        .select(`
          *,
          customers (name, phone),
          vehicles (vehicle_number, vehicle_type, brand, model)
        `)
        .gte("created_at", `${dateStr}T00:00:00`)
        .lte("created_at", `${dateStr}T23:59:59`)
        .order("created_at", { ascending: false });

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

      const { error } = await supabase.from("job_cards").insert({
        customer_id: data.customer_id,
        vehicle_id: data.vehicle_id,
        services: data.services,
        damage_notes: data.damage_notes || null,
        internal_notes: data.internal_notes || null,
        user_id: user.id,
        status: "check_in",
        check_in_time: new Date().toISOString()
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobCards"] });
      toast({ title: "Job card created" });
      setIsAddOpen(false);
      setFormData({
        customer_id: "",
        vehicle_id: "",
        services: [],
        damage_notes: "",
        internal_notes: ""
      });
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

  const getLifecycleStages = (job: any) => {
    const firstService = Array.isArray(job.services) && job.services[0];
    return (firstService as any)?.lifecycle_stages || ["check_in", "completed", "delivered"];
  };

  // Group jobs by stage
  const groupedJobs = jobCards?.reduce((acc: any, job: any) => {
    const stages = getLifecycleStages(job);
    if (!acc[job.status]) {
      acc[job.status] = [];
    }
    acc[job.status].push({ ...job, stages });
    return acc;
  }, {});

  // Get all unique stages from all jobs
  const allStages = Array.from(
    new Set(
      jobCards?.flatMap((job: any) => getLifecycleStages(job)) || []
    )
  );

  const stageColors: Record<string, string> = {
    check_in: "bg-blue-500",
    pre_wash: "bg-cyan-500",
    foam_wash: "bg-indigo-500",
    interior: "bg-purple-500",
    polishing: "bg-pink-500",
    qc: "bg-orange-500",
    completed: "bg-green-500",
    delivered: "bg-emerald-500"
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Job Cards - Kanban Board</h1>
            <p className="text-muted-foreground">Track daily workflow by stages</p>
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
                                services: [...formData.services, { 
                                  id: service.id, 
                                  name: service.name, 
                                  price: service.base_price,
                                  lifecycle_stages: service.lifecycle_stages 
                                }]
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

        {/* Calendar Navigation */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {format(selectedDate, "EEEE, MMMM dd, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading job cards...</div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {allStages.map((stage: string) => {
                const stageJobs = groupedJobs?.[stage] || [];
                
                return (
                  <div key={stage} className="flex-shrink-0 w-80">
                    <Card className="h-full">
                      <div className={cn("p-4 rounded-t-lg", stageColors[stage] || "bg-muted")}>
                        <h3 className="font-semibold text-white text-center">
                          {stage.replace(/_/g, ' ').toUpperCase()}
                        </h3>
                        <p className="text-sm text-white/80 text-center mt-1">
                          {stageJobs.length} {stageJobs.length === 1 ? 'job' : 'jobs'}
                        </p>
                      </div>
                      <CardContent className="p-4 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                        {stageJobs.length === 0 ? (
                          <p className="text-center text-muted-foreground text-sm py-8">No jobs</p>
                        ) : (
                          stageJobs.map((job: any) => (
                            <Card key={job.id} className="border-2 hover:shadow-md transition-shadow">
                              <CardContent className="p-4 space-y-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <Car className="h-4 w-4 text-primary" />
                                    <div>
                                      <p className="font-semibold text-sm">{job.vehicles?.vehicle_number}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {job.vehicles?.brand} {job.vehicles?.model}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span>{job.customers?.name}</span>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>{job.check_in_time ? format(new Date(job.check_in_time), "hh:mm a") : "N/A"}</span>
                                </div>

                                {/* Services */}
                                <div className="flex flex-wrap gap-1">
                                  {Array.isArray(job.services) && job.services.map((service: any, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {service.name}
                                    </Badge>
                                  ))}
                                </div>

                                {/* Stage Navigation */}
                                <div className="flex gap-2 pt-2">
                                  {job.stages.map((s: string, idx: number) => {
                                    const currentIdx = job.stages.indexOf(job.status);
                                    if (idx === currentIdx + 1) {
                                      return (
                                        <Button
                                          key={s}
                                          size="sm"
                                          variant="default"
                                          className="flex-1 text-xs"
                                          onClick={() => updateStatus.mutate({ id: job.id, status: s })}
                                        >
                                          Next
                                        </Button>
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default JobCards;
