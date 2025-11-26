import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, Package } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  base_price: number;
  duration_minutes: number;
  is_active: boolean | null;
  lifecycle_stages: any;
}

const DEFAULT_STAGES = ["check_in", "pre_wash", "foam_wash", "interior", "polishing", "qc", "completed", "delivered"];

const Services = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    base_price: "",
    duration_minutes: "30",
    is_active: true,
    lifecycle_stages: DEFAULT_STAGES,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    const filtered = services.filter(
      (service) =>
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredServices(filtered);
  }, [searchQuery, services]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServices(data || []);
      setFilteredServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({
        title: "Error",
        description: "Failed to load services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const serviceData = {
        ...formData,
        base_price: parseFloat(formData.base_price),
        duration_minutes: parseInt(formData.duration_minutes),
        user_id: userData.user.id,
      };

      if (selectedService) {
        const { error } = await supabase
          .from("services")
          .update(serviceData)
          .eq("id", selectedService.id);

        if (error) throw error;
        toast({ title: "Service updated successfully" });
      } else {
        const { error } = await supabase.from("services").insert([serviceData]);

        if (error) throw error;
        toast({ title: "Service created successfully" });
      }

      setDialogOpen(false);
      resetForm();
      fetchServices();
    } catch (error) {
      console.error("Error saving service:", error);
      toast({
        title: "Error",
        description: "Failed to save service",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    try {
      const { error } = await supabase.from("services").delete().eq("id", id);

      if (error) throw error;
      toast({ title: "Service deleted successfully" });
      fetchServices();
    } catch (error) {
      console.error("Error deleting service:", error);
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (service: Service) => {
    setSelectedService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      category: service.category || "",
      base_price: service.base_price.toString(),
      duration_minutes: service.duration_minutes.toString(),
      is_active: service.is_active ?? true,
      lifecycle_stages: Array.isArray(service.lifecycle_stages) ? service.lifecycle_stages : DEFAULT_STAGES,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedService(null);
    setFormData({
      name: "",
      description: "",
      category: "",
      base_price: "",
      duration_minutes: "30",
      is_active: true,
      lifecycle_stages: DEFAULT_STAGES,
    });
  };

  const openDetailDialog = (service: Service) => {
    setSelectedService(service);
    setDetailDialogOpen(true);
  };

  const toggleStage = (stage: string) => {
    const stages = formData.lifecycle_stages.includes(stage)
      ? formData.lifecycle_stages.filter(s => s !== stage)
      : [...formData.lifecycle_stages, stage];
    setFormData({ ...formData, lifecycle_stages: stages });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 bg-gradient-to-br from-background via-secondary/20 to-background min-h-screen">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Services & Packages</h1>
            <p className="text-muted-foreground mt-1">Manage wash services and lifecycle stages</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Service
          </Button>
        </div>

        <Card className="shadow-md border-border/50">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm border-border/50"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredServices.map((service) => (
                  <Card
                    key={service.id}
                    className="cursor-pointer hover:shadow-md transition-all border-border/50 hover:border-primary/30"
                    onClick={() => openDetailDialog(service)}
                  >
                    <CardHeader>
                      <CardTitle className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-primary" />
                          <span className="text-lg">{service.name}</span>
                        </div>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(service)}
                            className="hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(service.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {service.category && (
                          <Badge variant="outline" className="text-xs">
                            {service.category}
                          </Badge>
                        )}
                        <div className="text-2xl font-bold text-primary">
                          ₹{service.base_price}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Duration: {service.duration_minutes} mins
                        </div>
                        <div className="text-sm">
                          Status:{" "}
                          <span
                            className={
                              service.is_active ? "text-success font-semibold" : "text-destructive font-semibold"
                            }
                          >
                            {service.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {service.lifecycle_stages?.length || 0} lifecycle stages
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedService ? "Edit Service" : "Add New Service"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Service Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Premium Wash"
                  className="border-border/50"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  placeholder="e.g., Exterior Wash"
                  className="border-border/50"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Service description"
                  className="border-border/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Base Price (₹) *</Label>
                  <Input
                    type="number"
                    value={formData.base_price}
                    onChange={(e) =>
                      setFormData({ ...formData, base_price: e.target.value })
                    }
                    placeholder="500"
                    className="border-border/50"
                  />
                </div>
                <div>
                  <Label>Duration (minutes) *</Label>
                  <Input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        duration_minutes: e.target.value,
                      })
                    }
                    placeholder="30"
                    className="border-border/50"
                  />
                </div>
              </div>
              
              <div>
                <Label className="mb-3 block">Lifecycle Stages *</Label>
                <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg border-border/50 bg-muted/20">
                  {DEFAULT_STAGES.map((stage) => (
                    <label key={stage} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-accent/10 rounded">
                      <input
                        type="checkbox"
                        checked={formData.lifecycle_stages.includes(stage)}
                        onChange={() => toggleStage(stage)}
                        className="rounded"
                      />
                      <span className="text-sm capitalize">{stage.replace("_", " ")}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Select stages that apply to this service. These will appear in job cards.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="shadow-md">
                {selectedService ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Service Details</DialogTitle>
            </DialogHeader>
            {selectedService && (
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Service Name</Label>
                  <p className="text-lg font-semibold">{selectedService.name}</p>
                </div>
                {selectedService.category && (
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p>{selectedService.category}</p>
                  </div>
                )}
                {selectedService.description && (
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p>{selectedService.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Base Price</Label>
                    <p className="text-2xl font-bold text-primary">
                      ₹{selectedService.base_price}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Duration</Label>
                    <p className="text-xl font-bold">
                      {selectedService.duration_minutes} mins
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Lifecycle Stages</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedService.lifecycle_stages?.map((stage, idx) => (
                      <Badge key={idx} variant="secondary" className="capitalize">
                        {stage.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p
                    className={
                      selectedService.is_active
                        ? "text-success font-semibold"
                        : "text-destructive font-semibold"
                    }
                  >
                    {selectedService.is_active ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Services;