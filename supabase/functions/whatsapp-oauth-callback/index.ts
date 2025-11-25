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

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // branch_id
    const error = url.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return new Response(
        `<html><body><h1>Authorization Failed</h1><p>${error}</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 400 }
      );
    }

    if (!code || !state) {
      return new Response(
        '<html><body><h1>Invalid Request</h1><p>Missing code or state</p></body></html>',
        { headers: { 'Content-Type': 'text/html' }, status: 400 }
      );
    }

    // Exchange code for access token
    const appId = Deno.env.get('META_APP_ID');
    const appSecret = Deno.env.get('META_APP_SECRET');
    const redirectUri = `${url.origin}/functions/v1/whatsapp-oauth-callback`;

    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange error:', errorText);
      return new Response(
        `<html><body><h1>Token Exchange Failed</h1><p>${errorText}</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get WhatsApp Business Account details
    const wabaResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
    );

    if (!wabaResponse.ok) {
      const errorText = await wabaResponse.text();
      console.error('WABA fetch error:', errorText);
      return new Response(
        `<html><body><h1>Failed to fetch WhatsApp Business Account</h1><p>${errorText}</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 500 }
      );
    }

    const wabaData = await wabaResponse.json();
    
    // For simplicity, we'll use the first WABA and phone number
    // In production, you'd want to let the user select from multiple options
    const wabaId = wabaData.data?.[0]?.id;
    
    // Get phone numbers for this WABA
    const phoneResponse = await fetch(
      `https://graph.facebook.com/v18.0/${wabaId}/phone_numbers?access_token=${accessToken}`
    );

    const phoneData = await phoneResponse.json();
    const phoneNumberId = phoneData.data?.[0]?.id;

    if (!wabaId || !phoneNumberId) {
      return new Response(
        '<html><body><h1>Setup Incomplete</h1><p>No WhatsApp Business Account or phone number found. Please complete setup in Meta Business Manager.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' }, status: 400 }
      );
    }

    // Update branch in Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: updateError } = await supabase
      .from('branches')
      .update({
        whatsapp_phone_number_id: phoneNumberId,
        whatsapp_access_token: accessToken,
        whatsapp_business_account_id: wabaId,
        whatsapp_verified: true,
      })
      .eq('id', state);

    if (updateError) {
      console.error('Database update error:', updateError);
      return new Response(
        `<html><body><h1>Database Error</h1><p>${updateError.message}</p></body></html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 500 }
      );
    }

    // Success - redirect back to settings page
    return new Response(
      '<html><body><h1>Success!</h1><p>WhatsApp connected successfully. You can close this window.</p><script>window.close();</script></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(
      `<html><body><h1>Error</h1><p>${error instanceof Error ? error.message : 'Unknown error'}</p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
});