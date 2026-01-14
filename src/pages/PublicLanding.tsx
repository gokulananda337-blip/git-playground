import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { CarWashLoader } from "@/components/CarWashLoader";
import { cn } from "@/lib/utils";
import { format, startOfDay, isBefore } from "date-fns";
import { 
  Phone, Mail, MapPin, Clock, Star, Sparkles, Calendar as CalendarIcon, 
  ChevronRight, Car, Droplets, CheckCircle2, MessageCircle, Facebook, Instagram,
  Users, Award, Shield, Zap
} from "lucide-react";

interface LandingConfig {
  id: string;
  user_id: string;
  slug: string;
  business_name: string;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  primary_color: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  whatsapp: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  google_maps_url: string | null;
  working_hours: any;
  features: any[];
  testimonials: any[];
  enable_online_booking: boolean;
  booking_mode?: string;
  daily_booking_limit?: number;
}

export default function PublicLanding() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<LandingConfig | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingDate, setBookingDate] = useState<Date>();
  const [bookingTime, setBookingTime] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ customers: 0, vehicles: 0, reviews: 0, avgRating: 0 });
  const [todayBookingsCount, setTodayBookingsCount] = useState(0);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    email: "",
    vehicle_number: "",
    vehicle_type: "sedan",
    brand: "",
    model: "",
    color: "",
    notes: ""
  });

  useEffect(() => {
    fetchLandingPage();
  }, [slug]);

  const fetchLandingPage = async () => {
    try {
      const { data: configData, error } = await supabase
        .from("landing_page_config")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (error || !configData) {
        navigate("/");
        return;
      }

      setConfig(configData as LandingConfig);

      // Fetch services for this user
      const { data: servicesData } = await supabase
        .from("services")
        .select("*")
        .eq("user_id", configData.user_id)
        .eq("is_active", true)
        .order("base_price", { ascending: true });

      setServices(servicesData || []);

      // Fetch stats
      const [customersRes, vehiclesRes, reviewsRes] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact" }).eq("user_id", configData.user_id),
        supabase.from("vehicles").select("id", { count: "exact" }).eq("user_id", configData.user_id),
        supabase.from("reviews").select("rating").eq("user_id", configData.user_id)
      ]);

      const avgRating = reviewsRes.data?.length 
        ? (reviewsRes.data.reduce((sum, r) => sum + r.rating, 0) / reviewsRes.data.length)
        : 0;

      setStats({
        customers: customersRes.count || 0,
        vehicles: vehiclesRes.count || 0,
        reviews: reviewsRes.data?.length || 0,
        avgRating: Number(avgRating.toFixed(1))
      });
    } catch (error) {
      console.error("Error fetching landing page:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const checkDailyLimit = async (date: Date) => {
    if (!config) return false;
    
    const dateStr = format(date, "yyyy-MM-dd");
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact" })
      .eq("user_id", config.user_id)
      .eq("booking_date", dateStr);

    const limit = (config as any).daily_booking_limit || 20;
    setTodayBookingsCount(count || 0);
    return (count || 0) < limit;
  };

  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
  ];

  const getAvailableTimeSlots = () => {
    if (!bookingDate) return timeSlots;
    
    const today = startOfDay(new Date());
    const selectedDay = startOfDay(bookingDate);
    
    // If selected date is today, filter past time slots
    if (selectedDay.getTime() === today.getTime()) {
      const now = new Date();
      return timeSlots.filter(slot => {
        const [hours, minutes] = slot.split(":").map(Number);
        const slotTime = new Date();
        slotTime.setHours(hours, minutes, 0, 0);
        return slotTime > now;
      });
    }
    
    return timeSlots;
  };

  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return;
    
    const canBook = await checkDailyLimit(date);
    if (!canBook) {
      toast({ 
        title: "Booking limit reached", 
        description: "Sorry, this date is fully booked. Please select another date.",
        variant: "destructive" 
      });
      return;
    }
    
    setBookingDate(date);
    setBookingTime("");
  };

  const handleBooking = async () => {
    if (!config || submitting) return;
    setSubmitting(true);

    try {
      // Create or find customer
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", customerForm.phone)
        .eq("user_id", config.user_id)
        .maybeSingle();

      let customerId = existingCustomer?.id;

      if (!customerId) {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            name: customerForm.name,
            phone: customerForm.phone,
            email: customerForm.email || null,
            user_id: config.user_id
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // Create vehicle
      const { data: vehicle, error: vehicleError } = await supabase
        .from("vehicles")
        .insert({
          customer_id: customerId,
          user_id: config.user_id,
          vehicle_number: customerForm.vehicle_number.toUpperCase(),
          vehicle_type: customerForm.vehicle_type as any,
          brand: customerForm.brand || null,
          model: customerForm.model || null,
          color: customerForm.color || null
        })
        .select()
        .single();

      if (vehicleError) throw vehicleError;

      // Get selected service details
      const selectedServiceDetails = services.filter(s => selectedServices.includes(s.id)).map(s => ({
        id: s.id,
        name: s.name,
        price: s.base_price,
        lifecycle_stages: s.lifecycle_stages
      }));

      // Determine booking time
      const bookingTimeValue = config.booking_mode === "date_only" ? "09:00" : bookingTime;

      // Create booking
      const { error: bookingError } = await supabase
        .from("bookings")
        .insert({
          customer_id: customerId,
          vehicle_id: vehicle.id,
          user_id: config.user_id,
          booking_date: format(bookingDate!, "yyyy-MM-dd"),
          booking_time: bookingTimeValue,
          services: selectedServiceDetails,
          notes: customerForm.notes,
          status: "pending"
        });

      if (bookingError) throw bookingError;

      toast({ 
        title: "🎉 Booking Confirmed!", 
        description: "We'll contact you soon to confirm your appointment." 
      });
      
      setBookingOpen(false);
      setBookingStep(1);
      setBookingDate(undefined);
      setBookingTime("");
      setSelectedServices([]);
      setCustomerForm({ 
        name: "", phone: "", email: "", vehicle_number: "", 
        vehicle_type: "sedan", brand: "", model: "", color: "", notes: "" 
      });
    } catch (error: any) {
      toast({ title: "Booking Failed", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <CarWashLoader text="Loading..." />
      </div>
    );
  }

  if (!config) return null;

  const primaryColor = config.primary_color || "#facc15";
  const bookingMode = (config as any).booking_mode || "slot";
  const dailyLimit = (config as any).daily_booking_limit || 20;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div 
        className="relative min-h-[90vh] flex items-center justify-center text-center p-6"
        style={{ 
          background: `linear-gradient(135deg, ${primaryColor}30 0%, ${primaryColor}10 40%, transparent 100%)`
        }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Animated bubbles */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-pulse"
              style={{
                width: `${15 + Math.random() * 50}px`,
                height: `${15 + Math.random() * 50}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                background: `${primaryColor}15`,
                animationDelay: `${i * 0.15}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
        
        <div className="relative z-10 max-w-5xl mx-auto">
          {config.logo_url ? (
            <img src={config.logo_url} alt={config.business_name} className="h-20 mx-auto mb-6" />
          ) : (
            <div className="flex justify-center mb-8">
              <div className="p-5 rounded-full shadow-2xl" style={{ background: primaryColor }}>
                <Car className="h-16 w-16 text-white" />
              </div>
            </div>
          )}
          
          <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-tight">{config.business_name}</h1>
          
          {config.tagline && (
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">{config.tagline}</p>
          )}
          
          {config.description && (
            <p className="text-lg text-muted-foreground/80 mb-10 max-w-3xl mx-auto">{config.description}</p>
          )}
          
          {config.enable_online_booking && (
            <Button 
              size="lg" 
              className="text-xl px-10 py-7 shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105"
              style={{ background: primaryColor }}
              onClick={() => setBookingOpen(true)}
            >
              <Sparkles className="mr-3 h-6 w-6" />
              Book Your Wash Now
            </Button>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto">
            {[
              { value: `${stats.customers}+`, label: "Happy Customers", icon: Users },
              { value: `${stats.vehicles}+`, label: "Cars Washed", icon: Car },
              { value: stats.avgRating > 0 ? `${stats.avgRating}★` : "5.0★", label: "Avg Rating", icon: Star },
              { value: `${stats.reviews}+`, label: "Reviews", icon: Award },
            ].map((stat, i) => (
              <div 
                key={i} 
                className="p-4 rounded-xl bg-background/80 backdrop-blur-sm border shadow-lg"
              >
                <stat.icon className="h-6 w-6 mx-auto mb-2" style={{ color: primaryColor }} />
                <p className="text-2xl md:text-3xl font-bold" style={{ color: primaryColor }}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Services Section */}
      <div className="py-20 px-6 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 px-4 py-1" style={{ borderColor: primaryColor, color: primaryColor }}>
              Our Services
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Premium Car Care Services</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose from our range of professional car wash and detailing services
            </p>
          </div>
          
          {services.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service, index) => (
                <Card 
                  key={service.id} 
                  className="hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50 group relative overflow-hidden"
                >
                  {/* Service number badge */}
                  <div 
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: `${primaryColor}20`, color: primaryColor }}
                  >
                    {index + 1}
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div 
                        className="p-2 rounded-lg group-hover:scale-110 transition-transform" 
                        style={{ background: `${primaryColor}20` }}
                      >
                        <Droplets className="h-5 w-5" style={{ color: primaryColor }} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{service.name}</CardTitle>
                        {service.category && (
                          <Badge variant="secondary" className="mt-1 text-xs">{service.category}</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm mb-4 min-h-[40px]">
                      {service.description || "Professional car wash service with attention to detail"}
                    </p>
                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{service.duration_minutes} mins</span>
                      </div>
                      <Badge 
                        className="text-lg font-bold px-4 py-1" 
                        style={{ background: primaryColor, color: "#000" }}
                      >
                        ₹{service.base_price}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-muted/30 rounded-2xl">
              <Droplets className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-xl font-semibold text-muted-foreground">Services Coming Soon</h3>
              <p className="text-muted-foreground mt-2">We're setting up our service menu. Check back soon!</p>
            </div>
          )}
        </div>
      </div>

      {/* Features Section */}
      {config.features && config.features.length > 0 && (
        <div className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 px-4 py-1" style={{ borderColor: primaryColor, color: primaryColor }}>
                Why Us
              </Badge>
              <h2 className="text-4xl font-bold mb-4">Why Choose Us</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {config.features.map((feature: any, i: number) => (
                <div 
                  key={i} 
                  className="flex items-start gap-4 p-6 rounded-xl border bg-card hover:shadow-lg transition-all"
                >
                  <div 
                    className="p-2 rounded-lg flex-shrink-0" 
                    style={{ background: `${primaryColor}20` }}
                  >
                    <CheckCircle2 className="h-6 w-6" style={{ color: primaryColor }} />
                  </div>
                  <span className="text-lg">{typeof feature === 'string' ? feature : feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Testimonials */}
      {config.testimonials && config.testimonials.length > 0 && (
        <div className="py-20 px-6 bg-secondary/30">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4 px-4 py-1" style={{ borderColor: primaryColor, color: primaryColor }}>
                Testimonials
              </Badge>
              <h2 className="text-4xl font-bold mb-4">What Our Customers Say</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {config.testimonials.map((testimonial: any, i: number) => (
                <Card key={i} className="p-6 hover:shadow-lg transition-all">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating || 5)].map((_, j) => (
                      <Star key={j} className="h-5 w-5 fill-current" style={{ color: primaryColor }} />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4 text-lg italic">"{testimonial.text}"</p>
                  <p className="font-semibold flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: primaryColor }}>
                      {testimonial.name?.charAt(0)?.toUpperCase()}
                    </div>
                    {testimonial.name}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contact Section */}
      <div className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 px-4 py-1" style={{ borderColor: primaryColor, color: primaryColor }}>
              Contact
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Get In Touch</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              {config.phone && (
                <a href={`tel:${config.phone}`} className="flex items-center gap-4 p-5 rounded-xl border hover:shadow-lg hover:border-primary/50 transition-all">
                  <div className="p-3 rounded-lg" style={{ background: `${primaryColor}20` }}>
                    <Phone className="h-6 w-6" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Call us</p>
                    <p className="font-semibold text-lg">{config.phone}</p>
                  </div>
                </a>
              )}
              {config.whatsapp && (
                <a href={`https://wa.me/${config.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-5 rounded-xl border hover:shadow-lg hover:border-green-500/50 transition-all">
                  <div className="p-3 rounded-lg bg-green-500/20">
                    <MessageCircle className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">WhatsApp</p>
                    <p className="font-semibold text-lg">Chat with us</p>
                  </div>
                </a>
              )}
              {config.email && (
                <a href={`mailto:${config.email}`} className="flex items-center gap-4 p-5 rounded-xl border hover:shadow-lg hover:border-primary/50 transition-all">
                  <div className="p-3 rounded-lg" style={{ background: `${primaryColor}20` }}>
                    <Mail className="h-6 w-6" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-semibold">{config.email}</p>
                  </div>
                </a>
              )}
              {config.address && (
                <div className="flex items-start gap-4 p-5 rounded-xl border">
                  <div className="p-3 rounded-lg" style={{ background: `${primaryColor}20` }}>
                    <MapPin className="h-6 w-6" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-semibold">{config.address}</p>
                  </div>
                </div>
              )}
            </div>
            
            {config.working_hours && Object.keys(config.working_hours).length > 0 && (
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" style={{ color: primaryColor }} />
                    Working Hours
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(config.working_hours).map(([day, hours]) => (
                    <div key={day} className="flex justify-between text-sm border-b pb-2 last:border-0">
                      <span className="capitalize font-medium">{day}</span>
                      <span className="text-muted-foreground">{hours as string}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Social Links */}
          <div className="flex justify-center gap-4 mt-12">
            {config.facebook_url && (
              <a href={config.facebook_url} target="_blank" rel="noopener noreferrer" className="p-4 rounded-full border hover:bg-secondary hover:scale-110 transition-all">
                <Facebook className="h-6 w-6" />
              </a>
            )}
            {config.instagram_url && (
              <a href={config.instagram_url} target="_blank" rel="noopener noreferrer" className="p-4 rounded-full border hover:bg-secondary hover:scale-110 transition-all">
                <Instagram className="h-6 w-6" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      {config.enable_online_booking && (
        <div 
          className="py-16 px-6 text-center"
          style={{ background: `linear-gradient(135deg, ${primaryColor}40 0%, ${primaryColor}20 100%)` }}
        >
          <h2 className="text-3xl font-bold mb-4">Ready for a Sparkling Clean Car?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Book your appointment now and experience the best car wash service in town!
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8 py-6 shadow-xl"
            style={{ background: primaryColor, color: "#000" }}
            onClick={() => setBookingOpen(true)}
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Book Now
          </Button>
        </div>
      )}

      {/* Footer */}
      <div className="py-8 px-6 border-t text-center text-muted-foreground">
        <p>© {new Date().getFullYear()} {config.business_name}. All rights reserved.</p>
      </div>

      {/* Booking Dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" style={{ color: primaryColor }} />
              Book Appointment
            </DialogTitle>
          </DialogHeader>
          
          {bookingStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Select Services</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {services.map((service) => (
                  <label 
                    key={service.id} 
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                      selectedServices.includes(service.id) && "border-2"
                    )}
                    style={selectedServices.includes(service.id) ? { borderColor: primaryColor, background: `${primaryColor}10` } : {}}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(service.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedServices([...selectedServices, service.id]);
                          } else {
                            setSelectedServices(selectedServices.filter(id => id !== service.id));
                          }
                        }}
                        className="rounded"
                      />
                      <div>
                        <span className="font-medium">{service.name}</span>
                        <p className="text-xs text-muted-foreground">{service.duration_minutes} mins</p>
                      </div>
                    </div>
                    <Badge style={{ background: primaryColor, color: "#000" }}>₹{service.base_price}</Badge>
                  </label>
                ))}
              </div>
              <div className="flex justify-between items-center pt-4 border-t">
                <div>
                  <span className="text-sm text-muted-foreground">Total</span>
                  <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                    ₹{services.filter(s => selectedServices.includes(s.id)).reduce((sum, s) => sum + Number(s.base_price), 0)}
                  </p>
                </div>
                <Button 
                  onClick={() => setBookingStep(2)} 
                  disabled={selectedServices.length === 0}
                  style={{ background: primaryColor }}
                >
                  Next <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {bookingStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Select Date {bookingMode === "slot" && "& Time"}</h3>
              <div>
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {bookingDate ? format(bookingDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={bookingDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => {
                        const today = startOfDay(new Date());
                        return isBefore(date, today);
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {bookingDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {todayBookingsCount}/{dailyLimit} bookings for this date
                  </p>
                )}
              </div>
              
              {bookingMode === "slot" && (
                <div>
                  <Label>Time Slot</Label>
                  <Select value={bookingTime} onValueChange={setBookingTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableTimeSlots().length === 0 ? (
                        <SelectItem value="" disabled>No slots available</SelectItem>
                      ) : (
                        getAvailableTimeSlots().map((time) => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setBookingStep(1)}>Back</Button>
                <Button 
                  onClick={() => setBookingStep(3)} 
                  disabled={!bookingDate || (bookingMode === "slot" && !bookingTime)}
                  style={{ background: primaryColor }}
                >
                  Next <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {bookingStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Your Details</h3>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name *</Label>
                    <Input 
                      value={customerForm.name} 
                      onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label>Phone *</Label>
                    <Input 
                      value={customerForm.phone} 
                      onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={customerForm.email} 
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Vehicle Number *</Label>
                    <Input 
                      value={customerForm.vehicle_number} 
                      onChange={(e) => setCustomerForm({ ...customerForm, vehicle_number: e.target.value.toUpperCase() })}
                      placeholder="KA 01 AB 1234"
                    />
                  </div>
                  <div>
                    <Label>Vehicle Type</Label>
                    <Select value={customerForm.vehicle_type} onValueChange={(v) => setCustomerForm({ ...customerForm, vehicle_type: v })}>
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
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Brand</Label>
                    <Input 
                      value={customerForm.brand} 
                      onChange={(e) => setCustomerForm({ ...customerForm, brand: e.target.value })}
                      placeholder="Toyota"
                    />
                  </div>
                  <div>
                    <Label>Model</Label>
                    <Input 
                      value={customerForm.model} 
                      onChange={(e) => setCustomerForm({ ...customerForm, model: e.target.value })}
                      placeholder="Camry"
                    />
                  </div>
                  <div>
                    <Label>Color</Label>
                    <Input 
                      value={customerForm.color} 
                      onChange={(e) => setCustomerForm({ ...customerForm, color: e.target.value })}
                      placeholder="Silver"
                    />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea 
                    value={customerForm.notes} 
                    onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                    placeholder="Any special requests..."
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setBookingStep(2)}>Back</Button>
                <Button 
                  onClick={handleBooking} 
                  disabled={!customerForm.name || !customerForm.phone || !customerForm.vehicle_number || submitting}
                  style={{ background: primaryColor }}
                >
                  {submitting ? "Booking..." : "Confirm Booking"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
