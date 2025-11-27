import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Car, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";

const Vehicles = () => {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: vehicleHistory } = useQuery({
    queryKey: ["vehicle-history", selectedVehicle?.id],
    queryFn: async () => {
      if (!selectedVehicle) return [];
      
      // First get all bookings for this vehicle
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("*")
        .eq("vehicle_id", selectedVehicle.id)
        .order("booking_date", { ascending: false });
      
      if (bookingsError) throw bookingsError;
      if (!bookings) return [];
      
      // Then get job cards for each booking
      const bookingsWithJobCards = await Promise.all(
        bookings.map(async (booking) => {
          const { data: jobCard } = await supabase
            .from("job_cards")
            .select("status, check_in_time, check_out_time")
            .eq("booking_id", booking.id)
            .maybeSingle();
          
          return {
            ...booking,
            job_card: jobCard
          };
        })
      );
      
      return bookingsWithJobCards;
    },
    enabled: !!selectedVehicle
  });

  const [formData, setFormData] = useState({
    vehicle_number: "",
    vehicle_type: "sedan" as any,
    brand: "",
    model: "",
    color: "",
    customer_id: "",
    notes: ""
  });

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select(`
          *,
          customers (
            id,
            name,
            phone
          )
        `)
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

  const addVehicle = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("vehicles").insert({
        ...data,
        user_id: user.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Vehicle added successfully" });
      setIsAddOpen(false);
      setFormData({
        vehicle_number: "",
        vehicle_type: "sedan",
        brand: "",
        model: "",
        color: "",
        customer_id: "",
        notes: ""
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const filteredVehicles = vehicles?.filter(v =>
    v.vehicle_number.toLowerCase().includes(search.toLowerCase()) ||
    v.brand?.toLowerCase().includes(search.toLowerCase()) ||
    v.model?.toLowerCase().includes(search.toLowerCase()) ||
    v.customers?.name.toLowerCase().includes(search.toLowerCase())
  );

  const vehicleTypeColors: Record<string, string> = {
    hatchback: "bg-blue-500",
    sedan: "bg-green-500",
    suv: "bg-orange-500",
    luxury: "bg-purple-500",
    bike: "bg-red-500"
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Vehicles</h1>
            <p className="text-muted-foreground">Manage vehicle records and service history</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Vehicle</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vehicle Number *</Label>
                    <Input
                      placeholder="TN01AB1234"
                      value={formData.vehicle_number}
                      onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vehicle Type *</Label>
                    <Select value={formData.vehicle_type} onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hatchback">Hatchback</SelectItem>
                        <SelectItem value="sedan">Sedan</SelectItem>
                        <SelectItem value="suv">SUV</SelectItem>
                        <SelectItem value="luxury">Luxury</SelectItem>
                        <SelectItem value="bike">Bike</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Brand</Label>
                    <Input
                      placeholder="Toyota"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Input
                      placeholder="Camry"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input
                      placeholder="White"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer *</Label>
                    <Select value={formData.customer_id} onValueChange={(value) => setFormData({ ...formData, customer_id: value })}>
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
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Any additional notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                <Button onClick={() => addVehicle.mutate(formData)} disabled={!formData.vehicle_number || !formData.customer_id}>
                  Add Vehicle
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by vehicle number, brand, model, or customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading vehicles...</div>
            ) : filteredVehicles?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No vehicles found</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredVehicles?.map((vehicle) => (
                  <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-lg ${vehicleTypeColors[vehicle.vehicle_type]} flex items-center justify-center`}>
                            <Car className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-lg">{vehicle.vehicle_number}</p>
                            <Badge variant="secondary" className="text-xs capitalize">{vehicle.vehicle_type}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        {vehicle.brand && (
                          <p><span className="text-muted-foreground">Brand:</span> {vehicle.brand} {vehicle.model}</p>
                        )}
                        {vehicle.color && (
                          <p><span className="text-muted-foreground">Color:</span> {vehicle.color}</p>
                        )}
                        <p><span className="text-muted-foreground">Owner:</span> {vehicle.customers?.name}</p>
                        <p className="text-xs text-muted-foreground">{vehicle.customers?.phone}</p>
                      </div>
                      {vehicle.notes && (
                        <p className="text-xs text-muted-foreground border-t pt-2">{vehicle.notes}</p>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 gap-1"
                          onClick={() => navigate(`/bookings?vehicle=${vehicle.id}&customer=${vehicle.customer_id}`)}
                        >
                          <Calendar className="h-3 w-3" />
                          Book
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 gap-1"
                          onClick={() => {
                            setSelectedVehicle(vehicle);
                            setHistoryOpen(true);
                          }}
                        >
                          <FileText className="h-3 w-3" />
                          History
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Service History - {selectedVehicle?.vehicle_number}
              </DialogTitle>
            </DialogHeader>
            {!vehicleHistory || vehicleHistory.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No service history found</p>
            ) : (
              <div className="space-y-3">
                {vehicleHistory.map((record: any) => (
                  <Card key={record.id}>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{format(new Date(record.booking_date), "MMM dd, yyyy")} - {record.booking_time}</p>
                          <Badge className="capitalize">{record.status}</Badge>
                        </div>
                        {record.job_card && (
                          <div className="text-sm text-muted-foreground">
                            <p>Job Status: <span className="capitalize">{record.job_card.status?.replace("_", " ")}</span></p>
                            {record.job_card.check_in_time && (
                              <p>Check-in: {format(new Date(record.job_card.check_in_time), "MMM dd, HH:mm")}</p>
                            )}
                            {record.job_card.check_out_time && (
                              <p>Check-out: {format(new Date(record.job_card.check_out_time), "MMM dd, HH:mm")}</p>
                            )}
                          </div>
                        )}
                        {!record.job_card && record.status === "confirmed" && (
                          <p className="text-sm text-muted-foreground">Job card not yet created</p>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(record.services) && record.services.map((service: any, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">{service.name}</Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Vehicles;
