export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string
          producer_id: string | null
          action: string
          amount: number | null
          description: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          producer_id?: string | null
          action: string
          amount?: number | null
          description?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          producer_id?: string | null
          action?: string
          amount?: number | null
          description?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      communications: {
        Row: {
          id: string
          event_id: string | null
          producer_id: string
          type: string
          recipient: string
          subject: string | null
          content: string
          status: string
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id?: string | null
          producer_id: string
          type: string
          recipient: string
          subject?: string | null
          content: string
          status?: string
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string | null
          producer_id?: string
          type?: string
          recipient?: string
          subject?: string | null
          content?: string
          status?: string
          error_message?: string | null
          created_at?: string
        }
      }
      seating_maps: {
        Row: {
          id: string
          event_id: string
          name: string
          config: Json
          environments: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name?: string
          config?: Json
          environments?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          config?: Json
          environments?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      seating_reservations: {
        Row: {
          id: string
          seating_map_id: string
          ticket_type_id: string | null
          seat_label: string
          status: string
          expires_at: string
          user_id: string | null
          order_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          seating_map_id: string
          ticket_type_id?: string | null
          seat_label: string
          status?: string
          expires_at: string
          user_id?: string | null
          order_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          seating_map_id?: string
          ticket_type_id?: string | null
          seat_label?: string
          status?: string
          expires_at?: string
          user_id?: string | null
          order_id?: string | null
          created_at?: string
        }
      }
      ticket_transfers: {
        Row: {
          id: string
          ticket_id: string
          from_user_id: string
          to_user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          from_user_id: string
          to_user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          from_user_id?: string
          to_user_id?: string
          created_at?: string
        }
      }
      webhook_events: {
        Row: {
          id: string
          gateway: string
          event_id: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          gateway: string
          event_id: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          gateway?: string
          event_id?: string
          status?: string
          created_at?: string
        }
      }
      affiliates: {
        Row: {
          id: string | null
          producer_id: string
          event_id: string | null
          affiliate_user_id: string
          commission_percent: number
          sales: number
          total_earned: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string | null
          producer_id: string
          event_id?: string | null
          affiliate_user_id: string
          commission_percent?: number
          sales?: number
          total_earned?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string | null
          producer_id?: string
          event_id?: string | null
          affiliate_user_id?: string
          commission_percent?: number
          sales?: number
          total_earned?: number
          status?: string
          created_at?: string
        }
      }
      certificates: {
        Row: {
          id: string | null
          event_id: string
          template: Json
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string | null
          event_id: string
          template?: Json
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string | null
          event_id?: string
          template?: Json
          is_active?: boolean
          created_at?: string
        }
      }
      check_ins: {
        Row: {
          id: string | null
          event_id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          id?: string | null
          event_id: string
          ticket_id: string
          user_id: string
        }
        Update: {
          id?: string | null
          event_id?: string
          ticket_id?: string
          user_id?: string
        }
      }
      collective_tables: {
        Row: {
          id: string | null
          event_id: string
          ticket_type_id: string | null
          name: string
          theme: string | null
          capacity: number
          compatibility_score: number | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string | null
          event_id: string
          ticket_type_id?: string | null
          name: string
          theme?: string | null
          capacity?: number
          compatibility_score?: number | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string | null
          event_id?: string
          ticket_type_id?: string | null
          name?: string
          theme?: string | null
          capacity?: number
          compatibility_score?: number | null
          status?: string
          created_at?: string
        }
      }
      coupons: {
        Row: {
          id: string | null
          producer_id: string
          event_id: string | null
          code: string
          discount_type: string
          discount_value: number
          max_uses: number | null
          uses: number
          valid_until: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string | null
          producer_id: string
          event_id?: string | null
          code: string
          discount_type?: string
          discount_value: number
          max_uses?: number | null
          uses?: number
          valid_until?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string | null
          producer_id?: string
          event_id?: string | null
          code?: string
          discount_type?: string
          discount_value?: number
          max_uses?: number | null
          uses?: number
          valid_until?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      crm_interactions: {
        Row: {
          id: string | null
          lead_id: string
          type: string
          content: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          lead_id: string
          type: string
          content?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          lead_id?: string
          type?: string
          content?: string | null
          created_at?: string
        }
      }
      crm_leads: {
        Row: {
          id: string | null
          producer_id: string
          stage_id: string | null
          full_name: string
          email: string | null
          phone: string | null
          avatar_url: string | null
          source: string
          score: number
          potential_value: number
          tags: string[]
          event_interest: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          producer_id: string
          stage_id?: string | null
          full_name: string
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          source?: string
          score?: number
          potential_value?: number
          tags?: string[]
          event_interest?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          producer_id?: string
          stage_id?: string | null
          full_name?: string
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          source?: string
          score?: number
          potential_value?: number
          tags?: string[]
          event_interest?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      crm_tasks: {
        Row: {
          id: string | null
          lead_id: string
          title: string
          due_date: string | null
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string | null
          lead_id: string
          title: string
          due_date?: string | null
          completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string | null
          lead_id?: string
          title?: string
          due_date?: string | null
          completed?: boolean
          created_at?: string
        }
      }
      event_reviews: {
        Row: {
          id: string | null
          event_id: string
          user_id: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          event_id: string
          user_id: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          event_id?: string
          user_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string | null
          producer_id: string
          title: string
          subtitle: string | null
          slug: string
          description: string | null
          short_description: string | null
          cover_image: string | null
          image_url: string | null
          gallery: Json
          category: string | null
          tags: string[]
          venue_name: string | null
          venue_address: string | null
          venue_city: string | null
          venue_state: string | null
          venue_zip: string | null
          venue_lat: number | null
          venue_lng: number | null
          date: string | null
          time: string | null
          start_date: string
          end_date: string | null
          status: string
          visibility: string
          password: string | null
          capacity: number | null
          branding: Json
          settings: Json
          meta_title: string | null
          meta_description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          producer_id: string
          title: string
          subtitle?: string | null
          slug: string
          description?: string | null
          short_description?: string | null
          cover_image?: string | null
          image_url?: string | null
          gallery?: Json
          category?: string | null
          tags?: string[]
          venue_name?: string | null
          venue_address?: string | null
          venue_city?: string | null
          venue_state?: string | null
          venue_zip?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          date?: string | null
          time?: string | null
          start_date?: string
          end_date?: string | null
          status?: string
          visibility?: string
          password?: string | null
          capacity?: number | null
          branding?: Json
          settings?: Json
          meta_title?: string | null
          meta_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          producer_id?: string
          title?: string
          subtitle?: string | null
          slug?: string
          description?: string | null
          short_description?: string | null
          cover_image?: string | null
          image_url?: string | null
          gallery?: Json
          category?: string | null
          tags?: string[]
          venue_name?: string | null
          venue_address?: string | null
          venue_city?: string | null
          venue_state?: string | null
          venue_zip?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          date?: string | null
          time?: string | null
          start_date?: string
          end_date?: string | null
          status?: string
          visibility?: string
          password?: string | null
          capacity?: number | null
          branding?: Json
          settings?: Json
          meta_title?: string | null
          meta_description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      feedback: {
        Row: {
          id: string | null
          user_id: string | null
          type: string
          message: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string | null
          user_id?: string | null
          type?: string
          message: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string | null
          user_id?: string | null
          type?: string
          message?: string
          status?: string
          created_at?: string
        }
      }
      interest_lists: {
        Row: {
          id: string | null
          event_id: string
          user_id: string
          ticket_type_id: string | null
          notified: boolean
          created_at: string
        }
        Insert: {
          id?: string | null
          event_id: string
          user_id: string
          ticket_type_id?: string | null
          notified?: boolean
          created_at?: string
        }
        Update: {
          id?: string | null
          event_id?: string
          user_id?: string
          ticket_type_id?: string | null
          notified?: boolean
          created_at?: string
        }
      }
      issued_certificates: {
        Row: {
          id: string | null
          certificate_id: string
          user_id: string
          issued_at: string
          code: string
        }
        Insert: {
          id?: string | null
          certificate_id: string
          user_id: string
          issued_at?: string
          code?: string
        }
        Update: {
          id?: string | null
          certificate_id?: string
          user_id?: string
          issued_at?: string
          code?: string
        }
      }
      menu_items: {
        Row: {
          id: string | null
          event_id: string | null
          producer_id: string
          name: string
          description: string | null
          price: number
          category: string
          image_url: string | null
          is_available: boolean
          stock: number | null
          created_at: string
        }
        Insert: {
          id?: string | null
          event_id?: string | null
          producer_id: string
          name: string
          description?: string | null
          price?: number
          category?: string
          image_url?: string | null
          is_available?: boolean
          stock?: number | null
          created_at?: string
        }
        Update: {
          id?: string | null
          event_id?: string | null
          producer_id?: string
          name?: string
          description?: string | null
          price?: number
          category?: string
          image_url?: string | null
          is_available?: boolean
          stock?: number | null
          created_at?: string
        }
      }
      menu_order_items: {
        Row: {
          id: string | null
          menu_order_id: string
          menu_item_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string | null
          menu_order_id: string
          menu_item_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          id?: string | null
          menu_order_id?: string
          menu_item_id?: string
          quantity?: number
          unit_price?: number
        }
      }
      menu_orders: {
        Row: {
          id: string | null
          event_id: string
          user_id: string
          status: string
          pickup_time: string | null
          total: number
          qr_code: string
          created_at: string
        }
        Insert: {
          id?: string | null
          event_id: string
          user_id: string
          status?: string
          pickup_time?: string | null
          total?: number
          qr_code?: string
          created_at?: string
        }
        Update: {
          id?: string | null
          event_id?: string
          user_id?: string
          status?: string
          pickup_time?: string | null
          total?: number
          qr_code?: string
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string | null
          sender_id: string
          recipient_id: string
          lead_id: string | null
          content: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string | null
          sender_id: string
          recipient_id: string
          lead_id?: string | null
          content: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string | null
          sender_id?: string
          recipient_id?: string
          lead_id?: string | null
          content?: string
          is_read?: boolean
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string | null
          user_id: string
          title: string
          body: string | null
          type: string
          is_read: boolean
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string | null
          user_id: string
          title: string
          body?: string | null
          type?: string
          is_read?: boolean
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string | null
          user_id?: string
          title?: string
          body?: string | null
          type?: string
          is_read?: boolean
          metadata?: Json
          created_at?: string
        }
      }
      order_items: {
        Row: {
          id: string | null
          order_id: string
          ticket_type_id: string
          quantity: number
          unit_price: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string | null
          order_id: string
          ticket_type_id: string
          quantity?: number
          unit_price: number
          subtotal?: number
          created_at?: string
        }
        Update: {
          id?: string | null
          order_id?: string
          ticket_type_id?: string
          quantity?: number
          unit_price?: number
          subtotal?: number
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string | null
          user_id: string
          event_id: string
          coupon_id: string | null
          discount: number
          service_fee: number
          processing_fee: number
          total: number
          status: string
          payment_method: string | null
          payment_gateway: string | null
          gateway_payment_id: string | null
          customer_name: string | null
          customer_email: string | null
          customer_cpf: string | null
          customer_phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          user_id: string
          event_id: string
          coupon_id?: string | null
          discount?: number
          service_fee?: number
          processing_fee?: number
          total?: number
          status?: string
          payment_method?: string | null
          payment_gateway?: string | null
          gateway_payment_id?: string | null
          customer_name?: string | null
          customer_email?: string | null
          customer_cpf?: string | null
          customer_phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          user_id?: string
          event_id?: string
          coupon_id?: string | null
          discount?: number
          service_fee?: number
          processing_fee?: number
          total?: number
          status?: string
          payment_method?: string | null
          payment_gateway?: string | null
          gateway_payment_id?: string | null
          customer_name?: string | null
          customer_email?: string | null
          customer_cpf?: string | null
          customer_phone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      partners: {
        Row: {
          id: string | null
          producer_id: string
          name: string
          type: string | null
          contact: string | null
          logo_url: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          producer_id: string
          name: string
          type?: string | null
          contact?: string | null
          logo_url?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          producer_id?: string
          name?: string
          type?: string | null
          contact?: string | null
          logo_url?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string | null
          order_id: string
          gateway: string
          gateway_payment_id: string
          amount: number
          status: string
          split_data: Json
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          order_id: string
          gateway: string
          gateway_payment_id: string
          amount: number
          status?: string
          split_data?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          order_id?: string
          gateway?: string
          gateway_payment_id?: string
          amount?: number
          status?: string
          split_data?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      pipeline_stages: {
        Row: {
          id: string | null
          producer_id: string
          name: string
          color: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string | null
          producer_id: string
          name: string
          color?: string
          position?: number
          created_at?: string
        }
        Update: {
          id?: string | null
          producer_id?: string
          name?: string
          color?: string
          position?: number
          created_at?: string
        }
      }
      platform_settings: {
        Row: {
          id: string | null
          key: string
          value: Json
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string | null
          key: string
          value?: Json
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string | null
          key?: string
          value?: Json
          updated_by?: string | null
          updated_at?: string
        }
      }
      producer_profiles: {
        Row: {
          id: string | null
          company_name: string
          cnpj: string
          stripe_account_id: string | null
          woovi_account_id: string | null
          commission_rate: number
          is_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          company_name: string
          cnpj: string
          stripe_account_id?: string | null
          woovi_account_id?: string | null
          commission_rate?: number
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          company_name?: string
          cnpj?: string
          stripe_account_id?: string | null
          woovi_account_id?: string | null
          commission_rate?: number
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      producer_subscriptions: {
        Row: {
          id: string | null
          producer_id: string
          plan: string
          started_at: string
          expires_at: string | null
          is_active: boolean
        }
        Insert: {
          id?: string | null
          producer_id: string
          plan?: string
          started_at?: string
          expires_at?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string | null
          producer_id?: string
          plan?: string
          started_at?: string
          expires_at?: string | null
          is_active?: boolean
        }
      }
      producer_tasks: {
        Row: {
          id: string | null
          producer_id: string
          event_id: string | null
          assigned_to: string | null
          title: string
          description: string | null
          due_date: string | null
          status: string
          priority: string
          created_at: string
        }
        Insert: {
          id?: string | null
          producer_id: string
          event_id?: string | null
          assigned_to?: string | null
          title: string
          description?: string | null
          due_date?: string | null
          status?: string
          priority?: string
          created_at?: string
        }
        Update: {
          id?: string | null
          producer_id?: string
          event_id?: string | null
          assigned_to?: string | null
          title?: string
          description?: string | null
          due_date?: string | null
          status?: string
          priority?: string
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string | null
          email: string
          full_name: string | null
          phone: string | null
          cpf: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          birth_date: string | null
          instagram: string | null
          tiktok: string | null
          linkedin: string | null
          role: string
          stripe_customer_id: string | null
          is_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          email: string
          full_name?: string | null
          phone?: string | null
          cpf?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          birth_date?: string | null
          instagram?: string | null
          tiktok?: string | null
          linkedin?: string | null
          role?: string
          stripe_customer_id?: string | null
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          email?: string
          full_name?: string | null
          phone?: string | null
          cpf?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          birth_date?: string | null
          instagram?: string | null
          tiktok?: string | null
          linkedin?: string | null
          role?: string
          stripe_customer_id?: string | null
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      table_members: {
        Row: {
          id: string | null
          table_id: string
          user_id: string
          vibe: string | null
          role: string
          matchmaking_answers: Json
          joined_at: string
        }
        Insert: {
          id?: string | null
          table_id: string
          user_id: string
          vibe?: string | null
          role?: string
          matchmaking_answers?: Json
          joined_at?: string
        }
        Update: {
          id?: string | null
          table_id?: string
          user_id?: string
          vibe?: string | null
          role?: string
          matchmaking_answers?: Json
          joined_at?: string
        }
      }
      team_members: {
        Row: {
          id: string | null
          producer_id: string
          user_id: string
          role: string
          invited_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string | null
          producer_id: string
          user_id: string
          role?: string
          invited_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string | null
          producer_id?: string
          user_id?: string
          role?: string
          invited_at?: string
          accepted_at?: string | null
        }
      }
      ticket_types: {
        Row: {
          id: string | null
          event_id: string
          name: string
          description: string | null
          price: number
          capacity: number | null
          quantity_total: number
          sold: number
          quantity_sold: number
          min_per_order: number
          max_per_order: number | null
          valid_from: string | null
          valid_until: string | null
          sale_start: string | null
          sale_end: string | null
          perks: Json
          perks_array: string[]
          type: string
          sort_order: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          event_id: string
          name: string
          description?: string | null
          price?: number
          capacity?: number | null
          quantity_total?: number
          sold?: number
          quantity_sold?: number
          min_per_order?: number
          max_per_order?: number | null
          valid_from?: string | null
          valid_until?: string | null
          sale_start?: string | null
          sale_end?: string | null
          perks?: Json
          perks_array?: string[]
          type?: string
          sort_order?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          event_id?: string
          name?: string
          description?: string | null
          price?: number
          capacity?: number | null
          quantity_total?: number
          sold?: number
          quantity_sold?: number
          min_per_order?: number
          max_per_order?: number | null
          valid_from?: string | null
          valid_until?: string | null
          sale_start?: string | null
          sale_end?: string | null
          perks?: Json
          perks_array?: string[]
          type?: string
          sort_order?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      tickets: {
        Row: {
          id: string | null
          order_item_id: string | null
          order_id: string
          ticket_type_id: string
          event_id: string
          user_id: string
          buyer_name: string
          buyer_email: string
          buyer_cpf: string | null
          qr_code: string
          status: string
          price_paid: number
          transferred_to: string | null
          transfer_count: number | null
          created_at: string
        }
        Insert: {
          id?: string | null
          order_item_id?: string | null
          order_id: string
          ticket_type_id: string
          event_id: string
          user_id: string
          buyer_name: string
          buyer_email: string
          buyer_cpf?: string | null
          qr_code?: string
          status?: string
          price_paid?: number
          transferred_to?: string | null
          transfer_count?: number | null
          created_at?: string
        }
        Update: {
          id?: string | null
          order_item_id?: string | null
          order_id?: string
          ticket_type_id?: string
          event_id?: string
          user_id?: string
          buyer_name?: string
          buyer_email?: string
          buyer_cpf?: string | null
          qr_code?: string
          status?: string
          price_paid?: number
          transferred_to?: string | null
          transfer_count?: number | null
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string | null
          producer_id: string
          event_id: string | null
          order_id: string | null
          type: string
          amount: number
          description: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string | null
          producer_id: string
          event_id?: string | null
          order_id?: string | null
          type: string
          amount: number
          description?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string | null
          producer_id?: string
          event_id?: string | null
          order_id?: string | null
          type?: string
          amount?: number
          description?: string | null
          status?: string
          created_at?: string
        }
      }
      withdrawals: {
        Row: {
          id: string | null
          producer_id: string
          amount: number
          pix_key: string | null
          bank_account: Json
          status: string
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string | null
          producer_id: string
          amount: number
          pix_key?: string | null
          bank_account?: Json
          status?: string
          created_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string | null
          producer_id?: string
          amount?: number
          pix_key?: string | null
          bank_account?: Json
          status?: string
          processed_at?: string | null
        }
      }
    }
  }
}
