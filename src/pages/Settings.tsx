import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Building2, Phone, Mail, MapPin, FileText, Palette } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    gst_number: "",
  });
  const [themeColor, setThemeColor] = useState("#facc15"); // default yellow

  useEffect(() => {
    fetchBranches();
    // Load saved theme color
    const savedColor = localStorage.getItem("theme-color");
    if (savedColor) {
      setThemeColor(savedColor);
      applyThemeColor(savedColor);
    }
  }, []);
  
  const applyThemeColor = (color: string) => {
    // Convert hex to HSL
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    
    // Apply to CSS variables
    document.documentElement.style.setProperty('--primary', `${h} ${s}% ${l}%`);
    document.documentElement.style.setProperty('--primary-glow', `${h} ${Math.min(s + 10, 100)}% ${Math.min(l + 10, 100)}%`);
  };
  
  const handleThemeColorChange = (color: string) => {
    setThemeColor(color);
    applyThemeColor(color);
    localStorage.setItem("theme-color", color);
    toast({ title: "Theme color updated" });
  };

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
      const first = data[0];
      setCompanyForm({
        name: first.name || "",
        email: first.email || "",
        phone: first.phone || "",
        address: first.address || "",
        gst_number: first.gst_number || "",
      });
    }
  };

  const handleSaveCompanyInfo = async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    // Get or create the first branch
    let branchId = branches.length > 0 ? branches[0].id : null;
    
    if (!branchId) {
      // Create a new branch if none exists
      const { data: newBranch, error: createError } = await supabase
        .from("branches")
        .insert({
          user_id: session.session.user.id,
          name: companyForm.name,
          email: companyForm.email,
          phone: companyForm.phone,
          address: companyForm.address,
          gst_number: companyForm.gst_number,
        })
        .select()
        .single();

      if (createError) {
        setLoading(false);
        toast({ title: "Error creating company info", variant: "destructive" });
        return;
      }
      branchId = newBranch.id;
    } else {
      // Update existing branch
      const { error } = await supabase
        .from("branches")
        .update({
          name: companyForm.name,
          email: companyForm.email,
          phone: companyForm.phone,
          address: companyForm.address,
          gst_number: companyForm.gst_number,
        })
        .eq("id", branchId);

      if (error) {
        setLoading(false);
        toast({ title: "Error saving company info", variant: "destructive" });
        return;
      }
    }

    setLoading(false);
    toast({ title: "Company information updated successfully" });
    fetchBranches();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Settings</h1>
          <p className="text-muted-foreground">Manage company information and system settings</p>
        </div>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Information
            </CardTitle>
            <CardDescription>
              Update your business details for invoices and receipts.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-name" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Company Name *
                </Label>
                <Input
                  id="company-name"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  placeholder="AutoWash Pro Pvt. Ltd."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gst" className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  GST Number
                </Label>
                <Input
                  id="gst"
                  value={companyForm.gst_number}
                  onChange={(e) => setCompanyForm({ ...companyForm, gst_number: e.target.value })}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={companyForm.email}
                  onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                  placeholder="info@autowashpro.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Phone
                </Label>
                <Input
                  id="phone"
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Address
                </Label>
                <Textarea
                  id="address"
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  placeholder="123 Main Street, City, State - 400001"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                onClick={handleSaveCompanyInfo} 
                disabled={!companyForm.name || loading}
                className="min-w-32"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Theme Customization
            </CardTitle>
            <CardDescription>
              Customize the primary color for your entire application.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme-color">Primary Color</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="theme-color"
                  type="color"
                  value={themeColor}
                  onChange={(e) => handleThemeColorChange(e.target.value)}
                  className="w-20 h-12 cursor-pointer"
                />
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Selected color: <span className="font-mono font-semibold">{themeColor}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleThemeColorChange("#facc15")}
                      className="gap-2"
                    >
                      <div className="w-4 h-4 rounded-full bg-[#facc15]" />
                      Yellow (Default)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleThemeColorChange("#3b82f6")}
                      className="gap-2"
                    >
                      <div className="w-4 h-4 rounded-full bg-[#3b82f6]" />
                      Blue
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleThemeColorChange("#8b5cf6")}
                      className="gap-2"
                    >
                      <div className="w-4 h-4 rounded-full bg-[#8b5cf6]" />
                      Purple
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleThemeColorChange("#10b981")}
                      className="gap-2"
                    >
                      <div className="w-4 h-4 rounded-full bg-[#10b981]" />
                      Green
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Customer Portal Links
            </CardTitle>
            <CardDescription>
              Generate secure portal links for your customers to track their services.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <CustomerPortalManager />
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}

function CustomerPortalManager() {
  const { toast } = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [generatedLink, setGeneratedLink] = useState<string>("");

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, email")
        .order("name");
      if (error) throw error;
      return data;
    }
  });

  const generateLink = useMutation({
    mutationFn: async (customerId: string) => {
      const { data, error } = await supabase.rpc("generate_customer_portal_link", {
        p_customer_id: customerId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (link) => {
      const fullLink = `${window.location.origin}${link}`;
      setGeneratedLink(fullLink);
      navigator.clipboard.writeText(fullLink);
      toast({ title: "Portal link generated and copied to clipboard!" });
    },
    onError: () => {
      toast({ title: "Error generating link", variant: "destructive" });
    }
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Select Customer</Label>
          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a customer" />
            </SelectTrigger>
            <SelectContent>
              {customers?.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name} - {customer.phone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            onClick={() => generateLink.mutate(selectedCustomerId)}
            disabled={!selectedCustomerId || generateLink.isPending}
            className="w-full"
          >
            {generateLink.isPending ? "Generating..." : "Generate Portal Link"}
          </Button>
        </div>
      </div>

      {generatedLink && (
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <Label>Generated Portal Link</Label>
          <div className="flex gap-2">
            <Input value={generatedLink} readOnly className="font-mono text-sm" />
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(generatedLink);
                toast({ title: "Link copied!" });
              }}
            >
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Share this link with your customer to give them access to their portal.
          </p>
        </div>
      )}
    </div>
  );
}
