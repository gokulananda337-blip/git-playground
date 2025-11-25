import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Phone, Mail, Users, Package, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Branches() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const [branchesRes, staffRes, inventoryRes] = await Promise.all([
      supabase.from("branches").select("*").eq("user_id", session.session.user.id),
      supabase.from("profiles").select("*").eq("user_id", session.session.user.id),
      supabase.from("inventory_items").select("*").eq("user_id", session.session.user.id),
    ]);

    if (branchesRes.data) setBranches(branchesRes.data);
    if (staffRes.data) setStaff(staffRes.data);
    if (inventoryRes.data) setInventoryItems(inventoryRes.data);
  };

  const handleAddBranch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const { error } = await supabase.from("branches").insert({
      user_id: session.session.user.id,
      name: formData.get("name") as string,
      address: formData.get("address") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      is_active: true,
    });

    if (error) {
      toast({ title: "Error adding branch", variant: "destructive" });
      return;
    }

    toast({ title: "Branch added successfully" });
    setIsAddBranchOpen(false);
    fetchData();
  };

  const toggleBranchStatus = async (branchId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("branches")
      .update({ is_active: !currentStatus })
      .eq("id", branchId);

    if (error) {
      toast({ title: "Error updating branch status", variant: "destructive" });
      return;
    }

    toast({ title: `Branch ${!currentStatus ? "activated" : "deactivated"}` });
    fetchData();
  };

  const getBranchStats = (branchId: string) => {
    const branchStaff = staff.filter((s) => s.branch_id === branchId);
    const branchInventory = inventoryItems.filter((i) => i.branch_id === branchId);
    return { staffCount: branchStaff.length, inventoryCount: branchInventory.length };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Branch Management</h1>
            <p className="text-muted-foreground">Manage multiple locations and their resources</p>
          </div>
          <Dialog open={isAddBranchOpen} onOpenChange={setIsAddBranchOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Branch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Branch</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddBranch} className="space-y-4">
                <div>
                  <Label>Branch Name</Label>
                  <Input name="name" placeholder="e.g., Downtown Branch" required />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input name="address" placeholder="Full address" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input name="phone" type="tel" placeholder="+91 12345 67890" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input name="email" type="email" placeholder="branch@example.com" />
                </div>
                <Button type="submit" className="w-full">Add Branch</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => {
            const stats = getBranchStats(branch.id);
            return (
              <Card key={branch.id} className="relative">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{branch.name}</CardTitle>
                    </div>
                    <Badge variant={branch.is_active ? "default" : "secondary"}>
                      {branch.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {branch.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground">{branch.address}</span>
                      </div>
                    )}
                    {branch.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{branch.phone}</span>
                      </div>
                    )}
                    {branch.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{branch.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Staff</p>
                        <p className="font-medium">{stats.staffCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Items</p>
                        <p className="font-medium">{stats.inventoryCount}</p>
                      </div>
                    </div>
                  </div>

                  {branch.whatsapp_verified && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/20 text-sm">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-green-900 dark:text-green-100">WhatsApp Connected</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedBranch(branch.id)}
                    >
                      View Details
                    </Button>
                    <Button
                      variant={branch.is_active ? "destructive" : "default"}
                      size="sm"
                      onClick={() => toggleBranchStatus(branch.id, branch.is_active)}
                    >
                      {branch.is_active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {selectedBranch && (
          <Card>
            <CardHeader>
              <CardTitle>Branch Details</CardTitle>
              <CardDescription>
                {branches.find((b) => b.id === selectedBranch)?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="staff">
                <TabsList>
                  <TabsTrigger value="staff">Staff ({staff.filter((s) => s.branch_id === selectedBranch).length})</TabsTrigger>
                  <TabsTrigger value="inventory">Inventory ({inventoryItems.filter((i) => i.branch_id === selectedBranch).length})</TabsTrigger>
                </TabsList>

                <TabsContent value="staff" className="space-y-3">
                  {staff
                    .filter((s) => s.branch_id === selectedBranch)
                    .map((member) => (
                      <div key={member.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{member.full_name || "Unnamed Staff"}</p>
                          <p className="text-sm text-muted-foreground">{member.phone}</p>
                        </div>
                      </div>
                    ))}
                  {staff.filter((s) => s.branch_id === selectedBranch).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No staff assigned to this branch
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="inventory" className="space-y-3">
                  {inventoryItems
                    .filter((i) => i.branch_id === selectedBranch)
                    .map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{item.category}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{item.current_stock} {item.unit}</p>
                          <p className="text-xs text-muted-foreground">Min: {item.min_stock}</p>
                        </div>
                      </div>
                    ))}
                  {inventoryItems.filter((i) => i.branch_id === selectedBranch).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No inventory items in this branch
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}