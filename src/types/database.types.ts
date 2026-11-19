// TEMPORARY: Phase 2 tables were added by hand in the generator's format because `pnpm db:types`
// couldn't reach the type endpoint with the current token. Regenerate with `pnpm db:types` and
// delete this comment once the CLI token can generate types.
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
      activity_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["activity_event_type"]
          id: string
          metadata: Json
          owner_id: string
          project_id: string | null
          summary: string
          task_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["activity_event_type"]
          id?: string
          metadata?: Json
          owner_id: string
          project_id?: string | null
          summary: string
          task_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["activity_event_type"]
          id?: string
          metadata?: Json
          owner_id?: string
          project_id?: string | null
          summary?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_summaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          preferences: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          preferences?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          preferences?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_technologies: {
        Row: {
          category: Database["public"]["Enums"]["technology_category"]
          created_at: string
          id: string
          name: string
          notes: string | null
          owner_id: string
          project_id: string
          repository_id: string | null
          updated_at: string
          version: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["technology_category"]
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          project_id: string
          repository_id?: string | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["technology_category"]
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          project_id?: string
          repository_id?: string | null
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_technologies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_technologies_project_owner_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "project_technologies_repository_project_fkey"
            columns: ["repository_id", "project_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          documentation_url: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          priority: Database["public"]["Enums"]["priority_level"] | null
          project_type: Database["public"]["Enums"]["project_type"]
          project_url: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          target_date: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          documentation_url?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          priority?: Database["public"]["Enums"]["priority_level"] | null
          project_type: Database["public"]["Enums"]["project_type"]
          project_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          documentation_url?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          priority?: Database["public"]["Enums"]["priority_level"] | null
          project_type?: Database["public"]["Enums"]["project_type"]
          project_url?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      repositories: {
        Row: {
          created_at: string
          default_branch: string | null
          id: string
          local_path: string | null
          name: string
          notes: string | null
          owner_id: string
          primary_language: string | null
          project_id: string
          provider: Database["public"]["Enums"]["repository_provider"]
          purpose: Database["public"]["Enums"]["repository_purpose"]
          readme_url: string | null
          remote_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_branch?: string | null
          id?: string
          local_path?: string | null
          name: string
          notes?: string | null
          owner_id?: string
          primary_language?: string | null
          project_id: string
          provider?: Database["public"]["Enums"]["repository_provider"]
          purpose?: Database["public"]["Enums"]["repository_purpose"]
          readme_url?: string | null
          remote_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_branch?: string | null
          id?: string
          local_path?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          primary_language?: string | null
          project_id?: string
          provider?: Database["public"]["Enums"]["repository_provider"]
          purpose?: Database["public"]["Enums"]["repository_purpose"]
          readme_url?: string | null
          remote_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repositories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repositories_project_owner_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
    }
    Views: {
      project_summaries: {
        Row: {
          archived_at: string | null
          created_at: string | null
          description: string | null
          id: string | null
          name: string | null
          owner_id: string | null
          priority: Database["public"]["Enums"]["priority_level"] | null
          project_type: Database["public"]["Enums"]["project_type"] | null
          repository_count: number | null
          status: Database["public"]["Enums"]["project_status"] | null
          technology_count: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      activity_event_type:
        | "project.created"
        | "project.updated"
        | "project.archived"
        | "project.restored"
        | "project.deleted"
        | "repository.added"
        | "repository.updated"
        | "repository.removed"
        | "technology.added"
        | "technology.removed"
      priority_level:
        | "urgent"
        | "high"
        | "medium"
        | "low"
      project_status:
        | "active"
        | "on_hold"
        | "maintenance"
        | "completed"
        | "archived"
      project_type:
        | "client"
        | "internal"
        | "personal"
        | "open_source"
        | "learning"
      repository_provider:
        | "github"
        | "bitbucket"
        | "gitlab"
        | "azure_devops"
        | "self_hosted"
        | "other"
      repository_purpose:
        | "frontend"
        | "backend"
        | "mobile"
        | "infrastructure"
        | "docs"
        | "monorepo"
        | "other"
      technology_category:
        | "frontend"
        | "backend"
        | "database"
        | "mobile"
        | "infrastructure"
        | "styling"
        | "testing"
        | "tooling"
        | "other"
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
      activity_event_type: [
        "project.created",
        "project.updated",
        "project.archived",
        "project.restored",
        "project.deleted",
        "repository.added",
        "repository.updated",
        "repository.removed",
        "technology.added",
        "technology.removed",
      ],
      priority_level: [
        "urgent",
        "high",
        "medium",
        "low",
      ],
      project_status: [
        "active",
        "on_hold",
        "maintenance",
        "completed",
        "archived",
      ],
      project_type: [
        "client",
        "internal",
        "personal",
        "open_source",
        "learning",
      ],
      repository_provider: [
        "github",
        "bitbucket",
        "gitlab",
        "azure_devops",
        "self_hosted",
        "other",
      ],
      repository_purpose: [
        "frontend",
        "backend",
        "mobile",
        "infrastructure",
        "docs",
        "monorepo",
        "other",
      ],
      technology_category: [
        "frontend",
        "backend",
        "database",
        "mobile",
        "infrastructure",
        "styling",
        "testing",
        "tooling",
        "other",
      ],
    },
  },
} as const
