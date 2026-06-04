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
      anon_requests: {
        Row: {
          bucket_minute: string
          count: number
          ip_hash: string
        }
        Insert: {
          bucket_minute: string
          count?: number
          ip_hash: string
        }
        Update: {
          bucket_minute?: string
          count?: number
          ip_hash?: string
        }
        Relationships: []
      }
      banned_phrase_hits: {
        Row: {
          created_at: string
          hapcard_id: string | null
          hit_id: string
          phrase_category: string
          phrase_matched: string
          prompt_version: string
        }
        Insert: {
          created_at?: string
          hapcard_id?: string | null
          hit_id?: string
          phrase_category: string
          phrase_matched: string
          prompt_version: string
        }
        Update: {
          created_at?: string
          hapcard_id?: string | null
          hit_id?: string
          phrase_category?: string
          phrase_matched?: string
          prompt_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "banned_phrase_hits_hapcard_id_fkey"
            columns: ["hapcard_id"]
            isOneToOne: false
            referencedRelation: "hapcards"
            referencedColumns: ["hapcard_id"]
          },
        ]
      }
      classics: {
        Row: {
          asset_id: string
          created_at: string
          embedding: string | null
          modern_translation: string
          original_reading: string | null
          original_text: string
          review_status: string
          source_chapter: string
          source_title: string
          topic_tags: string[]
          updated_at: string
          version: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          embedding?: string | null
          modern_translation: string
          original_reading?: string | null
          original_text: string
          review_status: string
          source_chapter: string
          source_title: string
          topic_tags?: string[]
          updated_at?: string
          version: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          embedding?: string | null
          modern_translation?: string
          original_reading?: string | null
          original_text?: string
          review_status?: string
          source_chapter?: string
          source_title?: string
          topic_tags?: string[]
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      daily_haps: {
        Row: {
          avoid_phrase: string
          avoid_phrase_reason: string
          favorable_action: string
          favorable_action_reason: string
          generated_at: string
          hap_id: string
          headline: string
          headline_reason: string
          llm_model: string
          primary_relation_id: string | null
          relation_nickname: string | null
          reused_from_yesterday: boolean
          source_packet_hash: string
          target_date: string
          today_compat_score: number | null
          user_id: string
        }
        Insert: {
          avoid_phrase: string
          avoid_phrase_reason: string
          favorable_action: string
          favorable_action_reason: string
          generated_at?: string
          hap_id?: string
          headline: string
          headline_reason: string
          llm_model?: string
          primary_relation_id?: string | null
          relation_nickname?: string | null
          reused_from_yesterday?: boolean
          source_packet_hash: string
          target_date: string
          today_compat_score?: number | null
          user_id: string
        }
        Update: {
          avoid_phrase?: string
          avoid_phrase_reason?: string
          favorable_action?: string
          favorable_action_reason?: string
          generated_at?: string
          hap_id?: string
          headline?: string
          headline_reason?: string
          llm_model?: string
          primary_relation_id?: string | null
          relation_nickname?: string | null
          reused_from_yesterday?: boolean
          source_packet_hash?: string
          target_date?: string
          today_compat_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_haps_primary_relation_id_fkey"
            columns: ["primary_relation_id"]
            isOneToOne: false
            referencedRelation: "relations"
            referencedColumns: ["relation_id"]
          },
          {
            foreignKeyName: "daily_haps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      error_events: {
        Row: {
          chart_hash: string | null
          context: Json | null
          created_at: string
          error_code: string
          event_id: string
          prompt_version: string | null
          stack: string | null
          user_id: string | null
        }
        Insert: {
          chart_hash?: string | null
          context?: Json | null
          created_at?: string
          error_code: string
          event_id?: string
          prompt_version?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          chart_hash?: string | null
          context?: Json | null
          created_at?: string
          error_code?: string
          event_id?: string
          prompt_version?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      feedback_events: {
        Row: {
          created_at: string
          event_id: string
          quality_issue_flag: string | null
          quality_issue_note: string | null
          signal: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string
          quality_issue_flag?: string | null
          quality_issue_note?: string | null
          signal: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          quality_issue_flag?: string | null
          quality_issue_note?: string | null
          signal?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      legal_consents: {
        Row: {
          age_confirmed: boolean
          auth_user_id: string | null
          claimed_at: string | null
          consent_id: string
          consented_at: string
          created_at: string
          expires_at: string
          flow: string
          privacy_version: string
          provider: string | null
          terms_version: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          age_confirmed?: boolean
          auth_user_id?: string | null
          claimed_at?: string | null
          consent_id?: string
          consented_at?: string
          created_at?: string
          expires_at: string
          flow: string
          privacy_version: string
          provider?: string | null
          terms_version: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          age_confirmed?: boolean
          auth_user_id?: string | null
          claimed_at?: string | null
          consent_id?: string
          consented_at?: string
          created_at?: string
          expires_at?: string
          flow?: string
          privacy_version?: string
          provider?: string | null
          terms_version?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      hapcard_replays: {
        Row: {
          content: Json
          created_at: string
          hapcard_id: string
          jinjin_date: string
          llm_model: string
          prompt_version: string
          replay_id: string
          replay_reason: string | null
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          hapcard_id: string
          jinjin_date: string
          llm_model: string
          prompt_version: string
          replay_id?: string
          replay_reason?: string | null
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          hapcard_id?: string
          jinjin_date?: string
          llm_model?: string
          prompt_version?: string
          replay_id?: string
          replay_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hapcard_replays_hapcard_id_fkey"
            columns: ["hapcard_id"]
            isOneToOne: false
            referencedRelation: "hapcards"
            referencedColumns: ["hapcard_id"]
          },
          {
            foreignKeyName: "hapcard_replays_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      hapcard_share_rewards: {
        Row: {
          awarded_at: string
          channel: string
          hapcard_id: string
          ledger_id: string | null
          reward_date_kst: string
          reward_id: string
          share_id: string
          user_id: string
          webhook_resource_id: string | null
        }
        Insert: {
          awarded_at?: string
          channel: string
          hapcard_id: string
          ledger_id?: string | null
          reward_date_kst?: string
          reward_id?: string
          share_id: string
          user_id: string
          webhook_resource_id?: string | null
        }
        Update: {
          awarded_at?: string
          channel?: string
          hapcard_id?: string
          ledger_id?: string | null
          reward_date_kst?: string
          reward_id?: string
          share_id?: string
          user_id?: string
          webhook_resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hapcard_share_rewards_hapcard_id_fkey"
            columns: ["hapcard_id"]
            isOneToOne: false
            referencedRelation: "hapcards"
            referencedColumns: ["hapcard_id"]
          },
          {
            foreignKeyName: "hapcard_share_rewards_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "token_ledger"
            referencedColumns: ["ledger_id"]
          },
          {
            foreignKeyName: "hapcard_share_rewards_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: true
            referencedRelation: "hapcard_shares"
            referencedColumns: ["share_id"]
          },
          {
            foreignKeyName: "hapcard_share_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      hapcard_shares: {
        Row: {
          channel: string
          completed_at: string | null
          created_at: string
          expires_at: string
          hapcard_id: string
          message_text: string
          range: string
          relation_id: string
          revoked_at: string | null
          share_id: string
          title: string
          token_hash: string
          user_id: string
        }
        Insert: {
          channel: string
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          hapcard_id: string
          message_text: string
          range: string
          relation_id: string
          revoked_at?: string | null
          share_id?: string
          title: string
          token_hash: string
          user_id: string
        }
        Update: {
          channel?: string
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          hapcard_id?: string
          message_text?: string
          range?: string
          relation_id?: string
          revoked_at?: string | null
          share_id?: string
          title?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hapcard_shares_hapcard_id_fkey"
            columns: ["hapcard_id"]
            isOneToOne: false
            referencedRelation: "hapcards"
            referencedColumns: ["hapcard_id"]
          },
          {
            foreignKeyName: "hapcard_shares_relation_id_fkey"
            columns: ["relation_id"]
            isOneToOne: false
            referencedRelation: "relations"
            referencedColumns: ["relation_id"]
          },
          {
            foreignKeyName: "hapcard_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      hapcards: {
        Row: {
          archived_at: string | null
          cache_key: string
          compat_score: number
          content: Json
          created_at: string
          hapcard_id: string
          llm_model: string
          mode: string
          prompt_version: string
          relation_chart_hash: string
          relation_id: string
          score_breakdown: Json
          target_date: string
          user_chart_hash: string
          user_id: string
          version_label: string | null
        }
        Insert: {
          archived_at?: string | null
          cache_key: string
          compat_score: number
          content: Json
          created_at?: string
          hapcard_id?: string
          llm_model: string
          mode: string
          prompt_version: string
          relation_chart_hash: string
          relation_id: string
          score_breakdown: Json
          target_date: string
          user_chart_hash: string
          user_id: string
          version_label?: string | null
        }
        Update: {
          archived_at?: string | null
          cache_key?: string
          compat_score?: number
          content?: Json
          created_at?: string
          hapcard_id?: string
          llm_model?: string
          mode?: string
          prompt_version?: string
          relation_chart_hash?: string
          relation_id?: string
          score_breakdown?: Json
          target_date?: string
          user_chart_hash?: string
          user_id?: string
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hapcards_relation_id_fkey"
            columns: ["relation_id"]
            isOneToOne: false
            referencedRelation: "relations"
            referencedColumns: ["relation_id"]
          },
          {
            foreignKeyName: "hapcards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      knowledge_assets: {
        Row: {
          asset_id: string
          asset_type: string
          content: Json
          created_at: string
          domain: string | null
          embedding: string | null
          review_status: string
          share_card_url: string | null
          topic_tags: string[]
          updated_at: string
          version: string
        }
        Insert: {
          asset_id: string
          asset_type: string
          content: Json
          created_at?: string
          domain?: string | null
          embedding?: string | null
          review_status: string
          share_card_url?: string | null
          topic_tags?: string[]
          updated_at?: string
          version: string
        }
        Update: {
          asset_id?: string
          asset_type?: string
          content?: Json
          created_at?: string
          domain?: string | null
          embedding?: string | null
          review_status?: string
          share_card_url?: string | null
          topic_tags?: string[]
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      llm_cost_tracking: {
        Row: {
          call_count: number
          date: string
          model: string
          provider: string
          token_in: number
          token_out: number
          total_usd: number
        }
        Insert: {
          call_count?: number
          date: string
          model: string
          provider: string
          token_in?: number
          token_out?: number
          total_usd?: number
        }
        Update: {
          call_count?: number
          date?: string
          model?: string
          provider?: string
          token_in?: number
          token_out?: number
          total_usd?: number
        }
        Relationships: []
      }
      notification_optins: {
        Row: {
          daily_hap: boolean
          hapcard_ready: boolean
          marketing: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          daily_hap?: boolean
          hapcard_ready?: boolean
          marketing?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          daily_hap?: boolean
          hapcard_ready?: boolean
          marketing?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_optins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_krw: number
          charge_type: string
          confirmed_at: string | null
          created_at: string
          failure_code: string | null
          failure_message: string | null
          feature_id: string | null
          feature_ref: string | null
          payment_id: string
          product_id: string | null
          receipt_url: string | null
          status: string
          token_amount: number | null
          toss_customer_key: string | null
          toss_order_id: string
          toss_payment_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_krw: number
          charge_type?: string
          confirmed_at?: string | null
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          feature_id?: string | null
          feature_ref?: string | null
          payment_id?: string
          product_id?: string | null
          receipt_url?: string | null
          status: string
          token_amount?: number | null
          toss_customer_key?: string | null
          toss_order_id: string
          toss_payment_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_krw?: number
          charge_type?: string
          confirmed_at?: string | null
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          feature_id?: string | null
          feature_ref?: string | null
          payment_id?: string
          product_id?: string | null
          receipt_url?: string | null
          status?: string
          token_amount?: number | null
          toss_customer_key?: string | null
          toss_order_id?: string
          toss_payment_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      prompt_versions: {
        Row: {
          canary_ratio: number | null
          content: string
          created_at: string
          notes: string | null
          prompt_name: string
          status: string
          version: string
        }
        Insert: {
          canary_ratio?: number | null
          content: string
          created_at?: string
          notes?: string | null
          prompt_name: string
          status: string
          version: string
        }
        Update: {
          canary_ratio?: number | null
          content?: string
          created_at?: string
          notes?: string | null
          prompt_name?: string
          status?: string
          version?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          device_type: string
          fcm_token: string
          is_active: boolean
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_type: string
          fcm_token: string
          is_active?: boolean
          subscription_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_type?: string
          fcm_token?: string
          is_active?: boolean
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      relation_charts: {
        Row: {
          chart_core: Json
          chart_hash: string
          chart_id: string
          created_at: string
          relation_id: string
          theory_profile_version: string
          user_id: string
        }
        Insert: {
          chart_core: Json
          chart_hash: string
          chart_id?: string
          created_at?: string
          relation_id: string
          theory_profile_version: string
          user_id: string
        }
        Update: {
          chart_core?: Json
          chart_hash?: string
          chart_id?: string
          created_at?: string
          relation_id?: string
          theory_profile_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relation_charts_relation_id_fkey"
            columns: ["relation_id"]
            isOneToOne: false
            referencedRelation: "relations"
            referencedColumns: ["relation_id"]
          },
          {
            foreignKeyName: "relation_charts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      relations: {
        Row: {
          birth_date: string
          birth_date_calendar: string
          birth_longitude: number | null
          birth_time: string | null
          birth_time_knowledge: string
          consent_confirmed: boolean
          created_at: string
          gender: string
          is_lunar_leap: boolean
          is_primary: boolean
          mode: string
          nickname: string
          relation_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date: string
          birth_date_calendar: string
          birth_longitude?: number | null
          birth_time?: string | null
          birth_time_knowledge: string
          consent_confirmed?: boolean
          created_at?: string
          gender: string
          is_lunar_leap?: boolean
          is_primary?: boolean
          mode: string
          nickname: string
          relation_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string
          birth_date_calendar?: string
          birth_longitude?: number | null
          birth_time?: string | null
          birth_time_knowledge?: string
          consent_confirmed?: boolean
          created_at?: string
          gender?: string
          is_lunar_leap?: boolean
          is_primary?: boolean
          mode?: string
          nickname?: string
          relation_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      token_ledger: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          ledger_id: string
          reason: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          ledger_id?: string
          reason: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          ledger_id?: string
          reason?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_charts: {
        Row: {
          chart_core: Json
          chart_hash: string
          chart_id: string
          created_at: string
          theory_profile_version: string
          user_id: string
        }
        Insert: {
          chart_core: Json
          chart_hash: string
          chart_id?: string
          created_at?: string
          theory_profile_version: string
          user_id: string
        }
        Update: {
          chart_core?: Json
          chart_hash?: string
          chart_id?: string
          created_at?: string
          theory_profile_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_charts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          age_confirmed: boolean
          birth_date: string
          birth_date_calendar: string
          birth_time: string | null
          birth_time_knowledge: string
          birth_time_range_from: string | null
          birth_time_range_to: string | null
          consented_at: string
          consented_privacy_version: string
          consented_tos_version: string
          created_at: string
          deletion_requested_at: string | null
          first_result_viewed_at: string | null
          gender: string
          is_lunar_leap: boolean
          nickname: string
          updated_at: string
          user_id: string
        }
        Insert: {
          age_confirmed?: boolean
          birth_date: string
          birth_date_calendar: string
          birth_time?: string | null
          birth_time_knowledge: string
          birth_time_range_from?: string | null
          birth_time_range_to?: string | null
          consented_at?: string
          consented_privacy_version: string
          consented_tos_version: string
          created_at?: string
          deletion_requested_at?: string | null
          first_result_viewed_at?: string | null
          gender: string
          is_lunar_leap?: boolean
          nickname: string
          updated_at?: string
          user_id: string
        }
        Update: {
          age_confirmed?: boolean
          birth_date?: string
          birth_date_calendar?: string
          birth_time?: string | null
          birth_time_knowledge?: string
          birth_time_range_from?: string | null
          birth_time_range_to?: string | null
          consented_at?: string
          consented_privacy_version?: string
          consented_tos_version?: string
          created_at?: string
          deletion_requested_at?: string | null
          first_result_viewed_at?: string | null
          gender?: string
          is_lunar_leap?: boolean
          nickname?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_feature_payment: {
        Args: {
          p_amount_krw: number
          p_confirmed_at?: string | null
          p_feature_id: string
          p_feature_ref: string
          p_receipt_url?: string | null
          p_toss_order_id: string
          p_toss_payment_key: string
          uid: string
        }
        Returns: string
      }
      award_hapcard_share_reward: {
        Args: {
          p_channel: string
          p_share_id: string
          p_webhook_resource_id?: string | null
        }
        Returns: Json
      }
      award_free_talisman_session_rewards: {
        Args: {
          p_auth_created_at?: string | null
          p_policy_effective_at?: string
          uid: string
        }
        Returns: Json
      }
      deduct_tokens: {
        Args: { delta: number; reason: string; ref?: string; uid: string }
        Returns: number
      }
      deduct_tokens_once: {
        Args: { delta: number; reason: string; ref?: string; uid: string }
        Returns: Json
      }
      purge_deleted_users: { Args: never; Returns: undefined }
      refund_tokens: {
        Args: { delta: number; reason: string; ref?: string; uid: string }
        Returns: number
      }
      refund_tokens_once: {
        Args: { delta: number; reason: string; ref?: string; uid: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
