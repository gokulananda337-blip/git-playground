import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, X } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [companyForm, setCompanyForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .eq("user_id", session.session.user.id);

    if (error) {
      toast({ title: "Error fetching branches", variant: "destructive" });
      return;
    }

    setBranches(data || []);
    if (data && data.length > 0) {
      setSelectedBranch(data[0].id);
      const first = data[0];
      setCompanyForm({
        name: first.name || "",
        email: first.email || "",
        phone: first.phone || "",
        address: first.address || "",
      });
    }
  };

  const handleConnectWhatsApp = () => {
    // Meta OAuth flow - redirect to Meta's permission screen
    const appId = import.meta.env.VITE_META_APP_ID || "YOUR_META_APP_ID";
    const redirectUri = encodeURIComponent(`${window.location.origin}/settings/whatsapp-callback`);
    const state = selectedBranch; // Pass branch ID as state
    
    const metaOAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&state=${state}&scope=whatsapp_business_management,whatsapp_business_messaging`;
    
    window.location.href = metaOAuthUrl;
  };

  const handleDisconnectWhatsApp = async () => {
    if (!selectedBranch) return;

    setLoading(true);
    const { error } = await supabase
      .from("branches")
      .update({
        whatsapp_phone_number_id: null,
        whatsapp_access_token: null,
        whatsapp_business_account_id: null,
        whatsapp_verified: false,
      })
      .eq("id", selectedBranch);

    setLoading(false);

    if (error) {
      toast({ title: "Error disconnecting WhatsApp", variant: "destructive" });
      return;
    }

    toast({ title: "WhatsApp disconnected successfully" });
    fetchBranches();
  };

  const handleSaveCompanyInfo = async () => {
    if (!selectedBranch) return;

    setLoading(true);
    const { error } = await supabase
      .from("branches")
      .update({
        name: companyForm.name,
        email: companyForm.email,
        phone: companyForm.phone,
        address: companyForm.address,
      })
      .eq("id", selectedBranch);

    setLoading(false);

    if (error) {
      toast({ title: "Error saving company info", variant: "destructive" });
      return;
    }

    toast({ title: "Company info updated" });
    fetchBranches();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your WhatsApp integration and system settings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Business API Integration</CardTitle>
            <CardDescription>
              Connect your WhatsApp Business Account to enable AI booking chatbot, automated reminders, and notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Branch</Label>
              <select
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  const branch = branches.find((b) => b.id === e.target.value);
                  if (branch) {
                    setCompanyForm({
                      name: branch.name || "",
                      email: branch.email || "",
                      phone: branch.phone || "",
                      address: branch.address || "",
                    });
                  }
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {isConnected && currentBranch && (
              <div className="rounded-lg bg-accent/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="font-medium">WhatsApp Connected</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Phone Number ID: {currentBranch.whatsapp_phone_number_id}</p>
                  <p>Business Account ID: {currentBranch.whatsapp_business_account_id}</p>
                </div>
              </div>
            )}

            {!isConnected && (
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <X className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Not Connected</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect your WhatsApp Business Account to start receiving bookings via WhatsApp
                </p>
              </div>
            )}

            <div className="flex gap-3">
              {!isConnected ? (
                <Button onClick={handleConnectWhatsApp} disabled={!selectedBranch || loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect WhatsApp
                </Button>
              ) : (
                <Button onClick={handleDisconnectWhatsApp} variant="destructive" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Disconnect WhatsApp
                </Button>
              )}
            </div>

            <div className="rounded-lg bg-muted/30 p-4 text-sm space-y-2">
              <p className="font-medium">How to connect:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Select your branch from the dropdown</li>
                <li>Click "Connect WhatsApp" button</li>
                <li>Log in with your Facebook Business Account</li>
                <li>Select your WhatsApp Business Account (WABA)</li>
                <li>Choose or register a phone number</li>
                <li>Verify with OTP and authorize the app</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
            <CardDescription>
              Use this webhook URL in your Meta App Dashboard to receive WhatsApp messages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`}
                readOnly
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Add this URL to your Meta App's Webhooks configuration and subscribe to "messages" events
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}