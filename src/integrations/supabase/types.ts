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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          kind: string
          org_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          org_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          org_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_investigations: {
        Row: {
          alert_id: string | null
          attack_narrative: string | null
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          incident_id: string | null
          mitre: Json
          model: string | null
          org_id: string
          recommendations: Json
          severity_assessment: string | null
          summary: string
        }
        Insert: {
          alert_id?: string | null
          attack_narrative?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string | null
          mitre?: Json
          model?: string | null
          org_id: string
          recommendations?: Json
          severity_assessment?: string | null
          summary: string
        }
        Update: {
          alert_id?: string | null
          attack_narrative?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string | null
          mitre?: Json
          model?: string | null
          org_id?: string
          recommendations?: Json
          severity_assessment?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_investigations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          meta: Json
          org_id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          meta?: Json
          org_id: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          meta?: Json
          org_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          created_at: string
          feature: string
          id: string
          input_tokens: number
          model: string
          org_id: string
          output_tokens: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          feature: string
          id?: string
          input_tokens?: number
          model?: string
          org_id: string
          output_tokens?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          input_tokens?: number
          model?: string
          org_id?: string
          output_tokens?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_mitre_map: {
        Row: {
          alert_id: string
          confidence: number
          created_at: string
          id: string
          org_id: string
          source: string
          technique_id: string
        }
        Insert: {
          alert_id: string
          confidence?: number
          created_at?: string
          id?: string
          org_id: string
          source?: string
          technique_id: string
        }
        Update: {
          alert_id?: string
          confidence?: number
          created_at?: string
          id?: string
          org_id?: string
          source?: string
          technique_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_mitre_map_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_mitre_map_technique_id_fkey"
            columns: ["technique_id"]
            isOneToOne: false
            referencedRelation: "mitre_techniques"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          entity: string | null
          event_count: number
          event_ids: Json
          id: string
          incident_id: string | null
          notified_at: string | null
          org_id: string
          rule_id: string | null
          rule_name: string
          severity: Database["public"]["Enums"]["event_severity"]
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          entity?: string | null
          event_count?: number
          event_ids?: Json
          id?: string
          incident_id?: string | null
          notified_at?: string | null
          org_id: string
          rule_id?: string | null
          rule_name?: string
          severity?: Database["public"]["Enums"]["event_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          entity?: string | null
          event_count?: number
          event_ids?: Json
          id?: string
          incident_id?: string | null
          notified_at?: string | null
          org_id?: string
          rule_id?: string | null
          rule_name?: string
          severity?: Database["public"]["Enums"]["event_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_incident_fk"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "correlation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          details: Json
          id: string
          ip_address: string | null
          org_id: string | null
          status: string
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          org_id?: string | null
          status?: string
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          org_id?: string | null
          status?: string
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      correlation_rules: {
        Row: {
          conditions: Json
          created_at: string
          description: string
          enabled: boolean
          group_by: string
          id: string
          is_builtin: boolean
          last_triggered_at: string | null
          name: string
          org_id: string
          rule_type: Database["public"]["Enums"]["rule_type"]
          severity: Database["public"]["Enums"]["event_severity"]
          threshold: number
          window_minutes: number
        }
        Insert: {
          conditions?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          group_by?: string
          id?: string
          is_builtin?: boolean
          last_triggered_at?: string | null
          name: string
          org_id: string
          rule_type?: Database["public"]["Enums"]["rule_type"]
          severity?: Database["public"]["Enums"]["event_severity"]
          threshold?: number
          window_minutes?: number
        }
        Update: {
          conditions?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          group_by?: string
          id?: string
          is_builtin?: boolean
          last_triggered_at?: string | null
          name?: string
          org_id?: string
          rule_type?: Database["public"]["Enums"]["rule_type"]
          severity?: Database["public"]["Enums"]["event_severity"]
          threshold?: number
          window_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "correlation_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          body: string
          category: string
          created_at: string
          error: string | null
          id: string
          org_id: string
          recipients: string
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          error?: string | null
          id?: string
          org_id: string
          recipients: string
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          error?: string | null
          id?: string
          org_id?: string
          recipients?: string
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_risk_scores: {
        Row: {
          alert_count: number
          computed_at: string
          entity_type: string
          entity_value: string
          event_count: number
          factors: Json
          id: string
          last_seen: string | null
          level: string
          org_id: string
          score: number
        }
        Insert: {
          alert_count?: number
          computed_at?: string
          entity_type: string
          entity_value: string
          event_count?: number
          factors?: Json
          id?: string
          last_seen?: string | null
          level?: string
          org_id: string
          score?: number
        }
        Update: {
          alert_count?: number
          computed_at?: string
          entity_type?: string
          entity_value?: string
          event_count?: number
          factors?: Json
          id?: string
          last_seen?: string | null
          level?: string
          org_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "entity_risk_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_notes: {
        Row: {
          author_id: string | null
          author_name: string
          body: string
          created_at: string
          id: string
          incident_id: string
          org_id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string
          body: string
          created_at?: string
          id?: string
          incident_id: string
          org_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          incident_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_notes_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_timeline: {
        Row: {
          action: string
          actor_name: string
          created_at: string
          details: Json
          id: string
          incident_id: string
          org_id: string
        }
        Insert: {
          action: string
          actor_name?: string
          created_at?: string
          details?: Json
          id?: string
          incident_id: string
          org_id: string
        }
        Update: {
          action?: string
          actor_name?: string
          created_at?: string
          details?: Json
          id?: string
          incident_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_timeline_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_timeline_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          org_id: string
          reference: string
          severity: Database["public"]["Enums"]["event_severity"]
          status: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          org_id: string
          reference: string
          severity?: Database["public"]["Enums"]["event_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          org_id?: string
          reference?: string
          severity?: Database["public"]["Enums"]["event_severity"]
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          failed_rows: number
          file_name: string
          finished_at: string | null
          format: string
          id: string
          imported_rows: number
          message: string
          org_id: string
          source_id: string | null
          status: Database["public"]["Enums"]["ingestion_status"]
          total_rows: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          failed_rows?: number
          file_name: string
          finished_at?: string | null
          format: string
          id?: string
          imported_rows?: number
          message?: string
          org_id: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["ingestion_status"]
          total_rows?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          failed_rows?: number
          file_name?: string
          finished_at?: string | null
          format?: string
          id?: string
          imported_rows?: number
          message?: string
          org_id?: string
          source_id?: string | null
          status?: Database["public"]["Enums"]["ingestion_status"]
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingestion_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ldap_configs: {
        Row: {
          base_dn: string
          bind_dn: string
          bind_password_set: boolean
          display_name_attribute: string
          email_attribute: string
          enabled: boolean
          group_map_analyst: string
          group_map_org_admin: string
          group_map_viewer: string
          group_search_base: string
          group_search_filter: string
          org_id: string
          server_host: string
          server_port: number
          updated_at: string
          use_ssl: boolean
          use_tls: boolean
          user_search_base: string
          user_search_filter: string
          username_attribute: string
        }
        Insert: {
          base_dn?: string
          bind_dn?: string
          bind_password_set?: boolean
          display_name_attribute?: string
          email_attribute?: string
          enabled?: boolean
          group_map_analyst?: string
          group_map_org_admin?: string
          group_map_viewer?: string
          group_search_base?: string
          group_search_filter?: string
          org_id: string
          server_host?: string
          server_port?: number
          updated_at?: string
          use_ssl?: boolean
          use_tls?: boolean
          user_search_base?: string
          user_search_filter?: string
          username_attribute?: string
        }
        Update: {
          base_dn?: string
          bind_dn?: string
          bind_password_set?: boolean
          display_name_attribute?: string
          email_attribute?: string
          enabled?: boolean
          group_map_analyst?: string
          group_map_org_admin?: string
          group_map_viewer?: string
          group_search_base?: string
          group_search_filter?: string
          org_id?: string
          server_host?: string
          server_port?: number
          updated_at?: string
          use_ssl?: boolean
          use_tls?: boolean
          user_search_base?: string
          user_search_filter?: string
          username_attribute?: string
        }
        Relationships: [
          {
            foreignKeyName: "ldap_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ldap_secrets: {
        Row: {
          bind_password_encrypted: string
          org_id: string
          updated_at: string
        }
        Insert: {
          bind_password_encrypted: string
          org_id: string
          updated_at?: string
        }
        Update: {
          bind_password_encrypted?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ldap_secrets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      license_features: {
        Row: {
          enabled: boolean
          feature_key: string
          id: string
          license_id: string
        }
        Insert: {
          enabled?: boolean
          feature_key: string
          id?: string
          license_id: string
        }
        Update: {
          enabled?: boolean
          feature_key?: string
          id?: string
          license_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_features_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          created_at: string
          customer_name: string | null
          eps_limit: number
          expires_at: string
          grace_days: number
          id: string
          issued_at: string
          key_id: string | null
          last_validated_at: string | null
          license_key: string
          max_sources: number
          max_users: number
          org_id: string
          payload: Json
          plan: Database["public"]["Enums"]["license_plan"]
          retention_days: number
          signature: string
          signature_alg: string
          status: Database["public"]["Enums"]["license_status"]
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          eps_limit?: number
          expires_at: string
          grace_days?: number
          id?: string
          issued_at?: string
          key_id?: string | null
          last_validated_at?: string | null
          license_key: string
          max_sources?: number
          max_users?: number
          org_id: string
          payload?: Json
          plan: Database["public"]["Enums"]["license_plan"]
          retention_days?: number
          signature: string
          signature_alg?: string
          status?: Database["public"]["Enums"]["license_status"]
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          eps_limit?: number
          expires_at?: string
          grace_days?: number
          id?: string
          issued_at?: string
          key_id?: string | null
          last_validated_at?: string | null
          license_key?: string
          max_sources?: number
          max_users?: number
          org_id?: string
          payload?: Json
          plan?: Database["public"]["Enums"]["license_plan"]
          retention_days?: number
          signature?: string
          signature_alg?: string
          status?: Database["public"]["Enums"]["license_status"]
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      log_events: {
        Row: {
          category: string | null
          created_at: string
          device_type: string | null
          event_type: string
          host: string | null
          id: string
          is_demo: boolean
          org_id: string
          parsed_fields: Json
          raw_message: string
          received_at: string
          severity: Database["public"]["Enums"]["event_severity"]
          source_id: string | null
          source_ip: string | null
          source_type: string
          timestamp: string
          user: string | null
          vendor: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          host?: string | null
          id?: string
          is_demo?: boolean
          org_id: string
          parsed_fields?: Json
          raw_message?: string
          received_at?: string
          severity?: Database["public"]["Enums"]["event_severity"]
          source_id?: string | null
          source_ip?: string | null
          source_type?: string
          timestamp?: string
          user?: string | null
          vendor?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          device_type?: string | null
          event_type?: string
          host?: string | null
          id?: string
          is_demo?: boolean
          org_id?: string
          parsed_fields?: Json
          raw_message?: string
          received_at?: string
          severity?: Database["public"]["Enums"]["event_severity"]
          source_id?: string | null
          source_ip?: string | null
          source_type?: string
          timestamp?: string
          user?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      mitre_techniques: {
        Row: {
          description: string
          id: string
          name: string
          tactic: string
          tactic_id: string
          url: string
        }
        Insert: {
          description?: string
          id: string
          name: string
          tactic: string
          tactic_id: string
          url?: string
        }
        Update: {
          description?: string
          id?: string
          name?: string
          tactic?: string
          tactic_id?: string
          url?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          contact_email: string | null
          created_at: string
          eps_limit: number
          id: string
          name: string
          plan: Database["public"]["Enums"]["license_plan"]
          retention_days: number
          slug: string
          status: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          eps_limit?: number
          id?: string
          name: string
          plan?: Database["public"]["Enums"]["license_plan"]
          retention_days?: number
          slug: string
          status?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          eps_limit?: number
          id?: string
          name?: string
          plan?: Database["public"]["Enums"]["license_plan"]
          retention_days?: number
          slug?: string
          status?: string
        }
        Relationships: []
      }
      password_policies: {
        Row: {
          failed_login_limit: number
          inactive_user_days: number
          local_auth_enabled: boolean
          lockout_minutes: number
          min_length: number
          org_id: string
          password_expiry_days: number
          password_history: number
          require_lowercase: boolean
          require_number: boolean
          require_special: boolean
          require_uppercase: boolean
          session_timeout_minutes: number
          updated_at: string
        }
        Insert: {
          failed_login_limit?: number
          inactive_user_days?: number
          local_auth_enabled?: boolean
          lockout_minutes?: number
          min_length?: number
          org_id: string
          password_expiry_days?: number
          password_history?: number
          require_lowercase?: boolean
          require_number?: boolean
          require_special?: boolean
          require_uppercase?: boolean
          session_timeout_minutes?: number
          updated_at?: string
        }
        Update: {
          failed_login_limit?: number
          inactive_user_days?: number
          local_auth_enabled?: boolean
          lockout_minutes?: number
          min_length?: number
          org_id?: string
          password_expiry_days?: number
          password_history?: number
          require_lowercase?: boolean
          require_number?: boolean
          require_special?: boolean
          require_uppercase?: boolean
          session_timeout_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string
          key: string
        }
        Insert: {
          description: string
          key: string
        }
        Update: {
          description?: string
          key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_method: Database["public"]["Enums"]["auth_method"]
          created_at: string
          email: string
          failed_login_count: number
          full_name: string | null
          id: string
          last_login_at: string | null
          locked_until: string | null
          org_id: string | null
          password_changed_at: string
          status: Database["public"]["Enums"]["user_status"]
          username: string
        }
        Insert: {
          auth_method?: Database["public"]["Enums"]["auth_method"]
          created_at?: string
          email: string
          failed_login_count?: number
          full_name?: string | null
          id: string
          last_login_at?: string | null
          locked_until?: string | null
          org_id?: string | null
          password_changed_at?: string
          status?: Database["public"]["Enums"]["user_status"]
          username: string
        }
        Update: {
          auth_method?: Database["public"]["Enums"]["auth_method"]
          created_at?: string
          email?: string
          failed_login_count?: number
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          locked_until?: string | null
          org_id?: string | null
          password_changed_at?: string
          status?: Database["public"]["Enums"]["user_status"]
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          format: string
          generated_by: string | null
          id: string
          name: string
          org_id: string
          params: Json
          report_type: string
          summary: Json
        }
        Insert: {
          created_at?: string
          format?: string
          generated_by?: string | null
          id?: string
          name: string
          org_id: string
          params?: Json
          report_type: string
          summary?: Json
        }
        Update: {
          created_at?: string
          format?: string
          generated_by?: string | null
          id?: string
          name?: string
          org_id?: string
          params?: Json
          report_type?: string
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_fkey"
            columns: ["permission"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      saved_hunts: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          hypothesis: string
          id: string
          name: string
          org_id: string
          query: Json
          technique_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          hypothesis?: string
          id?: string
          name: string
          org_id: string
          query?: Json
          technique_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          hypothesis?: string
          id?: string
          name?: string
          org_id?: string
          query?: Json
          technique_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_hunts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          org_id: string
          owner_id: string
          query: string
          time_range: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          org_id: string
          owner_id: string
          query?: string
          time_range?: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          org_id?: string
          owner_id?: string
          query?: string
          time_range?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      smtp_settings: {
        Row: {
          alert_recipients: string
          daily_report: boolean
          enabled: boolean
          from_address: string
          from_name: string
          host: string
          notify_critical: boolean
          notify_high: boolean
          org_id: string
          password_set: boolean
          port: number
          updated_at: string
          use_tls: boolean
          username: string
          weekly_report: boolean
        }
        Insert: {
          alert_recipients?: string
          daily_report?: boolean
          enabled?: boolean
          from_address?: string
          from_name?: string
          host?: string
          notify_critical?: boolean
          notify_high?: boolean
          org_id: string
          password_set?: boolean
          port?: number
          updated_at?: string
          use_tls?: boolean
          username?: string
          weekly_report?: boolean
        }
        Update: {
          alert_recipients?: string
          daily_report?: boolean
          enabled?: boolean
          from_address?: string
          from_name?: string
          host?: string
          notify_critical?: boolean
          notify_high?: boolean
          org_id?: string
          password_set?: boolean
          port?: number
          updated_at?: string
          use_tls?: boolean
          username?: string
          weekly_report?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "smtp_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      source_stats: {
        Row: {
          eps: number
          event_count: number
          health: string
          last_event_at: string | null
          org_id: string
          source_id: string
          updated_at: string
        }
        Insert: {
          eps?: number
          event_count?: number
          health?: string
          last_event_at?: string | null
          org_id: string
          source_id: string
          updated_at?: string
        }
        Update: {
          eps?: number
          event_count?: number
          health?: string
          last_event_at?: string | null
          org_id?: string
          source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_stats_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_stats_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          api_key_hash: string | null
          api_key_prefix: string | null
          created_at: string
          device_type: string | null
          id: string
          name: string
          org_id: string
          source_ip: string | null
          source_type: string
          status: Database["public"]["Enums"]["source_status"]
          vendor: string | null
        }
        Insert: {
          api_key_hash?: string | null
          api_key_prefix?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          name: string
          org_id: string
          source_ip?: string | null
          source_type: string
          status?: Database["public"]["Enums"]["source_status"]
          vendor?: string | null
        }
        Update: {
          api_key_hash?: string | null
          api_key_prefix?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          name?: string
          org_id?: string
          source_ip?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["source_status"]
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      alert_status:
        | "new"
        | "acknowledged"
        | "in_progress"
        | "resolved"
        | "closed"
        | "false_positive"
      app_role: "super_admin" | "org_admin" | "analyst" | "viewer"
      auth_method: "local" | "ldap"
      event_severity: "critical" | "high" | "medium" | "low" | "info"
      incident_status:
        | "new"
        | "investigating"
        | "contained"
        | "resolved"
        | "closed"
      ingestion_status: "pending" | "running" | "completed" | "failed"
      license_plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE_AI"
      license_status: "active" | "suspended" | "expired" | "revoked"
      rule_type:
        | "threshold"
        | "sequence"
        | "pattern"
        | "anomaly"
        | "correlation"
      source_status: "enabled" | "disabled"
      user_status: "active" | "disabled" | "locked"
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
      alert_status: [
        "new",
        "acknowledged",
        "in_progress",
        "resolved",
        "closed",
        "false_positive",
      ],
      app_role: ["super_admin", "org_admin", "analyst", "viewer"],
      auth_method: ["local", "ldap"],
      event_severity: ["critical", "high", "medium", "low", "info"],
      incident_status: [
        "new",
        "investigating",
        "contained",
        "resolved",
        "closed",
      ],
      ingestion_status: ["pending", "running", "completed", "failed"],
      license_plan: ["STARTER", "PROFESSIONAL", "ENTERPRISE_AI"],
      license_status: ["active", "suspended", "expired", "revoked"],
      rule_type: ["threshold", "sequence", "pattern", "anomaly", "correlation"],
      source_status: ["enabled", "disabled"],
      user_status: ["active", "disabled", "locked"],
    },
  },
} as const
