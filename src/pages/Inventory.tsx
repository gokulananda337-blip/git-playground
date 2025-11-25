import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, AlertTriangle, Package, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Inventory() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const [itemsRes, transactionsRes, vendorsRes, branchesRes] = await Promise.all([
      supabase.from("inventory_items").select("*").eq("user_id", session.session.user.id),
      supabase.from("inventory_transactions").select("*").eq("user_id", session.session.user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("vendors").select("*").eq("user_id", session.session.user.id),
      supabase.from("branches").select("*").eq("user_id", session.session.user.id),
    ]);

    if (itemsRes.data) setItems(itemsRes.data);
    if (transactionsRes.data) setTransactions(transactionsRes.data);
    if (vendorsRes.data) setVendors(vendorsRes.data);
    if (branchesRes.data) setBranches(branchesRes.data);
  };

  const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const { error } = await supabase.from("inventory_items").insert({
      user_id: session.session.user.id,
      name: formData.get("name") as string,
      category: formData.get("category") as string,
      unit: formData.get("unit") as string,
      current_stock: parseFloat(formData.get("current_stock") as string),
      min_stock: parseFloat(formData.get("min_stock") as string),
      cost_per_unit: parseFloat(formData.get("cost_per_unit") as string),
      supplier: formData.get("supplier") as string,
      branch_id: formData.get("branch_id") as string || null,
    });

    if (error) {
      toast({ title: "Error adding item", variant: "destructive" });
      return;
    }

    toast({ title: "Item added successfully" });
    setIsAddItemOpen(false);
    fetchData();
  };

  const handleAdjustStock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedItem) return;

    const formData = new FormData(e.currentTarget);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const quantity = parseFloat(formData.get("quantity") as string);
    const type = formData.get("type") as string;
    const actualQuantity = type === "in" ? quantity : -quantity;

    const { error: transactionError } = await supabase.from("inventory_transactions").insert({
      user_id: session.session.user.id,
      item_id: selectedItem.id,
      branch_id: selectedItem.branch_id || null,
      quantity: actualQuantity,
      transaction_type: type as any,
      reference_type: "manual",
      notes: formData.get("notes") as string || null,
    });

    if (transactionError) {
      toast({ title: "Error recording transaction", variant: "destructive" });
      return;
    }

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({ current_stock: selectedItem.current_stock + actualQuantity })
      .eq("id", selectedItem.id);

    if (updateError) {
      toast({ title: "Error updating stock", variant: "destructive" });
      return;
    }

    toast({ title: "Stock adjusted successfully" });
    setIsAdjustStockOpen(false);
    setSelectedItem(null);
    fetchData();
  };

  const handleAddVendor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const { error } = await supabase.from("vendors").insert({
      user_id: session.session.user.id,
      name: formData.get("name") as string,
      contact_person: formData.get("contact_person") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      address: formData.get("address") as string,
    });

    if (error) {
      toast({ title: "Error adding vendor", variant: "destructive" });
      return;
    }

    toast({ title: "Vendor added successfully" });
    setIsAddVendorOpen(false);
    fetchData();
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockItems = items.filter((item) => item.current_stock <= item.min_stock);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground">Track consumables, stock levels, and vendors</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={isAddVendorOpen} onOpenChange={setIsAddVendorOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Vendor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Vendor</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddVendor} className="space-y-4">
                  <div>
                    <Label>Vendor Name</Label>
                    <Input name="name" required />
                  </div>
                  <div>
                    <Label>Contact Person</Label>
                    <Input name="contact_person" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input name="email" type="email" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input name="phone" />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input name="address" />
                  </div>
                  <Button type="submit" className="w-full">Add Vendor</Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Inventory Item</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddItem} className="space-y-4">
                  <div>
                    <Label>Item Name</Label>
                    <Input name="name" placeholder="e.g., Car Wash Soap" required />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Input name="category" placeholder="e.g., Chemicals, Tools" />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Input name="unit" placeholder="e.g., liters, pieces, kg" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Current Stock</Label>
                      <Input name="current_stock" type="number" step="0.01" defaultValue="0" required />
                    </div>
                    <div>
                      <Label>Min Stock Alert</Label>
                      <Input name="min_stock" type="number" step="0.01" defaultValue="0" required />
                    </div>
                  </div>
                  <div>
                    <Label>Cost per Unit</Label>
                    <Input name="cost_per_unit" type="number" step="0.01" />
                  </div>
                  <div>
                    <Label>Supplier</Label>
                    <Input name="supplier" />
                  </div>
                  <div>
                    <Label>Branch</Label>
                    <select name="branch_id" className="w-full rounded-lg border border-input bg-background px-3 py-2">
                      <option value="">All Branches</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit" className="w-full">Add Item</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {lowStockItems.length > 0 && (
          <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-orange-900 dark:text-orange-100">Low Stock Alert</CardTitle>
              </div>
              <CardDescription className="text-orange-800 dark:text-orange-200">
                {lowStockItems.length} item(s) need restocking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-background rounded-lg">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Current: {item.current_stock} {item.unit} | Min: {item.min_stock} {item.unit}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedItem(item);
                        setIsAdjustStockOpen(true);
                      }}
                    >
                      Restock
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="items" className="space-y-4">
          <TabsList>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                      </div>
                      {item.current_stock <= item.min_stock && (
                        <Badge variant="destructive">Low</Badge>
                      )}
                    </div>
                    {item.category && (
                      <CardDescription>{item.category}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Current Stock</span>
                        <span className="font-medium">
                          {item.current_stock} {item.unit}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Min Stock</span>
                        <span>{item.min_stock} {item.unit}</span>
                      </div>
                      {item.cost_per_unit && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Cost/Unit</span>
                          <span>₹{item.cost_per_unit}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setSelectedItem(item);
                        setIsAdjustStockOpen(true);
                      }}
                    >
                      Adjust Stock
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Last 50 inventory movements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {transactions.map((txn) => {
                    const item = items.find((i) => i.id === txn.item_id);
                    return (
                      <div key={txn.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {txn.quantity > 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          <div>
                            <p className="font-medium">{item?.name || "Unknown Item"}</p>
                            <p className="text-sm text-muted-foreground">
                              {txn.transaction_type} • {new Date(txn.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${txn.quantity > 0 ? "text-green-600" : "text-red-600"}`}>
                            {txn.quantity > 0 ? "+" : ""}{txn.quantity} {item?.unit}
                          </p>
                          {txn.notes && (
                            <p className="text-xs text-muted-foreground">{txn.notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendors" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {vendors.map((vendor) => (
                <Card key={vendor.id}>
                  <CardHeader>
                    <CardTitle>{vendor.name}</CardTitle>
                    {vendor.contact_person && (
                      <CardDescription>{vendor.contact_person}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {vendor.phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span>{vendor.phone}</span>
                      </div>
                    )}
                    {vendor.email && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span>{vendor.email}</span>
                      </div>
                    )}
                    {vendor.address && (
                      <div>
                        <span className="text-muted-foreground block mb-1">Address</span>
                        <p className="text-xs">{vendor.address}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isAdjustStockOpen} onOpenChange={setIsAdjustStockOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Stock - {selectedItem?.name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div>
                <Label>Current Stock</Label>
                <Input value={`${selectedItem?.current_stock || 0} ${selectedItem?.unit || ""}`} disabled />
              </div>
              <div>
                <Label>Transaction Type</Label>
                <select name="type" className="w-full rounded-lg border border-input bg-background px-3 py-2" required>
                  <option value="in">Stock In (Add)</option>
                  <option value="out">Stock Out (Remove)</option>
                </select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input name="quantity" type="number" step="0.01" required />
              </div>
              <div>
                <Label>Notes</Label>
                <Input name="notes" placeholder="Reason for adjustment" />
              </div>
              <Button type="submit" className="w-full">Adjust Stock</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}