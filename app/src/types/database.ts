export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface StaffFicha {
  nome_completo: string; cpf: string | null; rg: string | null; data_nascimento: string | null; cep: string | null
  rua: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null
  uf: string | null; email_secundario: string | null; telefone: string | null; whatsapp: string | null
  emergencia_nome: string | null; emergencia_parentesco: string | null; emergencia_telefone: string | null
  banco: string | null; agencia: string | null; conta: string | null; pix_tipo: string | null
  pix_chave: string | null; email: string; cargo: string; updated_at: string
}

export interface Database {
  public: {
    Tables: {
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
          capacity: number | null
          branding: Json
          settings: Json
          meta_title: string | null
          meta_description: string | null
          accent_color: string | null
          capa_na_cor: boolean
          accent_intensity: number
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
          capacity?: number | null
          branding?: Json
          settings?: Json
          meta_title?: string | null
          meta_description?: string | null
          accent_color?: string | null
          capa_na_cor?: boolean
          accent_intensity?: number
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
          capacity?: number | null
          branding?: Json
          settings?: Json
          meta_title?: string | null
          meta_description?: string | null
          accent_color?: string | null
          capa_na_cor?: boolean
          accent_intensity?: number
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
          consentimento_em: string | null
          consentimento_versao: string | null
          notified_at: string | null
          email_enviado_em: string | null
          email_falhas: number
          email_reservado_ate: string | null
          removido_em: string | null
        }
        Insert: {
          id?: string | null
          event_id: string
          user_id: string
          ticket_type_id?: string | null
          notified?: boolean
          created_at?: string
          consentimento_versao?: string | null
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
          beneficio: string
          created_at: string
        }
        Insert: {
          id?: string | null
          order_id: string
          ticket_type_id: string
          quantity?: number
          unit_price: number
          subtotal?: number
          beneficio?: string
          created_at?: string
        }
        Update: {
          id?: string | null
          order_id?: string
          ticket_type_id?: string
          quantity?: number
          unit_price?: number
          subtotal?: number
          beneficio?: string
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
          id: string
          producer_id: string
          name: string
          type: string | null
          contact: string | null
          logo_url: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          producer_id: string
          name: string
          type?: string | null
          contact?: string | null
          logo_url?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
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
          stripe_account_id: string | null
          woovi_account_id: string | null
          commission_rate: number
          is_verified: boolean
          created_at: string
          updated_at: string
          cnpj_enc: string | null
          pix_key_enc: string | null
          bank_account_enc: string | null
          cnpj_hmac: string | null
        }
        Insert: {
          id?: string | null
          company_name: string
          stripe_account_id?: string | null
          woovi_account_id?: string | null
          commission_rate?: number
          is_verified?: boolean
          created_at?: string
          updated_at?: string
          cnpj_enc?: string | null
          pix_key_enc?: string | null
          bank_account_enc?: string | null
          cnpj_hmac?: string | null
        }
        Update: {
          id?: string | null
          company_name?: string
          stripe_account_id?: string | null
          woovi_account_id?: string | null
          commission_rate?: number
          is_verified?: boolean
          created_at?: string
          updated_at?: string
          cnpj_enc?: string | null
          pix_key_enc?: string | null
          bank_account_enc?: string | null
          cnpj_hmac?: string | null
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
          cpf_enc: string | null
        }
        Insert: {
          id?: string | null
          email: string
          full_name?: string | null
          phone?: string | null
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
          cpf_enc?: string | null
        }
        Update: {
          id?: string | null
          email?: string
          full_name?: string | null
          phone?: string | null
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
          cpf_enc?: string | null
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
          blocked_at: string | null
        }
        Insert: {
          id?: string | null
          producer_id: string
          user_id: string
          role?: string
          invited_at?: string
          accepted_at?: string | null
          blocked_at?: string | null
        }
        Update: {
          id?: string | null
          producer_id?: string
          user_id?: string
          role?: string
          invited_at?: string
          accepted_at?: string | null
          blocked_at?: string | null
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
          max_por_cpf: number | null
          permite_meia: boolean
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
          max_por_cpf?: number | null
          permite_meia?: boolean
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
          max_por_cpf?: number | null
          permite_meia?: boolean
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
          status: string
          created_at: string
          processed_at: string | null
          pix_key_enc: string | null
          bank_account_enc: string | null
        }
        Insert: {
          id?: string | null
          producer_id: string
          amount: number
          status?: string
          created_at?: string
          processed_at?: string | null
          pix_key_enc?: string | null
          bank_account_enc?: string | null
        }
        Update: {
          id?: string | null
          producer_id?: string
          amount?: number
          status?: string
          processed_at?: string | null
          pix_key_enc?: string | null
          bank_account_enc?: string | null
        }
      }
    }
    Functions: {
      // Venda no servidor (docs/sql/20261030a_venda_servidor_meia.sql); escritas à mão até regenerar os tipos
      vitrine_ingressos: {
        Args: { p_event_id: string }
        Returns: { ticket_type_id: string; nome: string; preco: number; taxa: number; preco_meia: number | null; taxa_meia: number | null; permite_meia: boolean; disponiveis: number | null; meias_disponiveis: number; meias_total: number }[]
      }
      // Categorias de meia do evento (docs/sql/20261102_meia_categorias.sql); escritas à mão até regenerar os tipos
      meia_beneficios: {
        Args: { p_event_id: string }
        Returns: { codigo: string; nome: string; documento: string; cota: boolean }[]
      }
      reservar_ingressos: {
        Args: { p_event_id: string; p_itens: Json; p_cupom: string | null; p_cpf: string | null }
        Returns: Json
      }
      // Escritas e leituras de PII da cifra (docs/sql/20261007_pr7_cripto_rpcs.sql); escritas à mão: o banco ainda não tem as RPCs
      pr7_anonimizar_pii: {
        Args: { p_uid: string }
        Returns: undefined
      }
      pr7_produtor_financeiro: {
        Args: Record<string, never>
        Returns: { cnpj: string | null; pix_key: string | null; bank_account: Json }[]
      }
      pr7_salvar_produtor_financeiro: {
        Args: { p_cnpj: string | null; p_pix_key: string | null; p_bank_account: Json | null }
        Returns: undefined
      }
      pr7_admin_saques: {
        Args: Record<string, never>
        Returns: {
          id: string; amount: number; status: string; created_at: string; processed_at: string | null
          pix_key: string | null; bank_account: Json; produtor_nome: string | null; produtor_email: string | null
        }[]
      }
      pr7_admin_afiliados: {
        Args: Record<string, never>
        Returns: {
          id: string; user_id: string; referral_code: string; status: string; recurring_percent: number
          agreement_date: string; notes: string | null; full_name: string | null; cpf_mascarado: string | null
          birth_date: string | null; email: string | null; phone: string | null; whatsapp: string | null
          cep: string | null; street: string | null; street_number: string | null; complement: string | null
          neighborhood: string | null; city: string | null; state: string | null; payout_account_id: string | null
          created_at: string; updated_at: string; created_by: string | null
          user_full_name: string | null; user_email: string | null
        }[]
      }
      pr7_salvar_afiliado: {
        Args: {
          p_id: string | null; p_cpf: string | null; p_full_name: string; p_birth_date: string; p_email: string
          p_phone: string; p_whatsapp: string; p_cep: string; p_street: string; p_street_number: string
          p_complement: string | null; p_neighborhood: string; p_city: string; p_state: string
          p_recurring_percent: number; p_status: string; p_agreement_date: string; p_notes: string | null
          p_user_id?: string | null; p_referral_code?: string | null; p_payout_account_id?: string | null
        }
        Returns: string
      }
      pr7_meu_cadastro: {
        Args: Record<string, never>
        Returns: StaffFicha[]
      }
      pr7_salvar_meu_cadastro: {
        Args: {
          p_nome_completo: string; p_cpf: string; p_rg: string; p_data_nascimento: string; p_cep: string; p_rua: string
          p_numero: string; p_complemento: string | null; p_bairro: string; p_cidade: string; p_uf: string
          p_email_secundario: string; p_telefone: string; p_whatsapp: string; p_emergencia_nome: string
          p_emergencia_parentesco: string; p_emergencia_telefone: string; p_banco: string | null
          p_agencia: string | null; p_conta: string | null; p_pix_tipo: string; p_pix_chave: string; p_updated_at: string
        }
        Returns: string
      }
      colaborador_dados: {
        Args: { p_user: string }
        Returns: StaffFicha[] // CPF, RG, agência, conta e Pix mascarados
      }
    }
  }
}
