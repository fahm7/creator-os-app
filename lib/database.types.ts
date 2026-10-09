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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      archive_pieces: {
        Row: {
          content: string
          created_at: string
          creator_id: string
          fetch_note: string | null
          id: string
          source: string
          transcribed: boolean
          url: string | null
        }
        Insert: {
          content: string
          created_at?: string
          creator_id: string
          fetch_note?: string | null
          id?: string
          source: string
          transcribed?: boolean
          url?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          creator_id?: string
          fetch_note?: string | null
          id?: string
          source?: string
          transcribed?: boolean
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "archive_pieces_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          created_at: string
          handle: string | null
          id: string
          language: string | null
          name: string
          niche: string | null
          notes: string | null
          platform: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          handle?: string | null
          id?: string
          language?: string | null
          name: string
          niche?: string | null
          notes?: string | null
          platform?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          handle?: string | null
          id?: string
          language?: string | null
          name?: string
          niche?: string | null
          notes?: string | null
          platform?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ideas: {
        Row: {
          created_at: string
          creator_id: string
          gate_note: string | null
          id: string
          idea: string
          mechanism: Database["public"]["Enums"]["idea_mechanism"] | null
          model: string | null
          needs_verification: boolean
          provider: string | null
          requested_topic: string | null
          shoot_id: string | null
          status: Database["public"]["Enums"]["idea_status"]
          style_read_id: string | null
          updated_at: string
          verdict: Database["public"]["Enums"]["archive_verdict"]
          verify_what: string | null
          why: string | null
          would_shoot: boolean | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          gate_note?: string | null
          id?: string
          idea: string
          mechanism?: Database["public"]["Enums"]["idea_mechanism"] | null
          model?: string | null
          needs_verification?: boolean
          provider?: string | null
          requested_topic?: string | null
          shoot_id?: string | null
          status?: Database["public"]["Enums"]["idea_status"]
          style_read_id?: string | null
          updated_at?: string
          verdict: Database["public"]["Enums"]["archive_verdict"]
          verify_what?: string | null
          why?: string | null
          would_shoot?: boolean | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          gate_note?: string | null
          id?: string
          idea?: string
          mechanism?: Database["public"]["Enums"]["idea_mechanism"] | null
          model?: string | null
          needs_verification?: boolean
          provider?: string | null
          requested_topic?: string | null
          shoot_id?: string | null
          status?: Database["public"]["Enums"]["idea_status"]
          style_read_id?: string | null
          updated_at?: string
          verdict?: Database["public"]["Enums"]["archive_verdict"]
          verify_what?: string | null
          why?: string | null
          would_shoot?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ideas_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_shoot_id_fkey"
            columns: ["shoot_id"]
            isOneToOne: false
            referencedRelation: "shoots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_style_read_id_fkey"
            columns: ["style_read_id"]
            isOneToOne: false
            referencedRelation: "style_reads"
            referencedColumns: ["id"]
          },
        ]
      }
      outlines: {
        Row: {
          close: string | null
          created_at: string
          experience_slot: string | null
          format: string
          hook: string | null
          id: string
          idea_id: string
          model: string | null
          needs_verification: string[]
          points: Json
          provider: string | null
          style_basis: string[]
        }
        Insert: {
          close?: string | null
          created_at?: string
          experience_slot?: string | null
          format: string
          hook?: string | null
          id?: string
          idea_id: string
          model?: string | null
          needs_verification?: string[]
          points?: Json
          provider?: string | null
          style_basis?: string[]
        }
        Update: {
          close?: string | null
          created_at?: string
          experience_slot?: string | null
          format?: string
          hook?: string | null
          id?: string
          idea_id?: string
          model?: string | null
          needs_verification?: string[]
          points?: Json
          provider?: string | null
          style_basis?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "outlines_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          idea_id: string
          note: string | null
          outline_id: string | null
          reaction: Database["public"]["Enums"]["reaction_kind"]
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          idea_id: string
          note?: string | null
          outline_id?: string | null
          reaction: Database["public"]["Enums"]["reaction_kind"]
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          idea_id?: string
          note?: string | null
          outline_id?: string | null
          reaction?: Database["public"]["Enums"]["reaction_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "reactions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_outline_id_fkey"
            columns: ["outline_id"]
            isOneToOne: false
            referencedRelation: "outlines"
            referencedColumns: ["id"]
          },
        ]
      }
      shoots: {
        Row: {
          cancel_reason: string | null
          cancelled: boolean
          created_at: string
          creator_id: string
          id: string
          notes: string | null
          scheduled_on: string
          slots_total: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled?: boolean
          created_at?: string
          creator_id: string
          id?: string
          notes?: string | null
          scheduled_on: string
          slots_total?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled?: boolean
          created_at?: string
          creator_id?: string
          id?: string
          notes?: string | null
          scheduled_on?: string
          slots_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shoots_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      style_choices: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["choice_kind"]
          label: string
          ordinal: number
          rationale: string | null
          selected: boolean
          style_read_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["choice_kind"]
          label: string
          ordinal: number
          rationale?: string | null
          selected?: boolean
          style_read_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["choice_kind"]
          label?: string
          ordinal?: number
          rationale?: string | null
          selected?: boolean
          style_read_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "style_choices_style_read_id_fkey"
            columns: ["style_read_id"]
            isOneToOne: false
            referencedRelation: "style_reads"
            referencedColumns: ["id"]
          },
        ]
      }
      style_patterns: {
        Row: {
          claim: string
          decided_at: string | null
          evidence: string | null
          id: string
          ordinal: number
          status: Database["public"]["Enums"]["pattern_status"]
          style_read_id: string
        }
        Insert: {
          claim: string
          decided_at?: string | null
          evidence?: string | null
          id?: string
          ordinal: number
          status?: Database["public"]["Enums"]["pattern_status"]
          style_read_id: string
        }
        Update: {
          claim?: string
          decided_at?: string | null
          evidence?: string | null
          id?: string
          ordinal?: number
          status?: Database["public"]["Enums"]["pattern_status"]
          style_read_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "style_patterns_style_read_id_fkey"
            columns: ["style_read_id"]
            isOneToOne: false
            referencedRelation: "style_reads"
            referencedColumns: ["id"]
          },
        ]
      }
      style_reads: {
        Row: {
          archive_size: number | null
          created_at: string
          creator_id: string
          id: string
          keywords: string[]
          model: string | null
          niche: string | null
          provider: string | null
          raw: Json | null
          themes: string[]
          thin: boolean
        }
        Insert: {
          archive_size?: number | null
          created_at?: string
          creator_id: string
          id?: string
          keywords?: string[]
          model?: string | null
          niche?: string | null
          provider?: string | null
          raw?: Json | null
          themes?: string[]
          thin?: boolean
        }
        Update: {
          archive_size?: number | null
          created_at?: string
          creator_id?: string
          id?: string
          keywords?: string[]
          model?: string | null
          niche?: string | null
          provider?: string | null
          raw?: Json | null
          themes?: string[]
          thin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "style_reads_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      archive_verdict: "new" | "reframe" | "repeat"
      choice_kind: "keyword" | "niche"
      idea_mechanism: "kipling" | "reframe" | "vertical"
      idea_status: "banked" | "shortlisted" | "shot" | "discarded"
      pattern_status: "pending" | "confirmed" | "rejected"
      reaction_kind: "accept" | "fix" | "reject"
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
      archive_verdict: ["new", "reframe", "repeat"],
      choice_kind: ["keyword", "niche"],
      idea_mechanism: ["kipling", "reframe", "vertical"],
      idea_status: ["banked", "shortlisted", "shot", "discarded"],
      pattern_status: ["pending", "confirmed", "rejected"],
      reaction_kind: ["accept", "fix", "reject"],
    },
  },
} as const
