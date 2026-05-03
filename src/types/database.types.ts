// Database types — db_schema.md DDL 1:1 매핑.
// 단일 truth source: docs/specs/db_schema.md.
// ADR-011: relations 테이블에 name/display_name/real_name 컬럼은 절대 추가 금지.
// PII: birth_date / gender / nickname / email / birth_place 원본은 LLM 페이로드 직렬화 금지
//      (docs/legal/pii_minimization.md).

type ISODate = string;          // 'YYYY-MM-DD'
type ISOTime = string;          // 'HH:mm:ss'
type ISOTimestamp = string;     // ISO 8601 with timezone
type Uuid = string;
type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [k: string]: JsonValue }
  | JsonValue[];

// 6모드 (CLAUDE.md §8 도메인 용어 — 'mode')
type Mode = '일합' | '친구합' | '돈합' | '첫합' | '썸합' | '오래합';

type BirthCalendar = 'solar' | 'lunar';
type BirthTimeKnowledge = 'exact' | 'approximate' | 'unknown';
type Gender = 'M' | 'F';

// LLM 모델 (db_schema.md §5 hapcards.llm_model)
type LlmModel = 'gpt-5o' | 'gpt-5' | 'gpt-5-mini' | 'claude-fallback';

// LLM 비용 추적 provider
type LlmProvider = 'openai' | 'anthropic';

export interface Database {
  public: {
    Tables: {
      // §1 users
      users: {
        Row: {
          user_id: Uuid;
          nickname: string;
          birth_date: ISODate;
          birth_date_calendar: BirthCalendar;
          is_lunar_leap: boolean;
          birth_time_knowledge: BirthTimeKnowledge;
          birth_time: ISOTime | null;
          birth_time_range_from: ISOTime | null;
          birth_time_range_to: ISOTime | null;
          gender: Gender;
          consented_at: ISOTimestamp;
          consented_tos_version: string;
          age_confirmed: boolean;
          first_result_viewed_at: ISOTimestamp | null;
          deletion_requested_at: ISOTimestamp | null;
          created_at: ISOTimestamp;
          updated_at: ISOTimestamp;
        };
        Insert: {
          user_id: Uuid;
          nickname: string;
          birth_date: ISODate;
          birth_date_calendar: BirthCalendar;
          is_lunar_leap?: boolean;
          birth_time_knowledge: BirthTimeKnowledge;
          birth_time?: ISOTime | null;
          birth_time_range_from?: ISOTime | null;
          birth_time_range_to?: ISOTime | null;
          gender: Gender;
          consented_at?: ISOTimestamp;
          consented_tos_version: string;
          age_confirmed?: boolean;
          first_result_viewed_at?: ISOTimestamp | null;
          deletion_requested_at?: ISOTimestamp | null;
        };
        Update: Partial<Database['public']['Tables']['users']['Row']>;
      };

      // §2 user_charts
      user_charts: {
        Row: {
          chart_id: Uuid;
          user_id: Uuid;
          chart_hash: string;
          chart_core: JsonValue;
          theory_profile_version: string;
          created_at: ISOTimestamp;
        };
        Insert: {
          chart_id?: Uuid;
          user_id: Uuid;
          chart_hash: string;
          chart_core: JsonValue;
          theory_profile_version: string;
        };
        Update: Partial<Database['public']['Tables']['user_charts']['Row']>;
      };

      // §3 relations — ADR-011: 별명만, name/display_name 컬럼 금지
      relations: {
        Row: {
          relation_id: Uuid;
          user_id: Uuid;
          nickname: string;
          mode: Mode;
          birth_date: ISODate;
          birth_date_calendar: BirthCalendar;
          is_lunar_leap: boolean;
          birth_time_knowledge: BirthTimeKnowledge;
          birth_time: ISOTime | null;
          birth_longitude: number | null;
          gender: Gender;
          consent_confirmed: boolean;
          is_primary: boolean;
          created_at: ISOTimestamp;
          updated_at: ISOTimestamp;
        };
        Insert: {
          relation_id?: Uuid;
          user_id: Uuid;
          nickname: string;
          mode: Mode;
          birth_date: ISODate;
          birth_date_calendar: BirthCalendar;
          is_lunar_leap?: boolean;
          birth_time_knowledge: BirthTimeKnowledge;
          birth_time?: ISOTime | null;
          birth_longitude?: number | null;
          gender: Gender;
          consent_confirmed?: boolean;
          is_primary?: boolean;
        };
        Update: Partial<Database['public']['Tables']['relations']['Row']>;
      };

      // §4 relation_charts
      relation_charts: {
        Row: {
          chart_id: Uuid;
          relation_id: Uuid;
          user_id: Uuid;
          chart_hash: string;
          chart_core: JsonValue;
          theory_profile_version: string;
          created_at: ISOTimestamp;
        };
        Insert: {
          chart_id?: Uuid;
          relation_id: Uuid;
          user_id: Uuid;
          chart_hash: string;
          chart_core: JsonValue;
          theory_profile_version: string;
        };
        Update: Partial<Database['public']['Tables']['relation_charts']['Row']>;
      };

      // §5 hapcards — ADR-035: compat_score 결정형, LLM 개입 금지
      hapcards: {
        Row: {
          hapcard_id: Uuid;
          user_id: Uuid;
          relation_id: Uuid;
          mode: Mode;
          compat_score: number;
          score_breakdown: JsonValue;
          content: JsonValue;
          prompt_version: string;
          llm_model: LlmModel;
          cache_key: string;
          user_chart_hash: string;
          relation_chart_hash: string;
          archived_at: ISOTimestamp | null;
          version_label: string | null;
          created_at: ISOTimestamp;
        };
        Insert: {
          hapcard_id?: Uuid;
          user_id: Uuid;
          relation_id: Uuid;
          mode: Mode;
          compat_score: number;
          score_breakdown: JsonValue;
          content: JsonValue;
          prompt_version: string;
          llm_model: LlmModel;
          cache_key: string;
          user_chart_hash: string;
          relation_chart_hash: string;
          archived_at?: ISOTimestamp | null;
          version_label?: string | null;
        };
        Update: Partial<Database['public']['Tables']['hapcards']['Row']>;
      };

      // §6 hapcard_replays
      hapcard_replays: {
        Row: {
          replay_id: Uuid;
          hapcard_id: Uuid;
          user_id: Uuid;
          replay_reason: string | null;
          content: JsonValue;
          prompt_version: string;
          llm_model: LlmModel;
          created_at: ISOTimestamp;
        };
        Insert: {
          replay_id?: Uuid;
          hapcard_id: Uuid;
          user_id: Uuid;
          replay_reason?: string | null;
          content: JsonValue;
          prompt_version: string;
          llm_model: LlmModel;
        };
        Update: Partial<Database['public']['Tables']['hapcard_replays']['Row']>;
      };

      // §7 daily_haps
      daily_haps: {
        Row: {
          hap_id: Uuid;
          user_id: Uuid;
          primary_relation_id: Uuid | null;
          target_date: ISODate;
          headline: string;
          headline_reason: string;
          avoid_phrase: string;
          avoid_phrase_reason: string;
          favorable_action: string;
          favorable_action_reason: string;
          source_packet_hash: string;
          reused_from_yesterday: boolean;
          llm_model: LlmModel;
          generated_at: ISOTimestamp;
        };
        Insert: {
          hap_id?: Uuid;
          user_id: Uuid;
          primary_relation_id?: Uuid | null;
          target_date: ISODate;
          headline: string;
          headline_reason: string;
          avoid_phrase: string;
          avoid_phrase_reason: string;
          favorable_action: string;
          favorable_action_reason: string;
          source_packet_hash: string;
          reused_from_yesterday?: boolean;
          llm_model?: LlmModel;
        };
        Update: Partial<Database['public']['Tables']['daily_haps']['Row']>;
      };

      // §8 token_ledger
      token_ledger: {
        Row: {
          ledger_id: Uuid;
          user_id: Uuid;
          delta: number;
          reason: string;
          reference_id: string | null;
          balance_after: number;
          created_at: ISOTimestamp;
        };
        Insert: {
          ledger_id?: Uuid;
          user_id: Uuid;
          delta: number;
          reason: string;
          reference_id?: string | null;
          balance_after: number;
        };
        Update: Partial<Database['public']['Tables']['token_ledger']['Row']>;
      };

      // §9 payments
      payments: {
        Row: {
          payment_id: Uuid;
          user_id: Uuid;
          toss_payment_key: string;
          toss_order_id: string;
          amount_krw: number;
          token_amount: number;
          status: 'pending' | 'confirmed' | 'failed' | 'refunded';
          confirmed_at: ISOTimestamp | null;
          created_at: ISOTimestamp;
        };
        Insert: {
          payment_id?: Uuid;
          user_id: Uuid;
          toss_payment_key: string;
          toss_order_id: string;
          amount_krw: number;
          token_amount: number;
          status: 'pending' | 'confirmed' | 'failed' | 'refunded';
          confirmed_at?: ISOTimestamp | null;
        };
        Update: Partial<Database['public']['Tables']['payments']['Row']>;
      };

      // §10 push_subscriptions
      push_subscriptions: {
        Row: {
          subscription_id: Uuid;
          user_id: Uuid;
          fcm_token: string;
          device_type: 'android' | 'ios' | 'web';
          is_active: boolean;
          created_at: ISOTimestamp;
          updated_at: ISOTimestamp;
        };
        Insert: {
          subscription_id?: Uuid;
          user_id: Uuid;
          fcm_token: string;
          device_type: 'android' | 'ios' | 'web';
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Row']>;
      };

      // §11 notification_optins
      notification_optins: {
        Row: {
          user_id: Uuid;
          daily_hap: boolean;
          hapcard_ready: boolean;
          marketing: boolean;
          updated_at: ISOTimestamp;
        };
        Insert: {
          user_id: Uuid;
          daily_hap?: boolean;
          hapcard_ready?: boolean;
          marketing?: boolean;
        };
        Update: Partial<Database['public']['Tables']['notification_optins']['Row']>;
      };

      // §12 prompt_versions (PK: prompt_name + version)
      prompt_versions: {
        Row: {
          prompt_name: string;
          version: string;
          content: string;
          status: 'active' | 'canary' | 'rolled_back';
          canary_ratio: number | null;
          notes: string | null;
          created_at: ISOTimestamp;
        };
        Insert: {
          prompt_name: string;
          version: string;
          content: string;
          status: 'active' | 'canary' | 'rolled_back';
          canary_ratio?: number | null;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['prompt_versions']['Row']>;
      };

      // §13 knowledge_assets
      knowledge_assets: {
        Row: {
          asset_id: string;
          asset_type: 'classic' | 'concept_dict' | 'modern_translation' | 'safety_rule';
          domain: string | null;
          topic_tags: string[];
          content: JsonValue;
          embedding: number[] | null;
          share_card_url: string | null;
          version: string;
          review_status:
            | 'draft'
            | 'approved_ai_pending_human'
            | 'approved_ai_and_crowd'
            | 'approved_ai_crowd_and_beta'
            | 'deprecated';
          created_at: ISOTimestamp;
          updated_at: ISOTimestamp;
        };
        Insert: {
          asset_id: string;
          asset_type: 'classic' | 'concept_dict' | 'modern_translation' | 'safety_rule';
          domain?: string | null;
          topic_tags?: string[];
          content: JsonValue;
          embedding?: number[] | null;
          share_card_url?: string | null;
          version: string;
          review_status:
            | 'draft'
            | 'approved_ai_pending_human'
            | 'approved_ai_and_crowd'
            | 'approved_ai_crowd_and_beta'
            | 'deprecated';
        };
        Update: Partial<Database['public']['Tables']['knowledge_assets']['Row']>;
      };

      // §14 banned_phrase_hits
      banned_phrase_hits: {
        Row: {
          hit_id: Uuid;
          prompt_version: string;
          phrase_category: string;
          phrase_matched: string;
          hapcard_id: Uuid | null;
          created_at: ISOTimestamp;
        };
        Insert: {
          hit_id?: Uuid;
          prompt_version: string;
          phrase_category: string;
          phrase_matched: string;
          hapcard_id?: Uuid | null;
        };
        Update: Partial<Database['public']['Tables']['banned_phrase_hits']['Row']>;
      };

      // §15 error_events
      error_events: {
        Row: {
          event_id: Uuid;
          user_id: Uuid | null;
          error_code: string;
          chart_hash: string | null;
          prompt_version: string | null;
          context: JsonValue | null;
          stack: string | null;
          created_at: ISOTimestamp;
        };
        Insert: {
          event_id?: Uuid;
          user_id?: Uuid | null;
          error_code: string;
          chart_hash?: string | null;
          prompt_version?: string | null;
          context?: JsonValue | null;
          stack?: string | null;
        };
        Update: Partial<Database['public']['Tables']['error_events']['Row']>;
      };

      // §16 llm_cost_tracking (PK: date + provider + model)
      llm_cost_tracking: {
        Row: {
          date: ISODate;
          provider: LlmProvider;
          model: string;
          total_usd: number;
          call_count: number;
          token_in: number;
          token_out: number;
        };
        Insert: {
          date: ISODate;
          provider: LlmProvider;
          model: string;
          total_usd?: number;
          call_count?: number;
          token_in?: number;
          token_out?: number;
        };
        Update: Partial<Database['public']['Tables']['llm_cost_tracking']['Row']>;
      };

      // §17 anon_requests (PK: ip_hash + bucket_minute)
      anon_requests: {
        Row: {
          ip_hash: string;
          bucket_minute: ISOTimestamp;
          count: number;
        };
        Insert: {
          ip_hash: string;
          bucket_minute: ISOTimestamp;
          count?: number;
        };
        Update: Partial<Database['public']['Tables']['anon_requests']['Row']>;
      };

      // §18 feedback_events
      feedback_events: {
        Row: {
          event_id: Uuid;
          user_id: Uuid;
          target_type: 'hapcard' | 'hapcard_replay' | 'daily_hap' | 'knowledge_asset';
          target_id: string;
          signal: 'thumbs_up' | 'thumbs_down' | 'inspect';
          quality_issue_flag:
            | 'generic'
            | 'vague'
            | 'wrong_context'
            | 'classic_translation'
            | 'other'
            | null;
          quality_issue_note: string | null;
          created_at: ISOTimestamp;
        };
        Insert: {
          event_id?: Uuid;
          user_id: Uuid;
          target_type: 'hapcard' | 'hapcard_replay' | 'daily_hap' | 'knowledge_asset';
          target_id: string;
          signal: 'thumbs_up' | 'thumbs_down' | 'inspect';
          quality_issue_flag?:
            | 'generic'
            | 'vague'
            | 'wrong_context'
            | 'classic_translation'
            | 'other'
            | null;
          quality_issue_note?: string | null;
        };
        Update: Partial<Database['public']['Tables']['feedback_events']['Row']>;
      };

      // §19 deletion_grace — 30일 grace period 함수의 placeholder 슬롯.
      // db_schema.md 0020 마이그레이션은 함수만 정의하지만, 19테이블 카운트 정합성 위해 보존.
      deletion_grace: {
        Row: {
          user_id: Uuid;
          deletion_requested_at: ISOTimestamp;
        };
        Insert: { user_id: Uuid; deletion_requested_at: ISOTimestamp };
        Update: Partial<{ user_id: Uuid; deletion_requested_at: ISOTimestamp }>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      purge_deleted_users: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
}
