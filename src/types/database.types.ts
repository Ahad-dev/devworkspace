// TEMPORARY: Phase 2–7 tables were added by hand in the generator's format because `pnpm db:types`
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
      account_secrets: {
        Row: {
          id: string
          owner_id: string
          account_id: string
          label: string
          kind: Database["public"]["Enums"]["account_secret_kind"]
          format_version: number
          ciphertext: string
          iv: string
          value_updated_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          owner_id?: string
          account_id: string
          label: string
          kind?: Database["public"]["Enums"]["account_secret_kind"]
          format_version?: number
          ciphertext: string
          iv: string
          value_updated_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          account_id?: string
          label?: string
          kind?: Database["public"]["Enums"]["account_secret_kind"]
          format_version?: number
          ciphertext?: string
          iv?: string
          value_updated_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_secrets_account_owner_fkey"
            columns: ["account_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "account_secrets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_secrets_vault_owner_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "vault_keys"
            referencedColumns: ["owner_id"]
          },
        ]
      }
      accounts: {
        Row: {
          id: string
          owner_id: string
          platform: string
          label: string | null
          login_identifier: string | null
          login_url: string | null
          two_factor: Database["public"]["Enums"]["account_two_factor"]
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id?: string
          platform: string
          label?: string | null
          login_identifier?: string | null
          login_url?: string | null
          two_factor?: Database["public"]["Enums"]["account_two_factor"]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          platform?: string
          label?: string | null
          login_identifier?: string | null
          login_url?: string | null
          two_factor?: Database["public"]["Enums"]["account_two_factor"]
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_keys: {
        Row: {
          id: string
          owner_id: string
          format_version: number
          kdf_iterations: number
          kdf_salt: string
          master_wrapped_key: string
          master_wrap_iv: string
          recovery_salt: string
          recovery_wrapped_key: string
          recovery_wrap_iv: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id?: string
          format_version?: number
          kdf_iterations: number
          kdf_salt: string
          master_wrapped_key: string
          master_wrap_iv: string
          recovery_salt: string
          recovery_wrapped_key: string
          recovery_wrap_iv: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          format_version?: number
          kdf_iterations?: number
          kdf_salt?: string
          master_wrapped_key?: string
          master_wrap_iv?: string
          recovery_salt?: string
          recovery_wrapped_key?: string
          recovery_wrap_iv?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_keys_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          {
            foreignKeyName: "activity_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
      task_document_links: {
        Row: {
          task_id: string
          document_id: string
          owner_id: string
          created_at: string
        }
        Insert: {
          task_id: string
          document_id: string
          owner_id?: string
          created_at?: string
        }
        Update: {
          task_id?: string
          document_id?: string
          owner_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_document_links_document_owner_fkey"
            columns: ["document_id","owner_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id","owner_id"]
          },
          {
            foreignKeyName: "task_document_links_task_owner_fkey"
            columns: ["task_id","owner_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id","owner_id"]
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
          search_vector: unknown
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
          search_vector?: never
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
          search_vector?: never
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
      command_snippets: {
        Row: {
          id: string
          owner_id: string
          created_at: string
          updated_at: string
          project_id: string | null
          repository_id: string | null
          environment_id: string | null
          title: string
          command_text: string
          description: string | null
          shell: Database["public"]["Enums"]["command_shell"]
          operating_system: Database["public"]["Enums"]["command_os"]
          category: Database["public"]["Enums"]["command_category"]
          prerequisites: string | null
          is_destructive: boolean
          search_vector: unknown
        }
        Insert: {
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          project_id?: string | null
          repository_id?: string | null
          environment_id?: string | null
          title: string
          command_text: string
          description?: string | null
          shell?: Database["public"]["Enums"]["command_shell"]
          operating_system?: Database["public"]["Enums"]["command_os"]
          category?: Database["public"]["Enums"]["command_category"]
          prerequisites?: string | null
          is_destructive?: boolean
          search_vector?: never
        }
        Update: {
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          project_id?: string | null
          repository_id?: string | null
          environment_id?: string | null
          title?: string
          command_text?: string
          description?: string | null
          shell?: Database["public"]["Enums"]["command_shell"]
          operating_system?: Database["public"]["Enums"]["command_os"]
          category?: Database["public"]["Enums"]["command_category"]
          prerequisites?: string | null
          is_destructive?: boolean
          search_vector?: never
        }
        Relationships: [
          {
            foreignKeyName: "command_snippets_environment_project_fkey"
            columns: ["environment_id","project_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id","project_id"]
          },
          {
            foreignKeyName: "command_snippets_project_owner_fkey"
            columns: ["project_id","owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id","owner_id"]
          },
          {
            foreignKeyName: "command_snippets_repository_project_fkey"
            columns: ["repository_id","project_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id","project_id"]
          },
        ]
      }
      document_attachments: {
        Row: {
          id: string
          owner_id: string
          created_at: string
          document_id: string
          storage_path: string
          file_name: string
          mime_type: string
          size_bytes: number
        }
        Insert: {
          id?: string
          owner_id?: string
          created_at?: string
          document_id: string
          storage_path: string
          file_name: string
          mime_type: string
          size_bytes: number
        }
        Update: {
          id?: string
          owner_id?: string
          created_at?: string
          document_id?: string
          storage_path?: string
          file_name?: string
          mime_type?: string
          size_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_attachments_document_owner_fkey"
            columns: ["document_id","owner_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id","owner_id"]
          },
        ]
      }
      documents: {
        Row: {
          id: string
          owner_id: string
          created_at: string
          updated_at: string
          project_id: string | null
          repository_id: string | null
          environment_id: string | null
          title: string
          category: Database["public"]["Enums"]["doc_category"]
          summary: string | null
          content_markdown: string
          archived_at: string | null
          search_vector: unknown
        }
        Insert: {
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          project_id?: string | null
          repository_id?: string | null
          environment_id?: string | null
          title: string
          category?: Database["public"]["Enums"]["doc_category"]
          summary?: string | null
          content_markdown?: string
          archived_at?: string | null
          search_vector?: never
        }
        Update: {
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          project_id?: string | null
          repository_id?: string | null
          environment_id?: string | null
          title?: string
          category?: Database["public"]["Enums"]["doc_category"]
          summary?: string | null
          content_markdown?: string
          archived_at?: string | null
          search_vector?: never
        }
        Relationships: [
          {
            foreignKeyName: "documents_environment_project_fkey"
            columns: ["environment_id","project_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id","project_id"]
          },
          {
            foreignKeyName: "documents_project_owner_fkey"
            columns: ["project_id","owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id","owner_id"]
          },
          {
            foreignKeyName: "documents_repository_project_fkey"
            columns: ["repository_id","project_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id","project_id"]
          },
        ]
      }
      environments: {
        Row: {
          id: string
          owner_id: string
          created_at: string
          updated_at: string
          project_id: string
          name: string
          environment_type: Database["public"]["Enums"]["environment_type"]
          machine_label: string | null
          application_url: string | null
          api_url: string | null
          deployment_provider: string | null
          server_hostname: string | null
          operating_system: string | null
          runtime_versions: Json
          deployment_branch: string | null
          deployment_method: string | null
          status: Database["public"]["Enums"]["environment_status"]
          notes: string | null
          last_reviewed_at: string | null
        }
        Insert: {
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          project_id: string
          name: string
          environment_type: Database["public"]["Enums"]["environment_type"]
          machine_label?: string | null
          application_url?: string | null
          api_url?: string | null
          deployment_provider?: string | null
          server_hostname?: string | null
          operating_system?: string | null
          runtime_versions?: Json
          deployment_branch?: string | null
          deployment_method?: string | null
          status?: Database["public"]["Enums"]["environment_status"]
          notes?: string | null
          last_reviewed_at?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          project_id?: string
          name?: string
          environment_type?: Database["public"]["Enums"]["environment_type"]
          machine_label?: string | null
          application_url?: string | null
          api_url?: string | null
          deployment_provider?: string | null
          server_hostname?: string | null
          operating_system?: string | null
          runtime_versions?: Json
          deployment_branch?: string | null
          deployment_method?: string | null
          status?: Database["public"]["Enums"]["environment_status"]
          notes?: string | null
          last_reviewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "environments_project_owner_fkey"
            columns: ["project_id","owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id","owner_id"]
          },
        ]
      }
      environment_variables: {
        Row: {
          account_secret_id: string | null
          id: string
          owner_id: string
          created_at: string
          updated_at: string
          project_id: string
          environment_id: string
          name: string
          is_required: boolean
          is_sensitive: boolean
          configuration_status: Database["public"]["Enums"]["configuration_status"]
          verification_method: Database["public"]["Enums"]["verification_method"]
          last_verified_at: string | null
          notes: string | null
          secret_reference_id: string | null
        }
        Insert: {
          account_secret_id?: string | null
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          project_id: string
          environment_id: string
          name: string
          is_required?: boolean
          is_sensitive?: boolean
          configuration_status?: Database["public"]["Enums"]["configuration_status"]
          verification_method?: Database["public"]["Enums"]["verification_method"]
          last_verified_at?: string | null
          notes?: string | null
          secret_reference_id?: string | null
        }
        Update: {
          account_secret_id?: string | null
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          project_id?: string
          environment_id?: string
          name?: string
          is_required?: boolean
          is_sensitive?: boolean
          configuration_status?: Database["public"]["Enums"]["configuration_status"]
          verification_method?: Database["public"]["Enums"]["verification_method"]
          last_verified_at?: string | null
          notes?: string | null
          secret_reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "environment_variables_account_secret_owner_fkey"
            columns: ["account_secret_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "account_secrets"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "environment_variables_environment_project_fkey"
            columns: ["environment_id","project_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id","project_id"]
          },
          {
            foreignKeyName: "environment_variables_project_owner_fkey"
            columns: ["project_id","owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id","owner_id"]
          },
          {
            foreignKeyName: "environment_variables_secret_reference_fkey"
            columns: ["secret_reference_id","owner_id"]
            isOneToOne: false
            referencedRelation: "secret_references"
            referencedColumns: ["id","owner_id"]
          },
        ]
      }
      project_services: {
        Row: {
          account_id: string | null
          id: string
          owner_id: string
          created_at: string
          updated_at: string
          project_id: string
          name: string
          category: Database["public"]["Enums"]["service_category"]
          provider: string | null
          purpose: string | null
          dashboard_url: string | null
          documentation_url: string | null
          notes: string | null
        }
        Insert: {
          account_id?: string | null
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          project_id: string
          name: string
          category?: Database["public"]["Enums"]["service_category"]
          provider?: string | null
          purpose?: string | null
          dashboard_url?: string | null
          documentation_url?: string | null
          notes?: string | null
        }
        Update: {
          account_id?: string | null
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          project_id?: string
          name?: string
          category?: Database["public"]["Enums"]["service_category"]
          provider?: string | null
          purpose?: string | null
          dashboard_url?: string | null
          documentation_url?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_services_account_owner_fkey"
            columns: ["account_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "project_services_project_owner_fkey"
            columns: ["project_id","owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id","owner_id"]
          },
        ]
      }
      secret_references: {
        Row: {
          id: string
          owner_id: string
          created_at: string
          updated_at: string
          provider: string
          vault_project_or_workspace: string | null
          vault_path_or_item_id: string
          key_name: string | null
          vault_url: string | null
        }
        Insert: {
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          provider: string
          vault_project_or_workspace?: string | null
          vault_path_or_item_id: string
          key_name?: string | null
          vault_url?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          provider?: string
          vault_project_or_workspace?: string | null
          vault_path_or_item_id?: string
          key_name?: string | null
          vault_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secret_references_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_instances: {
        Row: {
          id: string
          owner_id: string
          created_at: string
          updated_at: string
          project_id: string
          project_service_id: string
          environment_id: string
          resource_name: string | null
          region: string | null
          endpoint_hostname: string | null
          version_or_plan: string | null
          status: Database["public"]["Enums"]["service_instance_status"]
          related_variables: string[]
          notes: string | null
        }
        Insert: {
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          project_id: string
          project_service_id: string
          environment_id: string
          resource_name?: string | null
          region?: string | null
          endpoint_hostname?: string | null
          version_or_plan?: string | null
          status?: Database["public"]["Enums"]["service_instance_status"]
          related_variables?: string[]
          notes?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
          project_id?: string
          project_service_id?: string
          environment_id?: string
          resource_name?: string | null
          region?: string | null
          endpoint_hostname?: string | null
          version_or_plan?: string | null
          status?: Database["public"]["Enums"]["service_instance_status"]
          related_variables?: string[]
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_instances_environment_project_fkey"
            columns: ["environment_id","project_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id","project_id"]
          },
          {
            foreignKeyName: "service_instances_project_owner_fkey"
            columns: ["project_id","owner_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id","owner_id"]
          },
          {
            foreignKeyName: "service_instances_service_project_fkey"
            columns: ["project_service_id","project_id"]
            isOneToOne: false
            referencedRelation: "project_services"
            referencedColumns: ["id","project_id"]
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
            foreignKeyName: "work_sessions_environment_project_fkey"
            columns: ["environment_id", "project_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id", "project_id"]
          },
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
      add_project_service: {
        Args: {
          p_account_id: string | null
          p_category: Database["public"]["Enums"]["service_category"]
          p_environment_ids: string[]
          p_name: string
          p_project_id: string
          p_provider: string | null
        }
        Returns: string
      }
      complete_work_session: {
        Args: {
          p_ended_at?: string
          p_handoff?: Json
          p_session_id: string
          p_update_task_next_action?: boolean
        }
        Returns: string
      }
      dashboard_summary: {
        Args: never
        Returns: {
          active_projects: number
          blocked: number
          environments_needing_review: number
          in_progress: number
          inbox: number
          missing_next_action: number
          overdue: number
          ready: number
          review: number
        }[]
      }
      global_search: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          excerpt: string | null
          id: string
          kind: string
          meta: string | null
          parent_id: string | null
          project_id: string | null
          project_name: string | null
          rank: number
          title: string
        }[]
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
      account_secret_kind: "password" | "api_key" | "token" | "recovery_codes" | "note"
      account_two_factor: "unknown" | "none" | "authenticator_app" | "sms" | "email" | "security_key"
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
        | "environment.created"
        | "environment.updated"
        | "environment.archived"
        | "environment.restored"
        | "environment.reviewed"
        | "environment.deleted"
        | "service.added"
        | "service.updated"
        | "service.removed"
        | "service_instance.added"
        | "service_instance.updated"
        | "service_instance.removed"
        | "variable.added"
        | "variable.updated"
        | "variable.removed"
        | "secret_reference.added"
        | "secret_reference.removed"
        | "document.created"
        | "document.updated"
        | "document.archived"
        | "document.restored"
        | "document.deleted"
        | "attachment.added"
        | "attachment.removed"
        | "command.created"
        | "command.updated"
        | "command.deleted"
        | "account.added"
        | "account.updated"
        | "account.removed"
        | "account_secret.added"
        | "account_secret.updated"
        | "account_secret.removed"
        | "vault.created"
        | "vault.password_changed"
        | "vault.recovery_key_changed"
        | "vault.reset"
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
      command_category: "install" | "development" | "test" | "build" | "database" | "deployment" | "maintenance" | "other"
      command_os: "windows" | "macos" | "linux" | "cross_platform"
      command_shell: "powershell" | "bash" | "zsh" | "cmd" | "other"
      doc_category: "architecture" | "requirements" | "setup" | "api" | "database" | "deployment" | "troubleshooting" | "adr" | "notes" | "general"
      configuration_status: "unknown" | "configured" | "missing" | "not_applicable"
      environment_status: "active" | "inactive" | "needs_review" | "archived"
      environment_type: "local" | "development" | "staging" | "production" | "custom"
      service_category: "database" | "cache" | "hosting" | "storage" | "auth" | "payments" | "email" | "monitoring" | "search" | "queue" | "analytics" | "external_api" | "dns" | "other"
      service_instance_status: "active" | "inactive" | "maintenance" | "unknown"
      verification_method: "manual" | "imported" | "integration"
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
      account_secret_kind: ["password", "api_key", "token", "recovery_codes", "note"],
      account_two_factor: ["unknown", "none", "authenticator_app", "sms", "email", "security_key"],
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
        "environment.created",
        "environment.updated",
        "environment.archived",
        "environment.restored",
        "environment.reviewed",
        "environment.deleted",
        "service.added",
        "service.updated",
        "service.removed",
        "service_instance.added",
        "service_instance.updated",
        "service_instance.removed",
        "variable.added",
        "variable.updated",
        "variable.removed",
        "secret_reference.added",
        "secret_reference.removed",
        "document.created",
        "document.updated",
        "document.archived",
        "document.restored",
        "document.deleted",
        "attachment.added",
        "attachment.removed",
        "command.created",
        "command.updated",
        "command.deleted",
        "account.added",
        "account.updated",
        "account.removed",
        "account_secret.added",
        "account_secret.updated",
        "account_secret.removed",
        "vault.created",
        "vault.password_changed",
        "vault.recovery_key_changed",
        "vault.reset",
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
      command_category: ["install", "development", "test", "build", "database", "deployment", "maintenance", "other"],
      command_os: ["windows", "macos", "linux", "cross_platform"],
      command_shell: ["powershell", "bash", "zsh", "cmd", "other"],
      doc_category: ["architecture", "requirements", "setup", "api", "database", "deployment", "troubleshooting", "adr", "notes", "general"],
      configuration_status: ["unknown", "configured", "missing", "not_applicable"],
      environment_status: ["active", "inactive", "needs_review", "archived"],
      environment_type: ["local", "development", "staging", "production", "custom"],
      service_category: ["database", "cache", "hosting", "storage", "auth", "payments", "email", "monitoring", "search", "queue", "analytics", "external_api", "dns", "other"],
      service_instance_status: ["active", "inactive", "maintenance", "unknown"],
      verification_method: ["manual", "imported", "integration"],
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
