import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Gift, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Subscriptions() {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const [subsRes, customersRes] = await Promise.all([
      supabase.from("subscriptions").select("*, customers(name, phone)").eq("user_id", session.session.user.id),
      supabase.from("customers").select("*").eq("user_id", session.session.user.id),
    ]);

    if (subsRes.data) setSubscriptions(subsRes.data);
    if (customersRes.data) setCustomers(customersRes.data);
  };

  const handleAddSubscription = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const { error } = await supabase.from("subscriptions").insert({
      user_id: session.session.user.id,
      customer_id: formData.get("customer_id") as string,
      plan_name: formData.get("plan_name") as string,
      total_washes: parseInt(formData.get("total_washes") as string),
      amount: parseFloat(formData.get("amount") as string),
      start_date: formData.get("start_date") as string,
      end_date: formData.get("end_date") as string,
      auto_renew: formData.get("auto_renew") === "on",
    });

    if (error) {
      toast({ title: "Error creating subscription", variant: "destructive" });
      return;
    }

    toast({ title: "Subscription created successfully" });
    setIsAddOpen(false);
    fetchData();
  };

  const filteredSubscriptions = subscriptions.filter((sub) =>
    sub.customers?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Subscriptions & Memberships</h1>
            <p className="text-muted-foreground">Manage wash passes and recurring plans</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Subscription
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Subscription</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddSubscription} className="space-y-4">
                <div>
                  <Label>Customer</Label>
                  <select name="customer_id" className="w-full rounded-lg border border-input bg-background px-3 py-2" required>
                    <option value="">Select Customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} - {customer.phone}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Plan Name</Label>
                  <select name="plan_name" className="w-full rounded-lg border border-input bg-background px-3 py-2" required>
                    <option value="5 Wash Pass">5 Wash Pass</option>
                    <option value="10 Wash Pass">10 Wash Pass</option>
                    <option value="20 Wash Pass">20 Wash Pass</option>
                    <option value="Monthly Unlimited">Monthly Unlimited</option>
                    <option value="Weekly Wash">Weekly Wash</option>
                  </select>
                </div>
                <div>
                  <Label>Total Washes</Label>
                  <Input name="total_washes" type="number" defaultValue="10" required />
                </div>
                <div>
                  <Label>Amount (₹)</Label>
                  <Input name="amount" type="number" step="0.01" defaultValue="2000" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Input name="start_date" type="date" required />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input name="end_date" type="date" required />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name="auto_renew" id="auto_renew" className="rounded" />
                  <Label htmlFor="auto_renew" className="cursor-pointer">Auto-renew subscription</Label>
                </div>
                <Button type="submit" className="w-full">Create Subscription</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subscriptions.filter(s => s.is_active).length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{subscriptions.reduce((sum, s) => sum + (s.amount || 0), 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Washes Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {subscriptions.reduce((sum, s) => sum + (s.used_washes || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSubscriptions.map((sub) => {
            const usagePercent = Math.round(((sub.used_washes || 0) / sub.total_washes) * 100);
            const isExpiringSoon = new Date(sub.end_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            
            return (
              <Card key={sub.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{sub.plan_name}</CardTitle>
                    </div>
                    <Badge variant={sub.is_active ? "default" : "secondary"}>
                      {sub.is_active ? "Active" : "Expired"}
                    </Badge>
                  </div>
                  <CardDescription>{sub.customers?.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Washes Used</span>
                      <span className="font-medium">
                        {sub.used_washes || 0} / {sub.total_washes}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="font-medium">₹{sub.amount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valid Until</span>
                    <span className={isExpiringSoon ? "text-orange-600 font-medium" : ""}>
                      {new Date(sub.end_date).toLocaleDateString()}
                    </span>
                  </div>
                  {sub.auto_renew && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      <span>Auto-renew enabled</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}