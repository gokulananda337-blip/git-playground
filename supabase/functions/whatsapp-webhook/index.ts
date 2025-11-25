import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle GET requests for webhook verification
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'your_verify_token';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified');
      return new Response(challenge, { status: 200 });
    } else {
      return new Response('Forbidden', { status: 403 });
    }
  }

  try {
    const payload = await req.json();
    console.log("WhatsApp webhook received:", JSON.stringify(payload, null, 2));

    // Handle incoming WhatsApp messages
    if (payload.entry?.[0]?.changes?.[0]?.value?.messages) {
      const change = payload.entry[0].changes[0].value;
      const message = change.messages[0];
      const from = message.from; // Customer's WhatsApp number
      const text = message.text?.body;
      const phoneNumberId = change.metadata?.phone_number_id; // Identifies which branch

      console.log(`Message from ${from} to phone_number_id ${phoneNumberId}: ${text}`);

      // Initialize Supabase client
      const supabase = createClient(supabaseUrl, supabaseKey);

      // 1. Find which tenant (branch) this message belongs to
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('*, user_id')
        .eq('whatsapp_phone_number_id', phoneNumberId)
        .single();

      if (branchError || !branch) {
        console.error('Branch not found for phone_number_id:', phoneNumberId);
        return new Response(
          JSON.stringify({ error: 'Branch not configured' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Found branch:', branch.name, 'for user:', branch.user_id);

      // 2. Find or create customer based on WhatsApp number
      let { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('whatsapp_number', from)
        .eq('user_id', branch.user_id)
        .single();

      if (customerError || !customer) {
        // Create new customer
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({
            user_id: branch.user_id,
            name: `WhatsApp Customer ${from}`,
            phone: from,
            whatsapp_number: from,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating customer:', createError);
          return new Response(
            JSON.stringify({ error: 'Failed to create customer' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        customer = newCustomer;
      }

      console.log('Customer:', customer.name);

      // 3. Parse message using simple keyword matching (TODO: Use AI for better parsing)
      const messageText = text?.toLowerCase() || '';
      let bookingIntent = false;
      let serviceType = '';
      let requestedDate = new Date();
      let requestedTime = '10:00';

      // Simple keyword detection
      if (messageText.includes('book') || messageText.includes('appointment') || messageText.includes('wash')) {
        bookingIntent = true;
      }

      if (messageText.includes('foam') || messageText.includes('foam wash')) {
        serviceType = 'Foam Wash';
      } else if (messageText.includes('interior')) {
        serviceType = 'Interior Cleaning';
      } else if (messageText.includes('polish')) {
        serviceType = 'Polishing';
      } else {
        serviceType = 'Basic Wash';
      }

      // Simple time detection
      if (messageText.includes('morning')) {
        requestedTime = '09:00';
      } else if (messageText.includes('afternoon')) {
        requestedTime = '14:00';
      } else if (messageText.includes('evening')) {
        requestedTime = '17:00';
      }

      // Date detection
      if (messageText.includes('today')) {
        requestedDate = new Date();
      } else if (messageText.includes('tomorrow')) {
        requestedDate = new Date();
        requestedDate.setDate(requestedDate.getDate() + 1);
      }

      // 4. Send response via WhatsApp
      const responseMessage = bookingIntent
        ? `Thank you! I'm processing your request for a ${serviceType} on ${requestedDate.toLocaleDateString()} at ${requestedTime}. Our team will confirm shortly.`
        : `Hello! I'm the AutoWash AI assistant. You can book a car wash by messaging: "Book a foam wash tomorrow morning"`;

      // Send WhatsApp message
      try {
        const whatsappResponse = await fetch(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${branch.whatsapp_access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: from,
              text: { body: responseMessage },
            }),
          }
        );

        if (!whatsappResponse.ok) {
          console.error('WhatsApp API error:', await whatsappResponse.text());
        }
      } catch (whatsappError) {
        console.error('Error sending WhatsApp message:', whatsappError);
      }

      // 5. Create booking if intent detected
      if (bookingIntent) {
        // Get customer's first vehicle or prompt for vehicle details
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('*')
          .eq('customer_id', customer.id)
          .limit(1);

        if (vehicles && vehicles.length > 0) {
          const vehicle = vehicles[0];

          // Create booking
          const { error: bookingError } = await supabase
            .from('bookings')
            .insert({
              user_id: branch.user_id,
              branch_id: branch.id,
              customer_id: customer.id,
              vehicle_id: vehicle.id,
              booking_date: requestedDate.toISOString().split('T')[0],
              booking_time: requestedTime,
              services: JSON.stringify([{ name: serviceType, price: 500 }]),
              source: 'whatsapp',
              status: 'pending',
            });

          if (bookingError) {
            console.error('Error creating booking:', bookingError);
          } else {
            console.log('Booking created successfully');
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Message processed',
          customer: customer.name,
          branch: branch.name,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
