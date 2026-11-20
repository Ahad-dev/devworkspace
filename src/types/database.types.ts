// TEMPORARY: Phase 2–4 tables were added by hand in the generator's format because `pnpm db:types`
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
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          owner_id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          owner_id?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          owner_id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_owner_fkey"
            columns: ["task_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string
          depends_on_task_id: string
          owner_id: string
          project_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          depends_on_task_id: string
          owner_id?: string
          project_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          depends_on_task_id?: string
          owner_id?: string
          project_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_fkey"
            columns: ["depends_on_task_id", "project_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "task_dependencies_project_owner_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "task_dependencies_task_fkey"
            columns: ["task_id", "project_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      task_label_links: {
        Row: {
          label_id: string
          owner_id: string
          task_id: string
        }
        Insert: {
          label_id: string
          owner_id?: string
          task_id: string
        }
        Update: {
          label_id?: string
          owner_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_label_links_label_owner_fkey"
            columns: ["label_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "task_labels"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "task_label_links_task_owner_fkey"
            columns: ["task_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      task_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          owner_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_labels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_links: {
        Row: {
          created_at: string
          id: string
          label: string
          owner_id: string
          task_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          owner_id?: string
          task_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          owner_id?: string
          task_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_links_task_owner_fkey"
            columns: ["task_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived_at: string | null
          blocker_details: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          external_reference_url: string | null
          id: string
          next_action: string | null
          owner_id: string
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string
          repository_id: string | null
          sort_order: number
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          blocker_details?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          external_reference_url?: string | null
          id?: string
          next_action?: string | null
          owner_id?: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id: string
          repository_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          blocker_details?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          external_reference_url?: string | null
          id?: string
          next_action?: string | null
          owner_id?: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string
          repository_id?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_project_fkey"
            columns: ["parent_task_id", "project_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "tasks_project_owner_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "tasks_repository_project_fkey"
            columns: ["repository_id", "project_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      work_handoffs: {
        Row: {
          completed_summary: string | null
          created_at: string
          current_state: string | null
          id: string
          next_action: string | null
          blockers: string | null
          owner_id: string
          project_id: string
          related_links: Json
          remaining_work: string | null
          task_id: string
          technical_notes: string | null
          work_session_id: string
        }
        Insert: {
          completed_summary?: string | null
          created_at?: string
          current_state?: string | null
          id?: string
          next_action?: string | null
          blockers?: string | null
          owner_id?: string
          project_id: string
          related_links?: Json
          remaining_work?: string | null
          task_id: string
          technical_notes?: string | null
          work_session_id: string
        }
        Update: {
          completed_summary?: string | null
          created_at?: string
          current_state?: string | null
          id?: string
          next_action?: string | null
          blockers?: string | null
          owner_id?: string
          project_id?: string
          related_links?: Json
          remaining_work?: string | null
          task_id?: string
          technical_notes?: string | null
          work_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_handoffs_project_owner_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "work_handoffs_session_owner_fkey"
            columns: ["work_session_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "work_handoffs_task_project_fkey"
            columns: ["task_id", "project_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      work_session_segments: {
        Row: {
          id: string
          owner_id: string
          segment_ended_at: string | null
          segment_started_at: string
          work_session_id: string
        }
        Insert: {
          id?: string
          owner_id?: string
          segment_ended_at?: string | null
          segment_started_at?: string
          work_session_id: string
        }
        Update: {
          id?: string
          owner_id?: string
          segment_ended_at?: string | null
          segment_started_at?: string
          work_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_session_segments_session_owner_fkey"
            columns: ["work_session_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      work_sessions: {
        Row: {
          branch_name: string | null
          created_at: string
          ended_at: string | null
          environment_id: string | null
          id: string
          notes: string | null
          owner_id: string
          project_id: string
          repository_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          task_id: string | null
          updated_at: string
        }
        Insert: {
          branch_name?: string | null
          created_at?: string
          ended_at?: string | null
          environment_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          project_id: string
          repository_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_name?: string | null
          created_at?: string
          ended_at?: string | null
          environment_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          project_id?: string
          repository_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_project_owner_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "work_sessions_repository_project_fkey"
            columns: ["repository_id", "project_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "work_sessions_task_project_fkey"
            columns: ["task_id", "project_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "project_id"]
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
          done_task_count: number | null
          open_task_count: number | null
          task_count: number | null
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
      work_session_summaries: {
        Row: {
          branch_name: string | null
          closed_seconds: number | null
          ended_at: string | null
          id: string | null
          last_segment_ended_at: string | null
          notes: string | null
          open_segment_started_at: string | null
          owner_id: string | null
          project_id: string | null
          repository_id: string | null
          segment_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["session_status"] | null
          task_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_project_owner_fkey"
            columns: ["project_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "work_sessions_repository_project_fkey"
            columns: ["repository_id", "project_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "work_sessions_task_project_fkey"
            columns: ["task_id", "project_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
    }
    Functions: {
      complete_work_session: {
        Args: {
          p_ended_at?: string
          p_handoff?: Json
          p_session_id: string
          p_update_task_next_action?: boolean
        }
        Returns: string
      }
      pause_work_session: {
        Args: {
          p_ended_at?: string
          p_handoff?: Json
          p_session_id: string
          p_update_task_next_action?: boolean
        }
        Returns: string
      }
      resume_work_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      save_work_handoff: {
        Args: {
          p_handoff: Json
          p_session_id: string
          p_update_task_next_action?: boolean
        }
        Returns: string
      }
      start_work_session: {
        Args: {
          p_branch_name?: string
          p_move_task_to_in_progress?: boolean
          p_notes?: string
          p_repository_id?: string
          p_task_id: string
        }
        Returns: string
      }
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
        | "task.created"
        | "task.updated"
        | "task.status_changed"
        | "task.priority_changed"
        | "task.completed"
        | "task.reopened"
        | "task.archived"
        | "task.restored"
        | "task.deleted"
        | "task.comment_added"
        | "task.dependency_added"
        | "task.dependency_removed"
        | "session.started"
        | "session.paused"
        | "session.resumed"
        | "session.completed"
        | "handoff.saved"
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
      session_status: "active" | "paused" | "completed"
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
      task_status:
        | "inbox"
        | "ready"
        | "in_progress"
        | "blocked"
        | "review"
        | "done"
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
        "task.created",
        "task.updated",
        "task.status_changed",
        "task.priority_changed",
        "task.completed",
        "task.reopened",
        "task.archived",
        "task.restored",
        "task.deleted",
        "task.comment_added",
        "task.dependency_added",
        "task.dependency_removed",
        "session.started",
        "session.paused",
        "session.resumed",
        "session.completed",
        "handoff.saved",
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
      session_status: ["active", "paused", "completed"],
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
      task_status: [
        "inbox",
        "ready",
        "in_progress",
        "blocked",
        "review",
        "done",
      ],
    },
  },
} as const
