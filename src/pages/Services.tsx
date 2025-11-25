import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  base_price: number;
  duration_minutes: number;
  is_active: boolean | null;
  materials_required: any;
}

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
    });
  };

  const openDetailDialog = (service: Service) => {
    setSelectedService(service);
    setDetailDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Services & Packages</h1>
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Service
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredServices.map((service) => (
                  <Card
                    key={service.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => openDetailDialog(service)}
                  >
                    <CardHeader>
                      <CardTitle className="flex justify-between items-start">
                        <span className="text-lg">{service.name}</span>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(service)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(service.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {service.category && (
                          <div className="text-sm text-muted-foreground">
                            {service.category}
                          </div>
                        )}
                        <div className="text-2xl font-bold text-primary">
                          ₹{service.base_price}
                        </div>
                        <div className="text-sm">
                          Duration: {service.duration_minutes} mins
                        </div>
                        <div className="text-sm">
                          Status:{" "}
                          <span
                            className={
                              service.is_active ? "text-success" : "text-destructive"
                            }
                          >
                            {service.is_active ? "Active" : "Inactive"}
                          </span>
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
          <DialogContent className="max-w-md">
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
                />
              </div>
              <div>
                <Label>Base Price (₹) *</Label>
                <Input
                  type="number"
                  value={formData.base_price}
                  onChange={(e) =>
                    setFormData({ ...formData, base_price: e.target.value })
                  }
                  placeholder="500"
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
                />
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
              <Button onClick={handleSubmit}>
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
                    <p className="text-xl font-bold text-primary">
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