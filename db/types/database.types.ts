export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      collections: {
        Row: {
          id: string
          contract_address: string
          name: string
          token_type: 'ERC721' | 'ERC1155'
          total_supply: number | null
          verified: boolean
          last_refresh_at: string | null
          refresh_cooldown_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contract_address: string
          name: string
          token_type: 'ERC721' | 'ERC1155'
          total_supply?: number | null
          verified?: boolean
          last_refresh_at?: string | null
          refresh_cooldown_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contract_address?: string
          name?: string
          token_type?: 'ERC721' | 'ERC1155'
          total_supply?: number | null
          verified?: boolean
          last_refresh_at?: string | null
          refresh_cooldown_until?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      fc_users: {
        Row: {
          id: string
          fid: number
          username: string
          display_name: string
          pfp_url: string
          custody_address: string
          verified_addresses: Json
          follower_count: number
          following_count: number
          power_badge: boolean
          score: number
          profile: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          fid: number
          username: string
          display_name: string
          pfp_url: string
          custody_address: string
          verified_addresses: Json
          follower_count: number
          following_count: number
          power_badge: boolean
          score: number
          profile: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          fid?: number
          username?: string
          display_name?: string
          pfp_url?: string
          custody_address?: string
          verified_addresses?: Json
          follower_count?: number
          following_count?: number
          power_badge?: boolean
          score?: number
          profile?: Json
          created_at?: string
          updated_at?: string
        }
      }
      nfts: {
        Row: {
          id: string
          collection_id: string
          token_id: string
          title: string | null
          description: string | null
          image_url: string | null
          thumbnail_url: string | null
          metadata: Json | null
          attributes: Json | null
          media: Json | null
          owner_address: string | null
          last_owner_check_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          collection_id: string
          token_id: string
          title?: string | null
          description?: string | null
          image_url?: string | null
          thumbnail_url?: string | null
          metadata?: Json | null
          attributes?: Json | null
          media?: Json | null
          owner_address?: string | null
          last_owner_check_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          collection_id?: string
          token_id?: string
          title?: string | null
          description?: string | null
          image_url?: string | null
          thumbnail_url?: string | null
          metadata?: Json | null
          attributes?: Json | null
          media?: Json | null
          owner_address?: string | null
          last_owner_check_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      collection_traits: {
        Row: {
          id: string
          collection_id: string
          trait_type: string
          trait_value: string
          token_ids: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          collection_id: string
          trait_type: string
          trait_value: string
          token_ids: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          collection_id?: string
          trait_type?: string
          trait_value?: string
          token_ids?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      user_nft_cache: {
        Row: {
          id: string
          cache_key: string
          wallet_address: string
          contracts: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cache_key: string
          wallet_address: string
          contracts?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cache_key?: string
          wallet_address?: string
          contracts?: Json
          created_at?: string
          updated_at?: string
        }
      }
      nft_ownership: {
        Row: {
          id: string
          collection_id: string
          token_id: string
          owner_address: string
          last_verified_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          collection_id: string
          token_id: string
          owner_address: string
          last_verified_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          collection_id?: string
          token_id?: string
          owner_address?: string
          last_verified_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      user_collections: {
        Row: {
          id: string
          user_address: string
          collection_id: string
          token_count: number
          last_updated_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_address: string
          collection_id: string
          token_count?: number
          last_updated_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_address?: string
          collection_id?: string
          token_count?: number
          last_updated_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      wallet_collection_mapping: {
        Row: {
          id: string
          wallet_address: string
          collection_address: string
          token_count: number
          last_owned_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          wallet_address: string
          collection_address: string
          token_count?: number
          last_owned_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          wallet_address?: string
          collection_address?: string
          token_count?: number
          last_owned_at?: string
          created_at?: string
          updated_at?: string
        }
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
  }
} 