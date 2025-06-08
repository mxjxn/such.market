
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
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
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
      collection_traits: {
        Row: {
          collection_id: string | null
          created_at: string | null
          id: string
          token_ids: string[]
          trait_type: string
          trait_value: string
          updated_at: string | null
        }
        Insert: {
          collection_id?: string | null
          created_at?: string | null
          id?: string
          token_ids: string[]
          trait_type: string
          trait_value: string
          updated_at?: string | null
        }
        Update: {
          collection_id?: string | null
          created_at?: string | null
          id?: string
          token_ids?: string[]
          trait_type?: string
          trait_value?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_traits_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          contract_address: string
          created_at: string | null
          id: string
          last_refresh_at: string | null
          name: string
          refresh_cooldown_until: string | null
          token_type: string
          total_supply: number | null
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          contract_address: string
          created_at?: string | null
          id?: string
          last_refresh_at?: string | null
          name: string
          refresh_cooldown_until?: string | null
          token_type: string
          total_supply?: number | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          contract_address?: string
          created_at?: string | null
          id?: string
          last_refresh_at?: string | null
          name?: string
          refresh_cooldown_until?: string | null
          token_type?: string
          total_supply?: number | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      nfts: {
        Row: {
          attributes: Json | null
          collection_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          last_owner_check_at: string | null
          media: Json | null
          metadata: Json | null
          owner_address: string | null
          thumbnail_url: string | null
          title: string | null
          token_id: string
          updated_at: string | null
        }
        Insert: {
          attributes?: Json | null
          collection_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          last_owner_check_at?: string | null
          media?: Json | null
          metadata?: Json | null
          owner_address?: string | null
          thumbnail_url?: string | null
          title?: string | null
          token_id: string
          updated_at?: string | null
        }
        Update: {
          attributes?: Json | null
          collection_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          last_owner_check_at?: string | null
          media?: Json | null
          metadata?: Json | null
          owner_address?: string | null
          thumbnail_url?: string | null
          title?: string | null
          token_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfts_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
