import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log("Received booking webhook:", payload);

    // Extract booking data from payload
    const {
      user_id,
      customer_name,
      customer_phone,
      customer_email,
      vehicle_number,
      vehicle_type,
      service_name,
      booking_date,
      booking_time,
      notes,
      source = "website",
    } = payload;

    // Validate required fields
    if (!user_id || !customer_phone || !vehicle_number || !booking_date || !booking_time) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: user_id, customer_phone, vehicle_number, booking_date, booking_time",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 1: Find or create customer
    let { data: customer, error: customerFindError } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user_id)
      .eq("phone", customer_phone)
      .maybeSingle();

    if (customerFindError) {
      console.error("Error finding customer:", customerFindError);
      throw customerFindError;
    }

    if (!customer) {
      // Create new customer
      const { data: newCustomer, error: customerCreateError } = await supabase
        .from("customers")
        .insert([
          {
            user_id,
            name: customer_name || "Walk-in Customer",
            phone: customer_phone,
            email: customer_email || null,
            notes: `Created from ${source}`,
          },
        ])
        .select()
        .single();

      if (customerCreateError) {
        console.error("Error creating customer:", customerCreateError);
        throw customerCreateError;
      }

      customer = newCustomer;
      console.log("Created new customer:", customer.id);
    }

    // Step 2: Find or create vehicle
    let { data: vehicle, error: vehicleFindError } = await supabase
      .from("vehicles")
      .select("*")
      .eq("user_id", user_id)
      .eq("customer_id", customer.id)
      .eq("vehicle_number", vehicle_number)
      .maybeSingle();

    if (vehicleFindError) {
      console.error("Error finding vehicle:", vehicleFindError);
      throw vehicleFindError;
    }

    if (!vehicle) {
      // Create new vehicle
      const { data: newVehicle, error: vehicleCreateError } = await supabase
        .from("vehicles")
        .insert([
          {
            user_id,
            customer_id: customer.id,
            vehicle_number,
            vehicle_type: vehicle_type || "sedan",
            notes: `Added from ${source}`,
          },
        ])
        .select()
        .single();

      if (vehicleCreateError) {
        console.error("Error creating vehicle:", vehicleCreateError);
        throw vehicleCreateError;
      }

      vehicle = newVehicle;
      console.log("Created new vehicle:", vehicle.id);
    }

    // Step 3: Find service by name (if provided)
    let serviceData: any = null;
    if (service_name) {
      const { data: service, error: serviceFindError } = await supabase
        .from("services")
        .select("*")
        .eq("user_id", user_id)
        .ilike("name", `%${service_name}%`)
        .eq("is_active", true)
        .maybeSingle();

      if (service) {
        serviceData = {
          id: service.id,
          name: service.name,
          price: service.base_price,
        };
      }
    }

    // Step 4: Create booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert([
        {
          user_id,
          customer_id: customer.id,
          vehicle_id: vehicle.id,
          booking_date,
          booking_time,
          services: serviceData ? [serviceData] : [],
          total_amount: serviceData ? serviceData.price : null,
          status: "pending",
          source,
          notes: notes || null,
        },
      ])
      .select()
      .single();

    if (bookingError) {
      console.error("Error creating booking:", bookingError);
      throw bookingError;
    }

    console.log("Booking created successfully:", booking.id);

    return new Response(
      JSON.stringify({
        success: true,
        booking_id: booking.id,
        customer_id: customer.id,
        vehicle_id: vehicle.id,
        message: "Booking created successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error processing booking webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
