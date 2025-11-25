export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          booking_date: string
          booking_time: string
          branch_id: string | null
          created_at: string
          customer_id: string
          expected_end_time: string | null
          id: string
          notes: string | null
          services: Json
          source: string | null
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number | null
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          booking_date: string
          booking_time: string
          branch_id?: string | null
          created_at?: string
          customer_id: string
          expected_end_time?: string | null
          id?: string
          notes?: string | null
          services: Json
          source?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number | null
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          booking_date?: string
          booking_time?: string
          branch_id?: string | null
          created_at?: string
          customer_id?: string
          expected_end_time?: string | null
          id?: string
          notes?: string | null
          services?: Json
          source?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          updated_at: string
          user_id: string
          whatsapp_access_token: string | null
          whatsapp_business_account_id: string | null
          whatsapp_phone_number_id: string | null
          whatsapp_verified: boolean | null
          working_hours: Json | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
          whatsapp_access_token?: string | null
          whatsapp_business_account_id?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_verified?: boolean | null
          working_hours?: Json | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_access_token?: string | null
          whatsapp_business_account_id?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_verified?: boolean | null
          working_hours?: Json | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_vip: boolean | null
          name: string
          notes: string | null
          phone: string
          tags: string[] | null
          updated_at: string
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_vip?: boolean | null
          name: string
          notes?: string | null
          phone: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_vip?: boolean | null
          name?: string
          notes?: string | null
          phone?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string | null
          category: string
          created_at: string | null
          description: string | null
          expense_date: string
          id: string
          notes: string | null
          payment_method: string | null
          receipt_url: string | null
          updated_at: string | null
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          updated_at?: string | null
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          updated_at?: string | null
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          branch_id: string | null
          category: string | null
          cost_per_unit: number | null
          created_at: string | null
          current_stock: number | null
          id: string
          min_stock: number | null
          name: string
          notes: string | null
          supplier: string | null
          unit: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          category?: string | null
          cost_per_unit?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          min_stock?: number | null
          name: string
          notes?: string | null
          supplier?: string | null
          unit: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          category?: string | null
          cost_per_unit?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          min_stock?: number | null
          name?: string
          notes?: string | null
          supplier?: string | null
          unit?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          item_id: string | null
          notes: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          notes?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          booking_id: string | null
          created_at: string
          customer_id: string
          discount: number | null
          id: string
          invoice_number: string
          items: Json
          job_card_id: string | null
          notes: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: string | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          customer_id: string
          discount?: number | null
          id?: string
          invoice_number: string
          items: Json
          job_card_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: string | null
          subtotal: number
          tax_amount?: number | null
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          customer_id?: string
          discount?: number | null
          id?: string
          invoice_number?: string
          items?: Json
          job_card_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_card_id_fkey"
            columns: ["job_card_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cards: {
        Row: {
          assigned_staff_id: string | null
          booking_id: string | null
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          customer_id: string
          damage_notes: string | null
          id: string
          internal_notes: string | null
          materials_used: Json | null
          photos: Json | null
          services: Json
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          assigned_staff_id?: string | null
          booking_id?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          customer_id: string
          damage_notes?: string | null
          id?: string
          internal_notes?: string | null
          materials_used?: Json | null
          photos?: Json | null
          services: Json
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          assigned_staff_id?: string | null
          booking_id?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          customer_id?: string
          damage_notes?: string | null
          id?: string
          internal_notes?: string | null
          materials_used?: Json | null
          photos?: Json | null
          services?: Json
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_cards_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          base_price: number
          category: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          materials_required: Json | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_price: number
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          materials_required?: Json | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_price?: number
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          materials_required?: Json | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          auto_renew: boolean | null
          created_at: string
          customer_id: string
          end_date: string
          id: string
          is_active: boolean | null
          plan_name: string
          start_date: string
          total_washes: number
          updated_at: string
          used_washes: number | null
          user_id: string
        }
        Insert: {
          amount: number
          auto_renew?: boolean | null
          created_at?: string
          customer_id: string
          end_date: string
          id?: string
          is_active?: boolean | null
          plan_name: string
          start_date: string
          total_washes: number
          updated_at?: string
          used_washes?: number | null
          user_id: string
        }
        Update: {
          amount?: number
          auto_renew?: boolean | null
          created_at?: string
          customer_id?: string
          end_date?: string
          id?: string
          is_active?: boolean | null
          plan_name?: string
          start_date?: string
          total_washes?: number
          updated_at?: string
          used_washes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string
          customer_id: string
          id: string
          model: string | null
          notes: string | null
          updated_at: string
          user_id: string
          vehicle_number: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          customer_id: string
          id?: string
          model?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
          vehicle_number: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          model?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
          vehicle_number?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "staff"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
      job_status:
        | "check_in"
        | "pre_wash"
        | "foam_wash"
        | "interior"
        | "polishing"
        | "qc"
        | "completed"
        | "delivered"
      payment_method: "cash" | "upi" | "card" | "subscription"
      vehicle_type: "hatchback" | "sedan" | "suv" | "luxury" | "bike"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "staff"],
      booking_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      job_status: [
        "check_in",
        "pre_wash",
        "foam_wash",
        "interior",
        "polishing",
        "qc",
        "completed",
        "delivered",
      ],
      payment_method: ["cash", "upi", "card", "subscription"],
      vehicle_type: ["hatchback", "sedan", "suv", "luxury", "bike"],
    },
  },
} as const
