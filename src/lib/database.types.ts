export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          event_id: number | null
          id: number
          new_row: Json | null
          old_row: Json | null
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          event_id?: number | null
          id?: never
          new_row?: Json | null
          old_row?: Json | null
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          event_id?: number | null
          id?: never
          new_row?: Json | null
          old_row?: Json | null
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      checkpoints: {
        Row: {
          code: string
          event_id: number
          id: number
          is_mandatory: boolean
          name: string
          name_en: string | null
          sort_order: number
          stage_id: number
        }
        Insert: {
          code: string
          event_id: number
          id?: never
          is_mandatory?: boolean
          name?: string
          name_en?: string | null
          sort_order?: number
          stage_id: number
        }
        Update: {
          code?: string
          event_id?: number
          id?: never
          is_mandatory?: boolean
          name?: string
          name_en?: string | null
          sort_order?: number
          stage_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "checkpoints_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "checkpoints_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      classes: {
        Row: {
          code: string
          id: number
          max_age: number | null
          min_age: number | null
          name: string
          name_en: string | null
          number_bg: string | null
          number_fg: string | null
          season_id: number | null
          sort_order: number
          team_scoring: boolean
        }
        Insert: {
          code: string
          id?: never
          max_age?: number | null
          min_age?: number | null
          name: string
          name_en?: string | null
          number_bg?: string | null
          number_fg?: string | null
          season_id?: number | null
          sort_order?: number
          team_scoring?: boolean
        }
        Update: {
          code?: string
          id?: never
          max_age?: number | null
          min_age?: number | null
          name?: string
          name_en?: string | null
          number_bg?: string | null
          number_fg?: string | null
          season_id?: number | null
          sort_order?: number
          team_scoring?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "classes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          bfm_licensed: boolean
          country: string
          id: number
          name: string
        }
        Insert: {
          bfm_licensed?: boolean
          country?: string
          id?: never
          name: string
        }
        Update: {
          bfm_licensed?: boolean
          country?: string
          id?: never
          name?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          class_id: number
          club_id: number | null
          created_at: string
          event_id: number
          id: number
          race_number: number
          rider_id: number
          transponder: string | null
          withdrawn: boolean
        }
        Insert: {
          class_id: number
          club_id?: number | null
          created_at?: string
          event_id: number
          id?: never
          race_number: number
          rider_id: number
          transponder?: string | null
          withdrawn?: boolean
        }
        Update: {
          class_id?: number
          club_id?: number | null
          created_at?: string
          event_id?: number
          id?: never
          race_number?: number
          rider_id?: number
          transponder?: string | null
          withdrawn?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_event_id_class_id_fkey"
            columns: ["event_id", "class_id"]
            isOneToOne: false
            referencedRelation: "event_classes"
            referencedColumns: ["event_id", "class_id"]
          },
          {
            foreignKeyName: "entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      event_classes: {
        Row: {
          class_id: number
          event_id: number
          start_order: number
        }
        Insert: {
          class_id: number
          event_id: number
          start_order?: number
        }
        Update: {
          class_id?: number
          event_id?: number
          start_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_classes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_staff: {
        Row: {
          event_id: number
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          event_id: number
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          event_id?: number
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          date_from: string
          date_to: string
          id: number
          image_url: string | null
          kind: Database["public"]["Enums"]["event_kind"]
          location: string
          name: string
          ranking: string
          round_number: number | null
          season_id: number | null
          status: Database["public"]["Enums"]["event_status"]
          timezone: string
        }
        Insert: {
          created_at?: string
          date_from: string
          date_to: string
          id?: never
          image_url?: string | null
          kind?: Database["public"]["Enums"]["event_kind"]
          location?: string
          name: string
          ranking?: string
          round_number?: number | null
          season_id?: number | null
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string
        }
        Update: {
          created_at?: string
          date_from?: string
          date_to?: string
          id?: never
          image_url?: string | null
          kind?: Database["public"]["Enums"]["event_kind"]
          location?: string
          name?: string
          ranking?: string
          round_number?: number | null
          season_id?: number | null
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      laps: {
        Row: {
          client_id: string
          crossed_at: string
          entry_id: number
          event_id: number
          id: number
          recorded_at: string
          recorded_by: string | null
          session_id: number
          source: Database["public"]["Enums"]["fact_source"]
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          client_id: string
          crossed_at: string
          entry_id: number
          event_id: number
          id?: never
          recorded_at?: string
          recorded_by?: string | null
          session_id: number
          source?: Database["public"]["Enums"]["fact_source"]
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          client_id?: string
          crossed_at?: string
          entry_id?: number
          event_id?: number
          id?: never
          recorded_at?: string
          recorded_by?: string | null
          session_id?: number
          source?: Database["public"]["Enums"]["fact_source"]
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laps_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "laps_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entry_eligibility"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "laps_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "laps_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_time_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "laps_session_id_event_id_fkey"
            columns: ["session_id", "event_id"]
            isOneToOne: false
            referencedRelation: "session_results"
            referencedColumns: ["session_id", "event_id"]
          },
          {
            foreignKeyName: "laps_session_id_event_id_fkey"
            columns: ["session_id", "event_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      passings: {
        Row: {
          checkpoint_id: number | null
          client_id: string
          entry_id: number
          event_id: number
          id: number
          passed_at: string
          point: Database["public"]["Enums"]["passing_point"]
          recorded_at: string
          recorded_by: string | null
          source: Database["public"]["Enums"]["fact_source"]
          stage_id: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          checkpoint_id?: number | null
          client_id: string
          entry_id: number
          event_id: number
          id?: never
          passed_at: string
          point: Database["public"]["Enums"]["passing_point"]
          recorded_at?: string
          recorded_by?: string | null
          source?: Database["public"]["Enums"]["fact_source"]
          stage_id: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          checkpoint_id?: number | null
          client_id?: string
          entry_id?: number
          event_id?: number
          id?: never
          passed_at?: string
          point?: Database["public"]["Enums"]["passing_point"]
          recorded_at?: string
          recorded_by?: string | null
          source?: Database["public"]["Enums"]["fact_source"]
          stage_id?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "passings_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passings_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "navigation_splits"
            referencedColumns: ["checkpoint_id"]
          },
          {
            foreignKeyName: "passings_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "passings_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entry_eligibility"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "passings_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "passings_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_time_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "passings_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "passings_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      penalties: {
        Row: {
          created_at: string
          created_by: string | null
          dsq_scope: Database["public"]["Enums"]["dsq_scope"] | null
          entry_id: number
          event_id: number
          evidence_url: string | null
          id: number
          note: string | null
          penalty_type_id: number
          reviewed_at: string | null
          reviewed_by: string | null
          seconds: number | null
          session_id: number | null
          stage_id: number
          status: Database["public"]["Enums"]["review_status"]
          units: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dsq_scope?: Database["public"]["Enums"]["dsq_scope"] | null
          entry_id: number
          event_id: number
          evidence_url?: string | null
          id?: never
          note?: string | null
          penalty_type_id: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          seconds?: number | null
          session_id?: number | null
          stage_id: number
          status?: Database["public"]["Enums"]["review_status"]
          units?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dsq_scope?: Database["public"]["Enums"]["dsq_scope"] | null
          entry_id?: number
          event_id?: number
          evidence_url?: string | null
          id?: never
          note?: string | null
          penalty_type_id?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          seconds?: number | null
          session_id?: number | null
          stage_id?: number
          status?: Database["public"]["Enums"]["review_status"]
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "penalties_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "penalties_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entry_eligibility"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "penalties_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "penalties_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_time_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "penalties_penalty_type_id_fkey"
            columns: ["penalty_type_id"]
            isOneToOne: false
            referencedRelation: "penalty_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penalties_session_id_event_id_fkey"
            columns: ["session_id", "event_id"]
            isOneToOne: false
            referencedRelation: "session_results"
            referencedColumns: ["session_id", "event_id"]
          },
          {
            foreignKeyName: "penalties_session_id_event_id_fkey"
            columns: ["session_id", "event_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "penalties_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "penalties_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      penalty_types: {
        Row: {
          active: boolean
          code: string
          dsq_scope: Database["public"]["Enums"]["dsq_scope"] | null
          event_id: number | null
          fine_eur: number | null
          id: number
          kind: Database["public"]["Enums"]["penalty_kind"]
          name: string
          name_en: string | null
          rule_ref: string | null
          seconds: number | null
          unit_label: string | null
        }
        Insert: {
          active?: boolean
          code: string
          dsq_scope?: Database["public"]["Enums"]["dsq_scope"] | null
          event_id?: number | null
          fine_eur?: number | null
          id?: never
          kind: Database["public"]["Enums"]["penalty_kind"]
          name: string
          name_en?: string | null
          rule_ref?: string | null
          seconds?: number | null
          unit_label?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          dsq_scope?: Database["public"]["Enums"]["dsq_scope"] | null
          event_id?: number | null
          fine_eur?: number | null
          id?: never
          kind?: Database["public"]["Enums"]["penalty_kind"]
          name?: string
          name_en?: string | null
          rule_ref?: string | null
          seconds?: number | null
          unit_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "penalty_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      points_scales: {
        Row: {
          code: string
          name: string
          points: number[]
        }
        Insert: {
          code: string
          name: string
          points: number[]
        }
        Update: {
          code?: string
          name?: string
          points?: number[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_super_admin: boolean
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          is_super_admin?: boolean
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_super_admin?: boolean
        }
        Relationships: []
      }
      protests: {
        Row: {
          against_entry_id: number | null
          deadline_at: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          event_id: number
          fact: string
          fee_eur: number
          fee_paid: boolean
          fee_refunded: boolean
          filed_at: string
          filed_by_entry_id: number | null
          id: number
          stage_id: number | null
          status: Database["public"]["Enums"]["protest_status"]
          type: Database["public"]["Enums"]["protest_type"]
        }
        Insert: {
          against_entry_id?: number | null
          deadline_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          event_id: number
          fact: string
          fee_eur?: number
          fee_paid?: boolean
          fee_refunded?: boolean
          filed_at?: string
          filed_by_entry_id?: number | null
          id?: never
          stage_id?: number | null
          status?: Database["public"]["Enums"]["protest_status"]
          type: Database["public"]["Enums"]["protest_type"]
        }
        Update: {
          against_entry_id?: number | null
          deadline_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          event_id?: number
          fact?: string
          fee_eur?: number
          fee_paid?: boolean
          fee_refunded?: boolean
          filed_at?: string
          filed_by_entry_id?: number | null
          id?: never
          stage_id?: number | null
          status?: Database["public"]["Enums"]["protest_status"]
          type?: Database["public"]["Enums"]["protest_type"]
        }
        Relationships: [
          {
            foreignKeyName: "protests_against_entry_id_event_id_fkey"
            columns: ["against_entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "protests_against_entry_id_event_id_fkey"
            columns: ["against_entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entry_eligibility"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "protests_against_entry_id_event_id_fkey"
            columns: ["against_entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "protests_against_entry_id_event_id_fkey"
            columns: ["against_entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_time_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "protests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protests_filed_by_entry_id_event_id_fkey"
            columns: ["filed_by_entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "protests_filed_by_entry_id_event_id_fkey"
            columns: ["filed_by_entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entry_eligibility"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "protests_filed_by_entry_id_event_id_fkey"
            columns: ["filed_by_entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "protests_filed_by_entry_id_event_id_fkey"
            columns: ["filed_by_entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_time_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "protests_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "protests_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      publications: {
        Row: {
          event_id: number
          id: number
          note: string | null
          protest_deadline_at: string | null
          published_at: string
          published_by: string | null
          published_by_name: string | null
          snapshot: Json | null
          stage_id: number | null
          state: Database["public"]["Enums"]["publication_state"]
          version: number
        }
        Insert: {
          event_id: number
          id?: never
          note?: string | null
          protest_deadline_at?: string | null
          published_at?: string
          published_by?: string | null
          published_by_name?: string | null
          snapshot?: Json | null
          stage_id?: number | null
          state: Database["public"]["Enums"]["publication_state"]
          version?: number
        }
        Update: {
          event_id?: number
          id?: never
          note?: string | null
          protest_deadline_at?: string | null
          published_at?: string
          published_by?: string | null
          published_by_name?: string | null
          snapshot?: Json | null
          stage_id?: number | null
          state?: Database["public"]["Enums"]["publication_state"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "publications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "publications_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      rider_private: {
        Row: {
          birth_date: string | null
          blood_group: string | null
          email: string | null
          gps_model: string | null
          license_number: string | null
          license_type: Database["public"]["Enums"]["license_type"] | null
          license_valid_until: string | null
          notes: string | null
          phone: string | null
          rider_id: number
        }
        Insert: {
          birth_date?: string | null
          blood_group?: string | null
          email?: string | null
          gps_model?: string | null
          license_number?: string | null
          license_type?: Database["public"]["Enums"]["license_type"] | null
          license_valid_until?: string | null
          notes?: string | null
          phone?: string | null
          rider_id: number
        }
        Update: {
          birth_date?: string | null
          blood_group?: string | null
          email?: string | null
          gps_model?: string | null
          license_number?: string | null
          license_type?: Database["public"]["Enums"]["license_type"] | null
          license_valid_until?: string | null
          notes?: string | null
          phone?: string | null
          rider_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "rider_private_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: true
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_statuses: {
        Row: {
          entry_id: number
          event_id: number
          id: number
          reason: string | null
          session_id: number | null
          set_at: string
          set_by: string | null
          stage_id: number
          status: Database["public"]["Enums"]["rider_status"]
        }
        Insert: {
          entry_id: number
          event_id: number
          id?: never
          reason?: string | null
          session_id?: number | null
          set_at?: string
          set_by?: string | null
          stage_id: number
          status: Database["public"]["Enums"]["rider_status"]
        }
        Update: {
          entry_id?: number
          event_id?: number
          id?: never
          reason?: string | null
          session_id?: number | null
          set_at?: string
          set_by?: string | null
          stage_id?: number
          status?: Database["public"]["Enums"]["rider_status"]
        }
        Relationships: [
          {
            foreignKeyName: "rider_statuses_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "rider_statuses_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entry_eligibility"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "rider_statuses_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "rider_statuses_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_time_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "rider_statuses_session_id_event_id_fkey"
            columns: ["session_id", "event_id"]
            isOneToOne: false
            referencedRelation: "session_results"
            referencedColumns: ["session_id", "event_id"]
          },
          {
            foreignKeyName: "rider_statuses_session_id_event_id_fkey"
            columns: ["session_id", "event_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "rider_statuses_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "rider_statuses_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      riders: {
        Row: {
          club_id: number | null
          country: string
          created_at: string
          first_name: string
          id: number
          last_name: string
        }
        Insert: {
          club_id?: number | null
          country?: string
          created_at?: string
          first_name: string
          id?: never
          last_name: string
        }
        Update: {
          club_id?: number | null
          country?: string
          created_at?: string
          first_name?: string
          id?: never
          last_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "riders_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      season_numbers: {
        Row: {
          class_id: number
          race_number: number
          rider_id: number
          season_id: number
        }
        Insert: {
          class_id: number
          race_number: number
          rider_id: number
          season_id: number
        }
        Update: {
          class_id?: number
          race_number?: number
          rider_id?: number
          season_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_numbers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_numbers_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_numbers_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          drop_worst_rounds: number
          id: number
          name: string
          year: number
        }
        Insert: {
          drop_worst_rounds?: number
          id?: never
          name: string
          year: number
        }
        Update: {
          drop_worst_rounds?: number
          id?: never
          name?: string
          year?: number
        }
        Relationships: []
      }
      session_riders: {
        Row: {
          entry_id: number
          event_id: number
          grid_position: number | null
          session_id: number
        }
        Insert: {
          entry_id: number
          event_id: number
          grid_position?: number | null
          session_id: number
        }
        Update: {
          entry_id?: number
          event_id?: number
          grid_position?: number | null
          session_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_riders_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "session_riders_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entry_eligibility"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "session_riders_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "session_riders_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_time_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "session_riders_session_id_event_id_fkey"
            columns: ["session_id", "event_id"]
            isOneToOne: false
            referencedRelation: "session_results"
            referencedColumns: ["session_id", "event_id"]
          },
          {
            foreignKeyName: "session_riders_session_id_event_id_fkey"
            columns: ["session_id", "event_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      sessions: {
        Row: {
          class_id: number
          duration_minutes: number | null
          event_id: number
          extra_laps: number
          finished_at: string | null
          group_label: string | null
          id: number
          kind: Database["public"]["Enums"]["session_kind"]
          number: number
          red_flag_at: string | null
          red_flag_decision: string | null
          stage_id: number
          started_at: string | null
        }
        Insert: {
          class_id: number
          duration_minutes?: number | null
          event_id: number
          extra_laps?: number
          finished_at?: string | null
          group_label?: string | null
          id?: never
          kind: Database["public"]["Enums"]["session_kind"]
          number?: number
          red_flag_at?: string | null
          red_flag_decision?: string | null
          stage_id: number
          started_at?: string | null
        }
        Update: {
          class_id?: number
          duration_minutes?: number | null
          event_id?: number
          extra_laps?: number
          finished_at?: string | null
          group_label?: string | null
          id?: never
          kind?: Database["public"]["Enums"]["session_kind"]
          number?: number
          red_flag_at?: string | null
          red_flag_decision?: string | null
          stage_id?: number
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_event_id_class_id_fkey"
            columns: ["event_id", "class_id"]
            isOneToOne: false
            referencedRelation: "event_classes"
            referencedColumns: ["event_id", "class_id"]
          },
          {
            foreignKeyName: "sessions_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "sessions_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      stage_classes: {
        Row: {
          class_id: number
          course_closes_at: string | null
          distance_km: number | null
          event_id: number
          gap_before_seconds: number
          riders_per_slot: number | null
          stage_id: number
          start_interval_seconds: number | null
          start_order: number
        }
        Insert: {
          class_id: number
          course_closes_at?: string | null
          distance_km?: number | null
          event_id: number
          gap_before_seconds?: number
          riders_per_slot?: number | null
          stage_id: number
          start_interval_seconds?: number | null
          start_order?: number
        }
        Update: {
          class_id?: number
          course_closes_at?: string | null
          distance_km?: number | null
          event_id?: number
          gap_before_seconds?: number
          riders_per_slot?: number | null
          stage_id?: number
          start_interval_seconds?: number | null
          start_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "stage_classes_event_id_class_id_fkey"
            columns: ["event_id", "class_id"]
            isOneToOne: false
            referencedRelation: "event_classes"
            referencedColumns: ["event_id", "class_id"]
          },
          {
            foreignKeyName: "stage_classes_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "stage_classes_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      stage_tracks: {
        Row: {
          class_id: number | null
          event_id: number
          id: number
          length_m: number | null
          mandatory_waypoints: string[]
          name: string
          point_count: number
          stage_id: number
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          class_id?: number | null
          event_id: number
          id?: never
          length_m?: number | null
          mandatory_waypoints?: string[]
          name: string
          point_count?: number
          stage_id: number
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          class_id?: number | null
          event_id?: number
          id?: never
          length_m?: number | null
          mandatory_waypoints?: string[]
          name?: string
          point_count?: number
          stage_id?: number
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stage_tracks_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "stage_tracks_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      stages: {
        Row: {
          course_closes_at: string | null
          day_number: number
          event_id: number
          first_start_at: string | null
          id: number
          name: string
          name_en: string | null
          points_scale: string | null
          riders_per_slot: number
          sort_order: number
          start_interval_seconds: number | null
          type: Database["public"]["Enums"]["stage_type"]
        }
        Insert: {
          course_closes_at?: string | null
          day_number: number
          event_id: number
          first_start_at?: string | null
          id?: never
          name: string
          name_en?: string | null
          points_scale?: string | null
          riders_per_slot?: number
          sort_order?: number
          start_interval_seconds?: number | null
          type: Database["public"]["Enums"]["stage_type"]
        }
        Update: {
          course_closes_at?: string | null
          day_number?: number
          event_id?: number
          first_start_at?: string | null
          id?: never
          name?: string
          name_en?: string | null
          points_scale?: string | null
          riders_per_slot?: number
          sort_order?: number
          start_interval_seconds?: number | null
          type?: Database["public"]["Enums"]["stage_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stages_points_scale_fkey"
            columns: ["points_scale"]
            isOneToOne: false
            referencedRelation: "points_scales"
            referencedColumns: ["code"]
          },
        ]
      }
      start_slots: {
        Row: {
          entry_id: number
          event_id: number
          position: number
          scheduled_start: string
          stage_id: number
        }
        Insert: {
          entry_id: number
          event_id: number
          position: number
          scheduled_start: string
          stage_id: number
        }
        Update: {
          entry_id?: number
          event_id?: number
          position?: number
          scheduled_start?: string
          stage_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "start_slots_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "start_slots_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entry_eligibility"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "start_slots_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "start_slots_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_time_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "start_slots_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "start_slots_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      time_adjustments: {
        Row: {
          class_id: number | null
          created_at: string
          created_by: string | null
          entry_id: number | null
          event_id: number
          id: number
          reason: string
          seconds: number
          stage_id: number
        }
        Insert: {
          class_id?: number | null
          created_at?: string
          created_by?: string | null
          entry_id?: number | null
          event_id: number
          id?: never
          reason: string
          seconds: number
          stage_id: number
        }
        Update: {
          class_id?: number | null
          created_at?: string
          created_by?: string | null
          entry_id?: number | null
          event_id?: number
          id?: never
          reason?: string
          seconds?: number
          stage_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "time_adjustments_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "time_adjustments_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entry_eligibility"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "time_adjustments_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "time_adjustments_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_time_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "time_adjustments_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "time_adjustments_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
    }
    Views: {
      enduro_cross_results: {
        Row: {
          class_id: number | null
          entry_id: number | null
          event_id: number | null
          heat_points: number | null
          heat2_points: number | null
          points: number | null
          position: number | null
          race_number: number | null
          rider_id: number | null
          stage_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_event_id_class_id_fkey"
            columns: ["event_id", "class_id"]
            isOneToOne: false
            referencedRelation: "event_classes"
            referencedColumns: ["event_id", "class_id"]
          },
          {
            foreignKeyName: "sessions_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "sessions_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      entry_eligibility: {
        Row: {
          class_code: string | null
          entry_id: number | null
          event_id: number | null
          issues: string[] | null
          race_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      navigation_results: {
        Row: {
          actual_start: string | null
          adjustment_s: number | null
          class_id: number | null
          closes_at: string | null
          day_number: number | null
          elapsed_s: number | null
          entry_id: number | null
          event_id: number | null
          finish_at: string | null
          gap_s: number | null
          penalty_s: number | null
          points: number | null
          position: number | null
          race_number: number | null
          result_status: string | null
          rider_id: number | null
          scheduled_start: string | null
          stage_id: number | null
          total_s: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      navigation_splits: {
        Row: {
          checkpoint_code: string | null
          checkpoint_id: number | null
          class_id: number | null
          entry_id: number | null
          event_id: number | null
          passed_at: string | null
          race_number: number | null
          sort_order: number | null
          split_position: number | null
          split_s: number | null
          stage_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "passings_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "passings_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "entry_eligibility"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "passings_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "passings_entry_id_event_id_fkey"
            columns: ["entry_id", "event_id"]
            isOneToOne: false
            referencedRelation: "round_time_results"
            referencedColumns: ["entry_id", "event_id"]
          },
          {
            foreignKeyName: "passings_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "passings_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      round_results: {
        Row: {
          class_id: number | null
          day1_points: number | null
          day2_points: number | null
          entry_id: number | null
          event_id: number | null
          navigation_points: number | null
          position: number | null
          race_number: number | null
          rider_id: number | null
          total_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_event_id_class_id_fkey"
            columns: ["event_id", "class_id"]
            isOneToOne: false
            referencedRelation: "event_classes"
            referencedColumns: ["event_id", "class_id"]
          },
          {
            foreignKeyName: "entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      round_time_results: {
        Row: {
          class_id: number | null
          entry_id: number | null
          event_id: number | null
          gap_s: number | null
          penalty_s: number | null
          position: number | null
          race_number: number | null
          result_status: string | null
          rider_id: number | null
          stage_count: number | null
          stages_classified: number | null
          total_s: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_event_id_class_id_fkey"
            columns: ["event_id", "class_id"]
            isOneToOne: false
            referencedRelation: "event_classes"
            referencedColumns: ["event_id", "class_id"]
          },
          {
            foreignKeyName: "entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      season_standings: {
        Row: {
          class_id: number | null
          drop_applies: boolean | null
          gross_points: number | null
          net_points: number | null
          position: number | null
          position_gross: number | null
          rider_id: number | null
          rounds_held: number | null
          rounds_ridden: number | null
          season_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      session_results: {
        Row: {
          best_lap_s: number | null
          class_id: number | null
          entry_id: number | null
          event_id: number | null
          group_label: string | null
          kind: Database["public"]["Enums"]["session_kind"] | null
          laps: number | null
          number: number | null
          penalty_s: number | null
          points: number | null
          position: number | null
          race_number: number | null
          result_status: string | null
          rider_id: number | null
          session_id: number | null
          stage_id: number | null
          total_s: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_event_id_class_id_fkey"
            columns: ["event_id", "class_id"]
            isOneToOne: false
            referencedRelation: "event_classes"
            referencedColumns: ["event_id", "class_id"]
          },
          {
            foreignKeyName: "sessions_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "navigation_results"
            referencedColumns: ["stage_id", "event_id"]
          },
          {
            foreignKeyName: "sessions_stage_id_event_id_fkey"
            columns: ["stage_id", "event_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "event_id"]
          },
        ]
      }
      team_round_results: {
        Row: {
          classes_scored: number | null
          club_id: number | null
          event_id: number | null
          position: number | null
          team_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      team_season_standings: {
        Row: {
          club_id: number | null
          position: number | null
          rounds_scored: number | null
          season_id: number | null
          team_points: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_staff: {
        Args: {
          p_email: string
          p_event_id: number
          p_role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: string
      }
      build_finals_grid: {
        Args: { p_size?: number; p_stage_id: number }
        Returns: number
      }
      build_qualifying_groups: { Args: { p_stage_id: number }; Returns: number }
      event_staff_members: {
        Args: { p_event_id: number }
        Returns: {
          email: string
          full_name: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }[]
      }
      event_visible: { Args: { p_event_id: number }; Returns: boolean }
      generate_start_list: { Args: { p_stage_id: number }; Returns: number }
      has_event_role: {
        Args: {
          p_event_id: number
          p_roles: Database["public"]["Enums"]["staff_role"][]
        }
        Returns: boolean
      }
      import_entries: {
        Args: { p_event_id: number; p_rows: Json }
        Returns: Json
      }
      import_season_numbers: {
        Args: { p_rows: Json; p_season_id: number }
        Returns: Json
      }
      is_any_organizer: { Args: never; Returns: boolean }
      is_event_staff: { Args: { p_event_id: number }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      publish_results: {
        Args: {
          p_event_id: number
          p_note?: string
          p_protest_minutes?: number
          p_stage_id: number
          p_state: Database["public"]["Enums"]["publication_state"]
        }
        Returns: number
      }
      restart_session: { Args: { p_session_id: number }; Returns: number }
      server_time: { Args: never; Returns: string }
      storage_event_id: { Args: { p_name: string }; Returns: number }
    }
    Enums: {
      dsq_scope: "session" | "stage" | "event" | "event_and_next_round"
      event_kind: "championship_round" | "free"
      event_status: "draft" | "upcoming" | "live" | "finished"
      fact_source: "manual" | "import" | "device"
      license_type: "promo" | "enduro_a" | "enduro_b" | "one_event" | "foreign"
      passing_point: "start" | "checkpoint" | "finish"
      penalty_kind:
        | "time"
        | "time_per_unit"
        | "dsq"
        | "dnf"
        | "no_start"
        | "fine"
      protest_status: "filed" | "upheld" | "rejected" | "withdrawn"
      protest_type:
        | "incident"
        | "result"
        | "navigation"
        | "eligibility"
        | "technical"
      publication_state: "provisional" | "official"
      review_status: "proposed" | "confirmed" | "rejected"
      rider_status: "dns" | "dnf" | "dsq" | "nc"
      session_kind: "qualifying" | "heat"
      staff_role:
        | "organizer"
        | "timekeeper"
        | "gps_judge"
        | "jury"
        | "jury_chair"
      stage_type: "prologue" | "navigation" | "enduro_cross" | "gncc"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      dsq_scope: ["session", "stage", "event", "event_and_next_round"],
      event_kind: ["championship_round", "free"],
      event_status: ["draft", "upcoming", "live", "finished"],
      fact_source: ["manual", "import", "device"],
      license_type: ["promo", "enduro_a", "enduro_b", "one_event", "foreign"],
      passing_point: ["start", "checkpoint", "finish"],
      penalty_kind: ["time", "time_per_unit", "dsq", "dnf", "no_start", "fine"],
      protest_status: ["filed", "upheld", "rejected", "withdrawn"],
      protest_type: [
        "incident",
        "result",
        "navigation",
        "eligibility",
        "technical",
      ],
      publication_state: ["provisional", "official"],
      review_status: ["proposed", "confirmed", "rejected"],
      rider_status: ["dns", "dnf", "dsq", "nc"],
      session_kind: ["qualifying", "heat"],
      staff_role: [
        "organizer",
        "timekeeper",
        "gps_judge",
        "jury",
        "jury_chair",
      ],
      stage_type: ["prologue", "navigation", "enduro_cross", "gncc"],
    },
  },
} as const

