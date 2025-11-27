import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, Phone, Mail, MapPin, FileText } from "lucide-react";

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
    gst_number: "",
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
        gst_number: first.gst_number || "",
      });
    }
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
        gst_number: companyForm.gst_number,
      })
      .eq("id", selectedBranch);

    setLoading(false);

    if (error) {
      toast({ title: "Error saving company info", variant: "destructive" });
      return;
    }

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
              Update your business details. This information will be used in invoices and receipts.
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
            <CardTitle>Branch Selection</CardTitle>
            <CardDescription>
              Select which branch to manage settings for
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label>Active Branch</Label>
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
                      gst_number: branch.gst_number || "",
                    });
                  }
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
