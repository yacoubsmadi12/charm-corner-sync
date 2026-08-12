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
          eps_limit: number
          expires_at: string
          id: string
          issued_at: string
          license_key: string
          max_sources: number
          max_users: number
          org_id: string
          payload: Json
          plan: Database["public"]["Enums"]["license_plan"]
          retention_days: number
          signature: string
          status: Database["public"]["Enums"]["license_status"]
        }
        Insert: {
          created_at?: string
          eps_limit?: number
          expires_at: string
          id?: string
          issued_at?: string
          license_key: string
          max_sources?: number
          max_users?: number
          org_id: string
          payload?: Json
          plan: Database["public"]["Enums"]["license_plan"]
          retention_days?: number
          signature: string
          status?: Database["public"]["Enums"]["license_status"]
        }
        Update: {
          created_at?: string
          eps_limit?: number
          expires_at?: string
          id?: string
          issued_at?: string
          license_key?: string
          max_sources?: number
          max_users?: number
          org_id?: string
          payload?: Json
          plan?: Database["public"]["Enums"]["license_plan"]
          retention_days?: number
          signature?: string
          status?: Database["public"]["Enums"]["license_status"]
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
      app_role: "super_admin" | "org_admin" | "analyst" | "viewer"
      auth_method: "local" | "ldap"
      license_plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE_AI"
      license_status: "active" | "suspended" | "expired" | "revoked"
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
      app_role: ["super_admin", "org_admin", "analyst", "viewer"],
      auth_method: ["local", "ldap"],
      license_plan: ["STARTER", "PROFESSIONAL", "ENTERPRISE_AI"],
      license_status: ["active", "suspended", "expired", "revoked"],
      source_status: ["enabled", "disabled"],
      user_status: ["active", "disabled", "locked"],
    },
  },
} as const
