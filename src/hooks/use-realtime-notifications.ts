import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const useRealtimeNotifications = () => {
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          const booking = payload.new as any;
          if (payload.old && (payload.old as any).status !== booking.status) {
            toast({
              title: "Booking Updated",
              description: `Booking status changed to ${booking.status}`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invoices'
        },
        (payload) => {
          const invoice = payload.new as any;
          if (payload.old && (payload.old as any).payment_status !== invoice.payment_status) {
            toast({
              title: "Payment Confirmation",
              description: `Invoice ${invoice.invoice_number} marked as ${invoice.payment_status}`,
              variant: invoice.payment_status === "paid" ? "default" : "destructive",
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_cards'
        },
        (payload) => {
          const jobCard = payload.new as any;
          if (payload.old && (payload.old as any).status !== jobCard.status) {
            toast({
              title: "Job Status Changed",
              description: `Job card status updated to ${jobCard.status.replace(/_/g, ' ')}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};
