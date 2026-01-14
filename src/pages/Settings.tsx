import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Building2, Phone, Mail, MapPin, FileText, Palette, Globe, Link2, Copy, ExternalLink } from "lucide-react";
import { CarWashLoader } from "@/components/CarWashLoader";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    gst_number: "",
  });
  const [themeColor, setThemeColor] = useState("#facc15");

  // Landing page config state
  const [landingConfig, setLandingConfig] = useState({
    slug: "",
    business_name: "",
    tagline: "",
    description: "",
    logo_url: "",
    hero_image_url: "",
    primary_color: "#facc15",
    phone: "",
    email: "",
    address: "",
    whatsapp: "",
    facebook_url: "",
    instagram_url: "",
    google_maps_url: "",
    enable_online_booking: true,
    is_active: true,
    booking_mode: "slot",
    daily_booking_limit: 20,
    features: [] as string[],
    testimonials: [] as any[],
    working_hours: {} as Record<string, string>
  });
  const [newFeature, setNewFeature] = useState("");
  const [newTestimonial, setNewTestimonial] = useState({ name: "", text: "", rating: 5 });

  useEffect(() => {
    fetchBranches();
    const savedColor = localStorage.getItem("theme-color");
    if (savedColor) {
      setThemeColor(savedColor);
      applyThemeColor(savedColor);
    }
  }, []);
  
  const { data: existingLandingConfig, isLoading: landingLoading } = useQuery({
    queryKey: ["landingConfig"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;

      const { data, error } = await supabase
        .from("landing_page_config")
        .select("*")
        .eq("user_id", session.session.user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (existingLandingConfig) {
      setLandingConfig({
        slug: existingLandingConfig.slug || "",
        business_name: existingLandingConfig.business_name || "",
        tagline: existingLandingConfig.tagline || "",
        description: existingLandingConfig.description || "",
        logo_url: existingLandingConfig.logo_url || "",
        hero_image_url: existingLandingConfig.hero_image_url || "",
        primary_color: existingLandingConfig.primary_color || "#facc15",
        phone: existingLandingConfig.phone || "",
        email: existingLandingConfig.email || "",
        address: existingLandingConfig.address || "",
        whatsapp: existingLandingConfig.whatsapp || "",
        facebook_url: existingLandingConfig.facebook_url || "",
        instagram_url: existingLandingConfig.instagram_url || "",
        google_maps_url: existingLandingConfig.google_maps_url || "",
        enable_online_booking: existingLandingConfig.enable_online_booking ?? true,
        is_active: existingLandingConfig.is_active ?? true,
        booking_mode: (existingLandingConfig as any).booking_mode || "slot",
        daily_booking_limit: (existingLandingConfig as any).daily_booking_limit || 20,
        features: Array.isArray(existingLandingConfig.features) 
          ? existingLandingConfig.features.map((f: any) => typeof f === 'string' ? f : String(f)) 
          : [],
        testimonials: Array.isArray(existingLandingConfig.testimonials) ? existingLandingConfig.testimonials : [],
        working_hours: (typeof existingLandingConfig.working_hours === 'object' && existingLandingConfig.working_hours !== null && !Array.isArray(existingLandingConfig.working_hours)) 
          ? existingLandingConfig.working_hours as Record<string, string>
          : {}
      });
    }
  }, [existingLandingConfig]);
  
  const applyThemeColor = (color: string) => {
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

    let branchId = branches.length > 0 ? branches[0].id : null;
    
    if (!branchId) {
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

  const saveLandingConfig = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const configData = {
        user_id: session.session.user.id,
        slug: landingConfig.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        business_name: landingConfig.business_name,
        tagline: landingConfig.tagline || null,
        description: landingConfig.description || null,
        logo_url: landingConfig.logo_url || null,
        hero_image_url: landingConfig.hero_image_url || null,
        primary_color: landingConfig.primary_color || "#facc15",
        phone: landingConfig.phone || null,
        email: landingConfig.email || null,
        address: landingConfig.address || null,
        whatsapp: landingConfig.whatsapp || null,
        facebook_url: landingConfig.facebook_url || null,
        instagram_url: landingConfig.instagram_url || null,
        google_maps_url: landingConfig.google_maps_url || null,
        enable_online_booking: landingConfig.enable_online_booking,
        is_active: landingConfig.is_active,
        booking_mode: landingConfig.booking_mode,
        daily_booking_limit: landingConfig.daily_booking_limit,
        features: landingConfig.features,
        testimonials: landingConfig.testimonials,
        working_hours: landingConfig.working_hours
      };

      if (existingLandingConfig) {
        const { error } = await supabase
          .from("landing_page_config")
          .update(configData)
          .eq("id", existingLandingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("landing_page_config")
          .insert(configData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landingConfig"] });
      toast({ title: "Landing page configuration saved!" });
    },
    onError: (error: any) => {
      toast({ title: "Error saving configuration", description: error.message, variant: "destructive" });
    }
  });

  const publicPageUrl = landingConfig.slug ? `${window.location.origin}/wash/${landingConfig.slug}` : "";

  const addFeature = () => {
    if (newFeature.trim()) {
      setLandingConfig({
        ...landingConfig,
        features: [...landingConfig.features, newFeature.trim()]
      });
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    setLandingConfig({
      ...landingConfig,
      features: landingConfig.features.filter((_, i) => i !== index)
    });
  };

  const addTestimonial = () => {
    if (newTestimonial.name && newTestimonial.text) {
      setLandingConfig({
        ...landingConfig,
        testimonials: [...landingConfig.testimonials, { ...newTestimonial }]
      });
      setNewTestimonial({ name: "", text: "", rating: 5 });
    }
  };

  const removeTestimonial = (index: number) => {
    setLandingConfig({
      ...landingConfig,
      testimonials: landingConfig.testimonials.filter((_, i) => i !== index)
    });
  };

  if (landingLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <CarWashLoader text="Loading settings..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Settings</h1>
          <p className="text-muted-foreground">Manage company information and public landing page</p>
        </div>

        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="company">Company Info</TabsTrigger>
            <TabsTrigger value="landing">Public Landing Page</TabsTrigger>
            <TabsTrigger value="portal">Customer Portal</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-6">
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
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { color: "#facc15", name: "Yellow" },
                          { color: "#3b82f6", name: "Blue" },
                          { color: "#8b5cf6", name: "Purple" },
                          { color: "#10b981", name: "Green" },
                          { color: "#ef4444", name: "Red" },
                          { color: "#f97316", name: "Orange" },
                        ].map(({ color, name }) => (
                          <Button
                            key={color}
                            size="sm"
                            variant="outline"
                            onClick={() => handleThemeColorChange(color)}
                            className="gap-2"
                          >
                            <div className="w-4 h-4 rounded-full" style={{ background: color }} />
                            {name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="landing" className="space-y-6">
            {/* Public Page Link - Always Visible */}
            <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/10 to-transparent">
              <CardContent className="p-5">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="p-3 rounded-full bg-primary/20">
                    <Globe className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-semibold text-lg">Your Public Landing Page</p>
                    {landingConfig.slug ? (
                      <p className="text-sm text-muted-foreground font-mono break-all">{publicPageUrl}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Configure a slug below to generate your public page URL</p>
                    )}
                  </div>
                  {landingConfig.slug && (
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          navigator.clipboard.writeText(publicPageUrl);
                          toast({ title: "Link copied to clipboard!" });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        Copy Link
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => window.open(publicPageUrl, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Preview Page
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Basic Information
                </CardTitle>
                <CardDescription>
                  Configure your public-facing landing page for customers.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      Page URL Slug *
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">/wash/</span>
                      <Input
                        value={landingConfig.slug}
                        onChange={(e) => setLandingConfig({ ...landingConfig, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                        placeholder="my-car-wash"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Only lowercase letters, numbers, and hyphens</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Business Name *</Label>
                    <Input
                      value={landingConfig.business_name}
                      onChange={(e) => setLandingConfig({ ...landingConfig, business_name: e.target.value })}
                      placeholder="AutoWash Pro"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Tagline</Label>
                    <Input
                      value={landingConfig.tagline}
                      onChange={(e) => setLandingConfig({ ...landingConfig, tagline: e.target.value })}
                      placeholder="Premium Car Care, Exceptional Results"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      value={landingConfig.description}
                      onChange={(e) => setLandingConfig({ ...landingConfig, description: e.target.value })}
                      placeholder="Describe your car wash business..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={landingConfig.primary_color}
                        onChange={(e) => setLandingConfig({ ...landingConfig, primary_color: e.target.value })}
                        className="w-20 h-10"
                      />
                      <Input
                        value={landingConfig.primary_color}
                        onChange={(e) => setLandingConfig({ ...landingConfig, primary_color: e.target.value })}
                        placeholder="#facc15"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Logo URL</Label>
                    <Input
                      value={landingConfig.logo_url}
                      onChange={(e) => setLandingConfig({ ...landingConfig, logo_url: e.target.value })}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={landingConfig.phone}
                      onChange={(e) => setLandingConfig({ ...landingConfig, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    <Input
                      value={landingConfig.whatsapp}
                      onChange={(e) => setLandingConfig({ ...landingConfig, whatsapp: e.target.value })}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={landingConfig.email}
                      onChange={(e) => setLandingConfig({ ...landingConfig, email: e.target.value })}
                      placeholder="info@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={landingConfig.address}
                      onChange={(e) => setLandingConfig({ ...landingConfig, address: e.target.value })}
                      placeholder="123 Main Street, City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Facebook URL</Label>
                    <Input
                      value={landingConfig.facebook_url}
                      onChange={(e) => setLandingConfig({ ...landingConfig, facebook_url: e.target.value })}
                      placeholder="https://facebook.com/yourpage"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram URL</Label>
                    <Input
                      value={landingConfig.instagram_url}
                      onChange={(e) => setLandingConfig({ ...landingConfig, instagram_url: e.target.value })}
                      placeholder="https://instagram.com/yourpage"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Booking Settings</CardTitle>
                <CardDescription>Configure how customers can book appointments</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Online Booking</Label>
                    <p className="text-sm text-muted-foreground">Allow customers to book from landing page</p>
                  </div>
                  <Switch
                    checked={landingConfig.enable_online_booking}
                    onCheckedChange={(checked) => setLandingConfig({ ...landingConfig, enable_online_booking: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Page Active</Label>
                    <p className="text-sm text-muted-foreground">Make landing page publicly visible</p>
                  </div>
                  <Switch
                    checked={landingConfig.is_active}
                    onCheckedChange={(checked) => setLandingConfig({ ...landingConfig, is_active: checked })}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Booking Mode</Label>
                    <Select
                      value={landingConfig.booking_mode}
                      onValueChange={(value) => setLandingConfig({ ...landingConfig, booking_mode: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slot">Time Slot Selection</SelectItem>
                        <SelectItem value="date_only">Date Only (No Time Slots)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {landingConfig.booking_mode === "slot" 
                        ? "Customers can select specific time slots" 
                        : "Customers only select a date"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Daily Booking Limit</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={landingConfig.daily_booking_limit}
                      onChange={(e) => setLandingConfig({ ...landingConfig, daily_booking_limit: parseInt(e.target.value) || 20 })}
                    />
                    <p className="text-xs text-muted-foreground">Maximum bookings per day</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Features (Why Choose Us)</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    placeholder="Add a feature (e.g., 'Free Pickup & Delivery')"
                    onKeyDown={(e) => e.key === 'Enter' && addFeature()}
                  />
                  <Button onClick={addFeature}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {landingConfig.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-1 bg-secondary px-3 py-1.5 rounded-full">
                      <span className="text-sm">{feature}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-5 w-5 p-0"
                        onClick={() => removeFeature(index)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle>Testimonials</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Input
                    value={newTestimonial.name}
                    onChange={(e) => setNewTestimonial({ ...newTestimonial, name: e.target.value })}
                    placeholder="Customer Name"
                  />
                  <Input
                    value={newTestimonial.text}
                    onChange={(e) => setNewTestimonial({ ...newTestimonial, text: e.target.value })}
                    placeholder="Testimonial text"
                  />
                  <div className="flex gap-2">
                    <Select
                      value={String(newTestimonial.rating)}
                      onValueChange={(value) => setNewTestimonial({ ...newTestimonial, rating: parseInt(value) })}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 4, 3, 2, 1].map((r) => (
                          <SelectItem key={r} value={String(r)}>{r} ★</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={addTestimonial}>Add</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {landingConfig.testimonials.map((t, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div>
                        <span className="font-medium">{t.name}</span>
                        <span className="mx-2 text-muted-foreground">-</span>
                        <span className="text-sm text-muted-foreground">"{t.text}"</span>
                        <span className="ml-2 text-yellow-500">{"★".repeat(t.rating)}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeTestimonial(index)}>×</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button 
                onClick={() => saveLandingConfig.mutate()}
                disabled={!landingConfig.slug || !landingConfig.business_name || saveLandingConfig.isPending}
                size="lg"
              >
                {saveLandingConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Landing Page Configuration
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="portal">
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
          </TabsContent>
        </Tabs>
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
    onError: (error: any) => {
      toast({ title: "Error generating link", description: error.message, variant: "destructive" });
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
