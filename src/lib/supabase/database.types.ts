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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      belt_levels: {
        Row: {
          archived_at: string | null
          club_id: string
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          position: number
          stripe_color: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          club_id: string
          color: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          position: number
          stripe_color?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          club_id?: string
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          position?: number
          stripe_color?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "belt_levels_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string
          address_line1: string | null
          address_line2: string | null
          archived_at: string | null
          city: string | null
          club_id: string
          coach_email: string | null
          coach_name: string | null
          coach_phone: string | null
          coach_role: string | null
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          postcode: string | null
          short_code: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          city?: string | null
          club_id: string
          coach_email?: string | null
          coach_name?: string | null
          coach_phone?: string | null
          coach_role?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          postcode?: string | null
          short_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          city?: string | null
          club_id?: string
          coach_email?: string | null
          coach_name?: string | null
          coach_phone?: string | null
          coach_role?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          postcode?: string | null
          short_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      class_series: {
        Row: {
          branch_id: string
          club_id: string
          created_at: string
          created_by: string | null
          end_date: string
          end_time: string
          id: string
          instructor_name: string | null
          name: string
          notes: string | null
          start_date: string
          start_time: string
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          branch_id: string
          club_id: string
          created_at?: string
          created_by?: string | null
          end_date: string
          end_time: string
          id?: string
          instructor_name?: string | null
          name: string
          notes?: string | null
          start_date: string
          start_time: string
          updated_at?: string
          weekdays: number[]
        }
        Update: {
          branch_id?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string
          end_time?: string
          id?: string
          instructor_name?: string | null
          name?: string
          notes?: string | null
          start_date?: string
          start_time?: string
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "class_series_club_id_branch_id_fkey"
            columns: ["club_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "class_series_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          branch_id: string
          club_id: string
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          instructor_name: string | null
          name: string
          notes: string | null
          series_id: string | null
          session_date: string
          start_time: string
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          club_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          instructor_name?: string | null
          name: string
          notes?: string | null
          series_id?: string | null
          session_date: string
          start_time: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          instructor_name?: string | null
          name?: string
          notes?: string | null
          series_id?: string | null
          session_date?: string
          start_time?: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_club_id_branch_id_fkey"
            columns: ["club_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "class_sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_club_id_series_id_fkey"
            columns: ["club_id", "series_id"]
            isOneToOne: false
            referencedRelation: "class_series"
            referencedColumns: ["club_id", "id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["club_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          association: string | null
          city: string | null
          created_at: string
          created_by: string | null
          default_monthly_fee_sen: number | null
          discipline: string
          email: string | null
          fee_due_day: number | null
          id: string
          logo_path: string | null
          name: string
          payment_methods: string[] | null
          phone: string | null
          postcode: string | null
          ros_number: string | null
          sports_commissioner_number: string | null
          ssm_number: string | null
          state: string | null
          updated_at: string
          year_founded: number | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          association?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          default_monthly_fee_sen?: number | null
          discipline: string
          email?: string | null
          fee_due_day?: number | null
          id?: string
          logo_path?: string | null
          name: string
          payment_methods?: string[] | null
          phone?: string | null
          postcode?: string | null
          ros_number?: string | null
          sports_commissioner_number?: string | null
          ssm_number?: string | null
          state?: string | null
          updated_at?: string
          year_founded?: number | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          association?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          default_monthly_fee_sen?: number | null
          discipline?: string
          email?: string | null
          fee_due_day?: number | null
          id?: string
          logo_path?: string | null
          name?: string
          payment_methods?: string[] | null
          phone?: string | null
          postcode?: string | null
          ros_number?: string | null
          sports_commissioner_number?: string | null
          ssm_number?: string | null
          state?: string | null
          updated_at?: string
          year_founded?: number | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount_sen: number
          branch_id: string | null
          category: string | null
          club_id: string
          created_at: string
          created_by: string
          currency: string
          description: string
          id: string
          occurred_on: string
        }
        Insert: {
          amount_sen: number
          branch_id?: string | null
          category?: string | null
          club_id: string
          created_at?: string
          created_by?: string
          currency?: string
          description: string
          id: string
          occurred_on: string
        }
        Update: {
          amount_sen?: number
          branch_id?: string | null
          category?: string | null
          club_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          id?: string
          occurred_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_club_id_branch_id_fkey"
            columns: ["club_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "expenses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_allocations: {
        Row: {
          amount_sen: number
          club_id: string
          created_at: string
          created_by: string
          fee_id: string
          id: string
          method: string | null
          notes: string | null
          receipt_id: string
          reference: string | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          source: string
        }
        Insert: {
          amount_sen: number
          club_id: string
          created_at?: string
          created_by?: string
          fee_id: string
          id?: string
          method?: string | null
          notes?: string | null
          receipt_id: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source: string
        }
        Update: {
          amount_sen?: number
          club_id?: string
          created_at?: string
          created_by?: string
          fee_id?: string
          id?: string
          method?: string | null
          notes?: string | null
          receipt_id?: string
          reference?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_allocations_club_id_fee_id_fkey"
            columns: ["club_id", "fee_id"]
            isOneToOne: false
            referencedRelation: "student_fees"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "fee_allocations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_allocations_club_id_receipt_id_fkey"
            columns: ["club_id", "receipt_id"]
            isOneToOne: false
            referencedRelation: "payments_received"
            referencedColumns: ["club_id", "id"]
          },
        ]
      }
      fee_audit_events: {
        Row: {
          action: string
          actor: string
          allocation_id: string | null
          club_id: string
          created_at: string
          details: Json
          fee_id: string
          id: string
        }
        Insert: {
          action: string
          actor?: string
          allocation_id?: string | null
          club_id: string
          created_at?: string
          details?: Json
          fee_id: string
          id?: string
        }
        Update: {
          action?: string
          actor?: string
          allocation_id?: string | null
          club_id?: string
          created_at?: string
          details?: Json
          fee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_audit_events_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "fee_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_audit_events_club_id_fee_id_fkey"
            columns: ["club_id", "fee_id"]
            isOneToOne: false
            referencedRelation: "student_fees"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "fee_audit_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      payments_received: {
        Row: {
          amount_sen: number
          branch_id: string | null
          category: string | null
          club_id: string
          created_at: string
          created_by: string
          currency: string
          description: string
          id: string
          occurred_on: string
        }
        Insert: {
          amount_sen: number
          branch_id?: string | null
          category?: string | null
          club_id: string
          created_at?: string
          created_by?: string
          currency?: string
          description: string
          id: string
          occurred_on: string
        }
        Update: {
          amount_sen?: number
          branch_id?: string | null
          category?: string | null
          club_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          id?: string
          occurred_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_received_club_id_branch_id_fkey"
            columns: ["club_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "payments_received_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_links: {
        Row: {
          branch_id: string
          club_id: string
          created_at: string
          created_by: string | null
          disabled_at: string | null
          expires_at: string | null
          id: string
          token: string
        }
        Insert: {
          branch_id: string
          club_id: string
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          expires_at?: string | null
          id?: string
          token: string
        }
        Update: {
          branch_id?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          expires_at?: string | null
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_links_club_id_branch_id_fkey"
            columns: ["club_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "registration_links_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      student_applications: {
        Row: {
          approved_branch_id: string | null
          club_id: string
          date_of_birth: string | null
          full_name: string
          gender: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          notes: string | null
          phone: string | null
          registration_link_id: string | null
          rejection_reason: string | null
          requested_branch_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string | null
          submission_id: string | null
          submission_position: number | null
          submitted_at: string
        }
        Insert: {
          approved_branch_id?: string | null
          club_id: string
          date_of_birth?: string | null
          full_name: string
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          registration_link_id?: string | null
          rejection_reason?: string | null
          requested_branch_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string | null
          submission_id?: string | null
          submission_position?: number | null
          submitted_at?: string
        }
        Update: {
          approved_branch_id?: string | null
          club_id?: string
          date_of_birth?: string | null
          full_name?: string
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          registration_link_id?: string | null
          rejection_reason?: string | null
          requested_branch_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string | null
          submission_id?: string | null
          submission_position?: number | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_applications_club_id_approved_branch_id_fkey"
            columns: ["club_id", "approved_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "student_applications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_applications_club_id_requested_branch_id_fkey"
            columns: ["club_id", "requested_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "student_applications_club_id_student_id_fkey"
            columns: ["club_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "student_applications_registration_link_id_fkey"
            columns: ["registration_link_id"]
            isOneToOne: false
            referencedRelation: "registration_links"
            referencedColumns: ["id"]
          },
        ]
      }
      student_fees: {
        Row: {
          amount_sen: number
          batch_id: string | null
          billing_month: string
          branch_id: string | null
          club_id: string
          created_at: string
          created_by: string
          due_date: string
          fee_type: string
          id: string
          notes: string | null
          student_id: string
          title: string
          updated_at: string | null
          updated_by: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_sen: number
          batch_id?: string | null
          billing_month: string
          branch_id?: string | null
          club_id: string
          created_at?: string
          created_by?: string
          due_date: string
          fee_type: string
          id?: string
          notes?: string | null
          student_id: string
          title: string
          updated_at?: string | null
          updated_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_sen?: number
          batch_id?: string | null
          billing_month?: string
          branch_id?: string | null
          club_id?: string
          created_at?: string
          created_by?: string
          due_date?: string
          fee_type?: string
          id?: string
          notes?: string | null
          student_id?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_fees_club_id_branch_id_fkey"
            columns: ["club_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "student_fees_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_club_id_student_id_fkey"
            columns: ["club_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["club_id", "id"]
          },
        ]
      }
      students: {
        Row: {
          archived_at: string | null
          belt_level_id: string | null
          branch_id: string | null
          club_id: string
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          full_name: string
          gender: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          join_date: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          belt_level_id?: string | null
          branch_id?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          full_name: string
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          join_date?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          belt_level_id?: string | null
          branch_id?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          full_name?: string
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          join_date?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_club_id_belt_level_id_fkey"
            columns: ["club_id", "belt_level_id"]
            isOneToOne: false
            referencedRelation: "belt_levels"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "students_club_id_branch_id_fkey"
            columns: ["club_id", "branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["club_id", "id"]
          },
          {
            foreignKeyName: "students_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_categories: {
        Row: {
          archived_at: string | null
          club_id: string
          created_at: string
          created_by: string | null
          key: string
          kind: string
          label: string
        }
        Insert: {
          archived_at?: string | null
          club_id: string
          created_at?: string
          created_by?: string | null
          key: string
          kind: string
          label: string
        }
        Update: {
          archived_at?: string | null
          club_id?: string
          created_at?: string
          created_by?: string | null
          key?: string
          kind?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_student_application: {
        Args: {
          p_application_id: string
          p_belt_level_id?: string
          p_branch_id: string
        }
        Returns: string
      }
      create_belt_level: {
        Args: {
          p_club_id: string
          p_color: string
          p_name: string
          p_stripe_color?: string
        }
        Returns: string
      }
      create_class_series: {
        Args: {
          p_branch_id: string
          p_club_id: string
          p_end_date: string
          p_end_time: string
          p_instructor_name?: string
          p_name: string
          p_notes?: string
          p_start_date: string
          p_start_time: string
          p_weekdays: number[]
        }
        Returns: {
          new_series_id: string
          new_session_count: number
        }[]
      }
      create_club: {
        Args: { p_discipline: string; p_name: string }
        Returns: string
      }
      create_fee_batch: {
        Args: {
          p_batch_id: string
          p_billing_month: string
          p_club_id: string
          p_due_date: string
          p_fee_type: string
          p_items: Json
          p_notes?: string
          p_title: string
        }
        Returns: {
          result_fee_id: string
          result_student_id: string
        }[]
      }
      create_student_fee: {
        Args: {
          p_amount_sen: number
          p_billing_month: string
          p_branch_id: string
          p_club_id: string
          p_due_date: string
          p_fee_type: string
          p_id: string
          p_notes?: string
          p_student_id: string
          p_title: string
        }
        Returns: string
      }
      fee_linkable_receipts: {
        Args: { p_club_id: string; p_search?: string }
        Returns: {
          allocated_sen: number
          amount_sen: number
          available_sen: number
          branch_id: string
          category: string
          description: string
          id: string
          occurred_on: string
        }[]
      }
      fee_list: {
        Args: {
          p_branch_id?: string
          p_club_id: string
          p_month?: string
          p_outstanding?: boolean
          p_search?: string
          p_status?: string
        }
        Returns: {
          amount_sen: number
          balance_sen: number
          billing_month: string
          branch_id: string
          created_at: string
          due_date: string
          fee_type: string
          id: string
          notes: string
          overdue: boolean
          paid_sen: number
          status: string
          student_archived: boolean
          student_id: string
          student_name: string
          title: string
          void_reason: string
          voided_at: string
        }[]
      }
      fee_summary: {
        Args: {
          p_branch_id?: string
          p_club_id: string
          p_month?: string
          p_outstanding?: boolean
        }
        Returns: {
          charged_sen: string
          collected_sen: string
          fee_count: number
          outstanding_sen: string
          overdue_sen: string
        }[]
      }
      finance_branch_totals: {
        Args: { p_club_id: string; p_end: string; p_start: string }
        Returns: {
          branch_id: string
          expense_sen: string
          income_sen: string
        }[]
      }
      finance_category_totals: {
        Args: {
          p_branch_id?: string
          p_club_id: string
          p_end: string
          p_start: string
        }
        Returns: {
          category: string
          kind: string
          record_count: number
          total_sen: string
        }[]
      }
      finance_monthly_totals: {
        Args: {
          p_branch_id?: string
          p_club_id: string
          p_end: string
          p_start: string
        }
        Returns: {
          expense_sen: string
          income_sen: string
          month: string
        }[]
      }
      finance_totals: {
        Args: {
          p_branch_id?: string
          p_category?: string
          p_club_id: string
          p_end: string
          p_start: string
        }
        Returns: {
          expense_sen: string
          income_sen: string
        }[]
      }
      finance_transaction_totals: {
        Args: {
          p_branch_id?: string
          p_category?: string
          p_club_id: string
          p_end: string
          p_kind?: string
          p_search?: string
          p_start: string
        }
        Returns: {
          expense_sen: string
          income_sen: string
          record_count: number
        }[]
      }
      finance_transactions: {
        Args: {
          p_branch_id?: string
          p_category?: string
          p_club_id: string
          p_end: string
          p_kind?: string
          p_search?: string
          p_start: string
        }
        Returns: {
          amount_sen: number
          branch_id: string
          category: string
          created_at: string
          description: string
          id: string
          kind: string
          occurred_on: string
        }[]
      }
      generate_monthly_fees: {
        Args: {
          p_billing_month: string
          p_club_id: string
          p_due_date: string
          p_items: Json
          p_title: string
        }
        Returns: {
          outcome: string
          result_fee_id: string
          result_student_id: string
        }[]
      }
      get_or_create_registration_link: {
        Args: { p_branch_id: string; p_club_id: string }
        Returns: string
      }
      get_registration_link_info: {
        Args: { p_token: string }
        Returns: {
          branch_name: string
          club_name: string
          discipline: string
          state: string
        }[]
      }
      link_fee_receipt: {
        Args: {
          p_amount_sen: number
          p_club_id: string
          p_fee_id: string
          p_id: string
          p_receipt_id: string
        }
        Returns: string
      }
      move_belt_level: {
        Args: { p_direction: number; p_level_id: string }
        Returns: undefined
      }
      record_fee_payment: {
        Args: {
          p_amount_sen: number
          p_club_id: string
          p_fee_id: string
          p_id: string
          p_method: string
          p_notes?: string
          p_paid_on: string
          p_reference?: string
        }
        Returns: string
      }
      record_manual_transaction: {
        Args: {
          p_amount_sen: number
          p_branch_id: string
          p_category: string
          p_club_id: string
          p_description: string
          p_id: string
          p_kind: string
          p_occurred_on: string
        }
        Returns: string
      }
      reject_student_application: {
        Args: { p_application_id: string; p_reason: string }
        Returns: string
      }
      replace_registration_link: {
        Args: { p_branch_id: string; p_club_id: string }
        Returns: string
      }
      reverse_fee_allocation: {
        Args: { p_allocation_id: string; p_club_id: string; p_reason: string }
        Returns: undefined
      }
      submit_student_application: {
        Args: {
          p_date_of_birth: string
          p_full_name: string
          p_gender: string
          p_guardian_name: string
          p_guardian_phone: string
          p_notes: string
          p_phone: string
          p_submission_id: string
          p_token: string
        }
        Returns: undefined
      }
      submit_student_applications: {
        Args: {
          p_children: Json
          p_guardian_name: string
          p_guardian_phone: string
          p_notes: string
          p_submission_id: string
          p_token: string
        }
        Returns: number
      }
      update_student_fee: {
        Args: {
          p_amount_sen: number
          p_billing_month: string
          p_branch_id: string
          p_club_id: string
          p_due_date: string
          p_fee_id: string
          p_fee_type: string
          p_notes?: string
          p_title: string
        }
        Returns: undefined
      }
      void_student_fee: {
        Args: { p_club_id: string; p_fee_id: string; p_reason: string }
        Returns: undefined
      }
    }
    Enums: {
      club_role: "owner"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      club_role: ["owner"],
    },
  },
} as const
