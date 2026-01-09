import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CarWashLoader } from "@/components/CarWashLoader";
import { 
  Gift, Trophy, Star, TrendingUp, Plus, Search, Award, 
  ArrowUpRight, ArrowDownRight, Coins, Crown, Sparkles 
} from "lucide-react";

interface LoyaltyPoint {
  id: string;
  customer_id: string;
  points: number;
  lifetime_points: number;
  tier: string;
  customers?: { name: string; phone: string; email: string };
}

interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  points: number;
  transaction_type: string;
  description: string;
  created_at: string;
  customers?: { name: string };
}

const tierConfig = {
  bronze: { color: "bg-amber-700", icon: Award, minPoints: 0, multiplier: 1 },
  silver: { color: "bg-gray-400", icon: Star, minPoints: 500, multiplier: 1.25 },
  gold: { color: "bg-yellow-500", icon: Trophy, minPoints: 1500, multiplier: 1.5 },
  platinum: { color: "bg-purple-500", icon: Crown, minPoints: 5000, multiplier: 2 },
};

export default function LoyaltyProgram() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loyaltyPoints, setLoyaltyPoints] = useState<LoyaltyPoint[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: "",
    points: "",
    transaction_type: "earned",
    description: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const [pointsRes, transRes, customersRes] = await Promise.all([
        supabase.from("loyalty_points").select("*").eq("user_id", session.session.user.id),
        supabase.from("loyalty_transactions").select("*").eq("user_id", session.session.user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("customers").select("id, name, phone, email").eq("user_id", session.session.user.id),
      ]);

      // Merge customer data into loyalty points
      const pointsWithCustomers = (pointsRes.data || []).map(lp => ({
        ...lp,
        customers: customersRes.data?.find(c => c.id === lp.customer_id)
      }));
      const transWithCustomers = (transRes.data || []).map(t => ({
        ...t,
        customers: customersRes.data?.find(c => c.id === t.customer_id)
      }));

      setLoyaltyPoints(pointsWithCustomers as any);
      setTransactions(transWithCustomers as any);
      setCustomers(customersRes.data || []);
    } catch (error) {
      console.error("Error fetching loyalty data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTier = (lifetimePoints: number): string => {
    if (lifetimePoints >= 5000) return "platinum";
    if (lifetimePoints >= 1500) return "gold";
    if (lifetimePoints >= 500) return "silver";
    return "bronze";
  };

  const handleAddTransaction = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const points = parseInt(formData.points);
    if (isNaN(points) || points <= 0) {
      toast({ title: "Invalid points", variant: "destructive" });
      return;
    }

    try {
      // Find or create loyalty record
      let loyaltyRecord = loyaltyPoints.find(lp => lp.customer_id === formData.customer_id);
      
      if (!loyaltyRecord) {
        const { data: newRecord, error: createError } = await supabase
          .from("loyalty_points")
          .insert({
            customer_id: formData.customer_id,
            user_id: session.session.user.id,
            points: 0,
            lifetime_points: 0,
            tier: "bronze"
          })
          .select()
          .single();
        
        if (createError) throw createError;
        loyaltyRecord = newRecord;
      }

      // Calculate new points
      const isDeduction = formData.transaction_type === "redeemed";
      const newPoints = isDeduction 
        ? Math.max(0, (loyaltyRecord?.points || 0) - points)
        : (loyaltyRecord?.points || 0) + points;
      const newLifetime = isDeduction 
        ? loyaltyRecord?.lifetime_points || 0
        : (loyaltyRecord?.lifetime_points || 0) + points;
      const newTier = calculateTier(newLifetime);

      // Update loyalty record
      await supabase
        .from("loyalty_points")
        .update({ points: newPoints, lifetime_points: newLifetime, tier: newTier })
        .eq("customer_id", formData.customer_id);

      // Create transaction
      await supabase.from("loyalty_transactions").insert({
        customer_id: formData.customer_id,
        user_id: session.session.user.id,
        points: isDeduction ? -points : points,
        transaction_type: formData.transaction_type,
        description: formData.description
      });

      toast({ title: `${points} points ${formData.transaction_type}!` });
      setDialogOpen(false);
      setFormData({ customer_id: "", points: "", transaction_type: "earned", description: "" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const totalPoints = loyaltyPoints.reduce((sum, lp) => sum + lp.points, 0);
  const totalMembers = loyaltyPoints.length;
  const filteredPoints = loyaltyPoints.filter(lp => 
    lp.customers?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lp.customers?.phone.includes(searchQuery)
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <CarWashLoader text="Loading loyalty program..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 bg-gradient-to-br from-background via-secondary/20 to-background min-h-screen">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Gift className="h-8 w-8 text-primary" />
              Loyalty Program
            </h1>
            <p className="text-muted-foreground mt-1">Reward your customers with points</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-md hover:shadow-lg transition-all">
                <Plus className="mr-2 h-4 w-4" />
                Add Points
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add/Redeem Points</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Customer</Label>
                  <Select value={formData.customer_id} onValueChange={(v) => setFormData({ ...formData, customer_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} - {c.phone}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Transaction Type</Label>
                  <Select value={formData.transaction_type} onValueChange={(v) => setFormData({ ...formData, transaction_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="earned">Earned (Add)</SelectItem>
                      <SelectItem value="redeemed">Redeemed (Deduct)</SelectItem>
                      <SelectItem value="bonus">Bonus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Points</Label>
                  <Input
                    type="number"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Premium wash service"
                  />
                </div>
                <Button onClick={handleAddTransaction} className="w-full">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {formData.transaction_type === "redeemed" ? "Redeem Points" : "Add Points"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-md border-border/50">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-primary/10 to-transparent">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Total Points Active
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary">{totalPoints.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="shadow-md border-border/50">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-color-purple/10 to-transparent">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Total Members
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-color-purple">{totalMembers}</div>
            </CardContent>
          </Card>
          <Card className="shadow-md border-border/50">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-color-green/10 to-transparent">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Crown className="h-4 w-4" />
                Platinum Members
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-color-green">{loyaltyPoints.filter(lp => lp.tier === "platinum").length}</div>
            </CardContent>
          </Card>
          <Card className="shadow-md border-border/50">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-color-orange/10 to-transparent">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Points This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-color-orange">
                {transactions.filter(t => t.transaction_type === "earned" && new Date(t.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).reduce((sum, t) => sum + t.points, 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Members List */}
          <Card className="lg:col-span-2 shadow-md border-border/50">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle>Loyalty Members</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {filteredPoints.map((lp) => {
                  const tierInfo = tierConfig[lp.tier as keyof typeof tierConfig];
                  const TierIcon = tierInfo?.icon || Award;
                  return (
                    <div key={lp.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${tierInfo?.color} text-white`}>
                          <TierIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold">{lp.customers?.name}</p>
                          <p className="text-sm text-muted-foreground">{lp.customers?.phone}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-primary">{lp.points.toLocaleString()}</p>
                        <Badge variant="outline" className="capitalize">{lp.tier}</Badge>
                      </div>
                    </div>
                  );
                })}
                {filteredPoints.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No loyalty members yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="shadow-md border-border/50">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {transactions.slice(0, 15).map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {t.points > 0 ? (
                        <ArrowUpRight className="h-4 w-4 text-color-green" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-color-red" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{t.customers?.name}</p>
                        <p className="text-xs text-muted-foreground">{t.description || t.transaction_type}</p>
                      </div>
                    </div>
                    <div className={`font-bold ${t.points > 0 ? "text-color-green" : "text-color-red"}`}>
                      {t.points > 0 ? "+" : ""}{t.points}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
