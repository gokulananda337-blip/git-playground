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
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { 
  Phone, Mail, MapPin, Clock, Star, Sparkles, Calendar as CalendarIcon, 
  ChevronRight, Car, Droplets, CheckCircle2, MessageCircle, Facebook, Instagram
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
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    email: "",
    vehicle_number: "",
    vehicle_type: "sedan",
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
    } catch (error) {
      console.error("Error fetching landing page:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
  ];

  const getAvailableTimeSlots = () => {
    if (!bookingDate) return timeSlots;
    const today = startOfDay(new Date());
    if (bookingDate.getTime() === today.getTime()) {
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

  const handleBooking = async () => {
    if (!config) return;

    try {
      // Create or find customer
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", customerForm.phone)
        .eq("user_id", config.user_id)
        .single();

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
        .insert([{
          customer_id: customerId,
          user_id: config.user_id,
          vehicle_number: customerForm.vehicle_number,
          vehicle_type: customerForm.vehicle_type as any
        }])
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

      // Create booking
      const { error: bookingError } = await supabase
        .from("bookings")
        .insert({
          customer_id: customerId,
          vehicle_id: vehicle.id,
          user_id: config.user_id,
          booking_date: format(bookingDate!, "yyyy-MM-dd"),
          booking_time: bookingTime,
          services: selectedServiceDetails,
          notes: customerForm.notes,
          status: "pending"
        });

      if (bookingError) throw bookingError;

      toast({ title: "Booking Confirmed!", description: "We'll contact you soon to confirm your appointment." });
      setBookingOpen(false);
      setBookingStep(1);
      setBookingDate(undefined);
      setBookingTime("");
      setSelectedServices([]);
      setCustomerForm({ name: "", phone: "", email: "", vehicle_number: "", vehicle_type: "sedan", notes: "" });
    } catch (error: any) {
      toast({ title: "Booking Failed", description: error.message, variant: "destructive" });
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

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div 
        className="relative min-h-[80vh] flex items-center justify-center text-center p-6"
        style={{ 
          background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}05 50%, transparent 100%)`
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          {/* Decorative bubbles */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-pulse"
              style={{
                width: `${20 + Math.random() * 40}px`,
                height: `${20 + Math.random() * 40}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                background: `${primaryColor}20`,
                animationDelay: `${i * 0.2}s`
              }}
            />
          ))}
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-full" style={{ background: primaryColor }}>
              <Car className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-4">{config.business_name}</h1>
          {config.tagline && (
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">{config.tagline}</p>
          )}
          {config.enable_online_booking && (
            <Button 
              size="lg" 
              className="text-lg px-8 py-6 shadow-xl hover:shadow-2xl transition-all"
              style={{ background: primaryColor }}
              onClick={() => setBookingOpen(true)}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Book Now
            </Button>
          )}
        </div>
      </div>

      {/* Services Section */}
      <div className="py-16 px-6 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Our Services</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Card key={service.id} className="hover:shadow-lg transition-all border-2 hover:border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Droplets className="h-5 w-5" style={{ color: primaryColor }} />
                      {service.name}
                    </span>
                    <Badge variant="secondary" style={{ background: `${primaryColor}20`, color: primaryColor }}>
                      ₹{service.base_price}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{service.description || "Professional car wash service"}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{service.duration_minutes} mins</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      {config.features && config.features.length > 0 && (
        <div className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Why Choose Us</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {config.features.map((feature: any, i: number) => (
                <div key={i} className="flex items-start gap-4 p-4">
                  <CheckCircle2 className="h-6 w-6 flex-shrink-0" style={{ color: primaryColor }} />
                  <span className="text-lg">{typeof feature === 'string' ? feature : feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Testimonials */}
      {config.testimonials && config.testimonials.length > 0 && (
        <div className="py-16 px-6 bg-secondary/30">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">What Our Customers Say</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {config.testimonials.map((testimonial: any, i: number) => (
                <Card key={i} className="p-6">
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(testimonial.rating || 5)].map((_, j) => (
                      <Star key={j} className="h-5 w-5 fill-current" style={{ color: primaryColor }} />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4">"{testimonial.text}"</p>
                  <p className="font-semibold">— {testimonial.name}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contact Section */}
      <div className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Get In Touch</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {config.phone && (
                <a href={`tel:${config.phone}`} className="flex items-center gap-4 p-4 rounded-lg border hover:bg-secondary/50 transition-all">
                  <Phone className="h-6 w-6" style={{ color: primaryColor }} />
                  <span>{config.phone}</span>
                </a>
              )}
              {config.whatsapp && (
                <a href={`https://wa.me/${config.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-lg border hover:bg-secondary/50 transition-all">
                  <MessageCircle className="h-6 w-6 text-green-500" />
                  <span>WhatsApp</span>
                </a>
              )}
              {config.email && (
                <a href={`mailto:${config.email}`} className="flex items-center gap-4 p-4 rounded-lg border hover:bg-secondary/50 transition-all">
                  <Mail className="h-6 w-6" style={{ color: primaryColor }} />
                  <span>{config.email}</span>
                </a>
              )}
              {config.address && (
                <div className="flex items-start gap-4 p-4 rounded-lg border">
                  <MapPin className="h-6 w-6 flex-shrink-0" style={{ color: primaryColor }} />
                  <span>{config.address}</span>
                </div>
              )}
            </div>
            
            {config.working_hours && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Working Hours
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(config.working_hours).map(([day, hours]) => (
                    <div key={day} className="flex justify-between text-sm">
                      <span className="capitalize">{day}</span>
                      <span className="text-muted-foreground">{hours as string}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Social Links */}
          <div className="flex justify-center gap-4 mt-8">
            {config.facebook_url && (
              <a href={config.facebook_url} target="_blank" rel="noopener noreferrer" className="p-3 rounded-full border hover:bg-secondary transition-all">
                <Facebook className="h-6 w-6" />
              </a>
            )}
            {config.instagram_url && (
              <a href={config.instagram_url} target="_blank" rel="noopener noreferrer" className="p-3 rounded-full border hover:bg-secondary transition-all">
                <Instagram className="h-6 w-6" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-8 px-6 border-t text-center text-muted-foreground">
        <p>© {new Date().getFullYear()} {config.business_name}. All rights reserved.</p>
      </div>

      {/* Booking Dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
          </DialogHeader>
          
          {bookingStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Select Services</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {services.map((service) => (
                  <label 
                    key={service.id} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                      selectedServices.includes(service.id) && "border-primary bg-primary/5"
                    )}
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
                      <span>{service.name}</span>
                    </div>
                    <Badge variant="secondary">₹{service.base_price}</Badge>
                  </label>
                ))}
              </div>
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="font-semibold">
                  Total: ₹{services.filter(s => selectedServices.includes(s.id)).reduce((sum, s) => sum + Number(s.base_price), 0)}
                </span>
                <Button onClick={() => setBookingStep(2)} disabled={selectedServices.length === 0}>
                  Next <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {bookingStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Select Date & Time</h3>
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
                      onSelect={setBookingDate}
                      disabled={(date) => isBefore(date, startOfDay(new Date()))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Time Slot</Label>
                <Select value={bookingTime} onValueChange={setBookingTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableTimeSlots().map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setBookingStep(1)}>Back</Button>
                <Button onClick={() => setBookingStep(3)} disabled={!bookingDate || !bookingTime}>
                  Next <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {bookingStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Your Details</h3>
              <div className="grid gap-4">
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
                <div>
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={customerForm.email} 
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label>Vehicle Number *</Label>
                  <Input 
                    value={customerForm.vehicle_number} 
                    onChange={(e) => setCustomerForm({ ...customerForm, vehicle_number: e.target.value })}
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
                      <SelectItem value="sedan">Sedan</SelectItem>
                      <SelectItem value="suv">SUV</SelectItem>
                      <SelectItem value="hatchback">Hatchback</SelectItem>
                      <SelectItem value="bike">Bike</SelectItem>
                    </SelectContent>
                  </Select>
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
                  disabled={!customerForm.name || !customerForm.phone || !customerForm.vehicle_number}
                >
                  Confirm Booking
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
