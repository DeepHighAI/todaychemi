// 마이그레이션 DDL 계약 명세 — db_schema.md §0-§10 (0001~0010)
// 이 파일은 tests/db/migrations.contract.test.ts 가 읽는 단일 truth source.
// 0011~0020 항목은 다음 세션에서 추가.
// C-7 미룸: RLS 술어 의미, SQL 문법 유효성, FK cascade 방향은 여기서 검증 안 함.

export type ExtensionSpec = {
  index: number;
  file: string;
  kind: 'extensions';
  extensions: string[];
};

export type CheckEnum = { col: string; values: string[] };
export type ForeignKey = { col: string; refs: string };
export type RlsSpec = { enabled: true; policies: string[] };

export type TableSpec = {
  index: number;
  file: string;
  kind: 'table';
  tableName: string;
  columns: string[];
  checkEnums: CheckEnum[];
  foreignKeys: ForeignKey[];
  rls: RlsSpec;
  cronJobs?: string[];
};

export type FunctionSpec = {
  index: number;
  file: string;
  kind: 'function';
  functionName: string;
  cronJobs?: string[];
};

export type DmlSpec = {
  index: number;
  file: string;
  kind: 'dml';
  description: string;
};

export type MigrationSpec = ExtensionSpec | TableSpec | FunctionSpec | DmlSpec;

export const MIGRATIONS_MANIFEST: MigrationSpec[] = [
  // §0 확장
  {
    index: 1,
    file: '0001_extensions.sql',
    kind: 'extensions',
    extensions: ['pgcrypto', 'vector', 'pg_cron'],
  },

  // §1 users — ADR-011: 별명만, 실명 수집 금지
  {
    index: 2,
    file: '0002_users.sql',
    kind: 'table',
    tableName: 'users',
    columns: [
      'user_id',
      'nickname',
      'birth_date',
      'birth_date_calendar',
      'is_lunar_leap',
      'birth_time_knowledge',
      'birth_time',
      'birth_time_range_from',
      'birth_time_range_to',
      'gender',
      'consented_at',
      'consented_tos_version',
      'consented_privacy_version',
      'age_confirmed',
      'first_result_viewed_at',
      'deletion_requested_at',
      'created_at',
      'updated_at',
    ],
    checkEnums: [
      { col: 'birth_date_calendar', values: ['solar', 'lunar'] },
      { col: 'birth_time_knowledge', values: ['exact', 'approximate', 'unknown'] },
      { col: 'gender', values: ['M', 'F'] },
    ],
    foreignKeys: [{ col: 'user_id', refs: 'auth.users' }],
    rls: {
      enabled: true,
      policies: ['users_self_read', 'users_self_insert', 'users_self_update'],
    },
  },

  // §2 user_charts
  {
    index: 3,
    file: '0003_user_charts.sql',
    kind: 'table',
    tableName: 'user_charts',
    columns: [
      'chart_id',
      'user_id',
      'chart_hash',
      'chart_core',
      'theory_profile_version',
      'created_at',
    ],
    checkEnums: [],
    foreignKeys: [{ col: 'user_id', refs: 'public.users' }],
    rls: { enabled: true, policies: ['user_charts_self'] },
  },

  // §3 relations — ADR-011: 별명만, name/display_name 컬럼 금지
  {
    index: 4,
    file: '0004_relations.sql',
    kind: 'table',
    tableName: 'relations',
    columns: [
      'relation_id',
      'user_id',
      'nickname',
      'mode',
      'birth_date',
      'birth_date_calendar',
      'is_lunar_leap',
      'birth_time_knowledge',
      'birth_time',
      'birth_longitude',
      'gender',
      'consent_confirmed',
      'is_primary',
      'created_at',
      'updated_at',
    ],
    checkEnums: [
      { col: 'mode', values: ['일합', '친구합', '돈합', '첫합', '썸합', '오래합'] },
      { col: 'birth_date_calendar', values: ['solar', 'lunar'] },
      { col: 'birth_time_knowledge', values: ['exact', 'approximate', 'unknown'] },
      { col: 'gender', values: ['M', 'F'] },
    ],
    foreignKeys: [{ col: 'user_id', refs: 'public.users' }],
    rls: { enabled: true, policies: ['relations_own'] },
  },

  // §4 relation_charts
  {
    index: 5,
    file: '0005_relation_charts.sql',
    kind: 'table',
    tableName: 'relation_charts',
    columns: [
      'chart_id',
      'relation_id',
      'user_id',
      'chart_hash',
      'chart_core',
      'theory_profile_version',
      'created_at',
    ],
    checkEnums: [],
    foreignKeys: [
      { col: 'relation_id', refs: 'public.relations' },
      { col: 'user_id', refs: 'public.users' },
    ],
    rls: { enabled: true, policies: ['relation_charts_own'] },
  },

  // §5 hapcards — ADR-035: compat_score 결정형, LLM 개입 금지
  {
    index: 6,
    file: '0006_hapcards.sql',
    kind: 'table',
    tableName: 'hapcards',
    columns: [
      'hapcard_id',
      'user_id',
      'relation_id',
      'mode',
      'compat_score',
      'score_breakdown',
      'content',
      'prompt_version',
      'llm_model',
      'cache_key',
      'user_chart_hash',
      'relation_chart_hash',
      'archived_at',
      'version_label',
      'created_at',
    ],
    checkEnums: [
      { col: 'mode', values: ['일합', '친구합', '돈합', '첫합', '썸합', '오래합'] },
      { col: 'llm_model', values: ['gpt-5o', 'gpt-5', 'gpt-5-mini', 'claude-fallback'] },
    ],
    foreignKeys: [
      { col: 'user_id', refs: 'public.users' },
      { col: 'relation_id', refs: 'public.relations' },
    ],
    rls: { enabled: true, policies: ['hapcards_own'] },
  },

  // §6 hapcard_replays — ADR-015: 재해석 시 명리 근거 항상 표시
  {
    index: 7,
    file: '0007_hapcard_replays.sql',
    kind: 'table',
    tableName: 'hapcard_replays',
    columns: [
      'replay_id',
      'hapcard_id',
      'user_id',
      'replay_reason',
      'content',
      'prompt_version',
      'llm_model',
      'created_at',
    ],
    checkEnums: [],
    foreignKeys: [
      { col: 'hapcard_id', refs: 'public.hapcards' },
      { col: 'user_id', refs: 'public.users' },
    ],
    rls: { enabled: true, policies: ['replays_own'] },
  },

  // §7 daily_haps — pg_cron 자동 삭제 포함
  {
    index: 8,
    file: '0008_daily_haps.sql',
    kind: 'table',
    tableName: 'daily_haps',
    columns: [
      'hap_id',
      'user_id',
      'primary_relation_id',
      'target_date',
      'headline',
      'headline_reason',
      'avoid_phrase',
      'avoid_phrase_reason',
      'favorable_action',
      'favorable_action_reason',
      'source_packet_hash',
      'reused_from_yesterday',
      'llm_model',
      'generated_at',
    ],
    checkEnums: [],
    foreignKeys: [
      { col: 'user_id', refs: 'public.users' },
      { col: 'primary_relation_id', refs: 'public.relations' },
    ],
    rls: { enabled: true, policies: ['daily_haps_own'] },
    cronJobs: ['delete-old-daily-haps'],
  },

  // §8 token_ledger
  {
    index: 9,
    file: '0009_token_ledger.sql',
    kind: 'table',
    tableName: 'token_ledger',
    columns: ['ledger_id', 'user_id', 'delta', 'reason', 'reference_id', 'balance_after', 'created_at'],
    checkEnums: [],
    foreignKeys: [{ col: 'user_id', refs: 'public.users' }],
    rls: { enabled: true, policies: ['ledger_own_read'] },
  },

  // §9 payments — 토스페이먼츠 Phase 1
  {
    index: 10,
    file: '0010_payments.sql',
    kind: 'table',
    tableName: 'payments',
    columns: [
      'payment_id',
      'user_id',
      'toss_payment_key',
      'toss_order_id',
      'amount_krw',
      'token_amount',
      'status',
      'confirmed_at',
      'created_at',
    ],
    checkEnums: [{ col: 'status', values: ['pending', 'confirmed', 'failed', 'refunded'] }],
    foreignKeys: [{ col: 'user_id', refs: 'public.users' }],
    rls: { enabled: true, policies: ['payments_own_read'] },
  },

  // §10 push_subscriptions — FCM 푸시 구독
  {
    index: 11,
    file: '0011_push_subscriptions.sql',
    kind: 'table',
    tableName: 'push_subscriptions',
    columns: [
      'subscription_id',
      'user_id',
      'fcm_token',
      'device_type',
      'is_active',
      'created_at',
      'updated_at',
    ],
    checkEnums: [{ col: 'device_type', values: ['android', 'ios', 'web'] }],
    foreignKeys: [{ col: 'user_id', refs: 'public.users' }],
    rls: { enabled: true, policies: ['push_subs_own'] },
  },

  // §11 notification_optins — 알림 수신 동의
  {
    index: 12,
    file: '0012_notification_optins.sql',
    kind: 'table',
    tableName: 'notification_optins',
    columns: ['user_id', 'daily_hap', 'hapcard_ready', 'marketing', 'updated_at'],
    checkEnums: [],
    foreignKeys: [{ col: 'user_id', refs: 'public.users' }],
    rls: { enabled: true, policies: ['notif_optins_own'] },
  },

  // §12 prompt_versions — 프롬프트 카나리 배포 관리
  {
    index: 13,
    file: '0013_prompt_versions.sql',
    kind: 'table',
    tableName: 'prompt_versions',
    columns: ['prompt_name', 'version', 'content', 'status', 'canary_ratio', 'notes', 'created_at'],
    checkEnums: [{ col: 'status', values: ['active', 'canary', 'rolled_back'] }],
    foreignKeys: [],
    rls: { enabled: true, policies: ['prompt_versions_public_read'] },
  },

  // §13 knowledge_assets — RAG 자산
  {
    index: 14,
    file: '0014_knowledge_assets.sql',
    kind: 'table',
    tableName: 'knowledge_assets',
    columns: [
      'asset_id',
      'asset_type',
      'domain',
      'topic_tags',
      'content',
      'embedding',
      'share_card_url',
      'version',
      'review_status',
      'created_at',
      'updated_at',
    ],
    checkEnums: [
      { col: 'asset_type', values: ['classic', 'concept_dict', 'modern_translation', 'safety_rule'] },
      {
        col: 'review_status',
        values: [
          'draft',
          'approved_ai_pending_human',
          'approved_ai_and_crowd',
          'approved_ai_crowd_and_beta',
          'deprecated',
        ],
      },
    ],
    foreignKeys: [],
    rls: { enabled: true, policies: ['knowledge_assets_public_read'] },
  },

  // §14 banned_phrase_hits — 금지어 감지 이벤트 로그 (service_role 전용)
  {
    index: 15,
    file: '0015_banned_phrase_hits.sql',
    kind: 'table',
    tableName: 'banned_phrase_hits',
    columns: [
      'hit_id',
      'prompt_version',
      'phrase_category',
      'phrase_matched',
      'hapcard_id',
      'created_at',
    ],
    checkEnums: [],
    foreignKeys: [],
    rls: { enabled: true, policies: [] },
  },

  // §15 error_events — 에러 이벤트 로그 (service_role 전용)
  {
    index: 16,
    file: '0016_error_events.sql',
    kind: 'table',
    tableName: 'error_events',
    columns: ['event_id', 'user_id', 'error_code', 'chart_hash', 'prompt_version', 'context', 'stack', 'created_at'],
    checkEnums: [],
    foreignKeys: [],
    rls: { enabled: true, policies: [] },
  },

  // §16 llm_cost_tracking — LLM 비용 추적 (service_role 전용)
  {
    index: 17,
    file: '0017_llm_cost_tracking.sql',
    kind: 'table',
    tableName: 'llm_cost_tracking',
    columns: ['date', 'provider', 'model', 'total_usd', 'call_count', 'token_in', 'token_out'],
    checkEnums: [{ col: 'provider', values: ['openai', 'anthropic'] }],
    foreignKeys: [],
    rls: { enabled: true, policies: [] },
  },

  // §17 anon_requests — 비회원 IP 레이트 리밋 버킷 (service_role 전용)
  {
    index: 18,
    file: '0018_anon_requests.sql',
    kind: 'table',
    tableName: 'anon_requests',
    columns: ['ip_hash', 'bucket_minute', 'count'],
    checkEnums: [],
    foreignKeys: [],
    rls: { enabled: true, policies: [] },
    cronJobs: ['cleanup-anon-requests'],
  },

  // §18 feedback_events — 유저 피드백
  {
    index: 19,
    file: '0019_feedback_events.sql',
    kind: 'table',
    tableName: 'feedback_events',
    columns: [
      'event_id',
      'user_id',
      'target_type',
      'target_id',
      'signal',
      'quality_issue_flag',
      'quality_issue_note',
      'created_at',
    ],
    checkEnums: [
      { col: 'target_type', values: ['hapcard', 'hapcard_replay', 'daily_hap', 'knowledge_asset'] },
      { col: 'signal', values: ['thumbs_up', 'thumbs_down', 'inspect'] },
      { col: 'quality_issue_flag', values: ['generic', 'vague', 'wrong_context', 'classic_translation', 'other'] },
    ],
    foreignKeys: [{ col: 'user_id', refs: 'public.users' }],
    rls: { enabled: true, policies: ['feedback_own_insert', 'feedback_own_read'] },
  },

  // §18 삭제 Grace Period 함수
  {
    index: 20,
    file: '0020_deletion_grace.sql',
    kind: 'function',
    functionName: 'purge_deleted_users',
    cronJobs: ['purge-deleted-users'],
  },

  // §19 classics — RAG 고전 인용 (pgvector HNSW, F4 Q4)
  {
    index: 21,
    file: '0021_classics.sql',
    kind: 'table',
    tableName: 'classics',
    columns: [
      'asset_id',
      'source_title',
      'source_chapter',
      'original_text',
      'original_reading',
      'modern_translation',
      'topic_tags',
      'embedding',
      'version',
      'review_status',
      'created_at',
      'updated_at',
    ],
    checkEnums: [
      {
        col: 'review_status',
        values: [
          'draft',
          'approved_ai_pending_human',
          'approved_ai_and_crowd',
          'approved_ai_crowd_and_beta',
          'deprecated',
        ],
      },
    ],
    foreignKeys: [],
    rls: { enabled: true, policies: ['classics_public_read'] },
  },

  // §24 prompt v0.2 rolled_back — 단발성 DML (파일 존재 회귀)
  {
    index: 24,
    file: '0024_prompt_v0_3_rollback.sql',
    kind: 'dml',
    description: 'v0.2 prompt_versions status → rolled_back',
  },

  // §25 hapcard_score_snapshots — change_score 기준점 (ADR-036)
  {
    index: 25,
    file: '0025_hapcard_score_snapshots.sql',
    kind: 'table',
    tableName: 'hapcard_score_snapshots',
    columns: [
      'user_id',
      'relation_id',
      'mode',
      'scoring_version',
      'prompt_version',
      'target_date',
      'compat_score',
      'score_breakdown',
      'created_at',
    ],
    checkEnums: [
      { col: 'mode', values: ['일합', '친구합', '돈합', '첫합', '썸합', '오래합'] },
    ],
    foreignKeys: [
      { col: 'user_id', refs: 'auth.users' },
      { col: 'relation_id', refs: 'public.relations' },
    ],
    rls: { enabled: true, policies: ['user owns snapshots'] },
  },

  // §26 whatif_results — S-08 마이플레이 6종 LLM 캐시
  {
    index: 26,
    file: '0026_whatif_results.sql',
    kind: 'table',
    tableName: 'whatif_results',
    columns: [
      'whatif_id',
      'user_id',
      'type',
      'content',
      'prompt_version',
      'llm_model',
      'cache_key',
      'chart_hash',
      'created_at',
    ],
    checkEnums: [
      { col: 'type', values: ['work', 'love', 'conflict', 'leadership', 'money', 'first_meet'] },
      { col: 'llm_model', values: ['gpt-5o', 'gpt-5', 'gpt-5-mini', 'claude-fallback'] },
    ],
    foreignKeys: [{ col: 'user_id', refs: 'public.users' }],
    rls: { enabled: true, policies: ['whatif_results_own'] },
  },

  // §20260521011419 hapcards daily target_date — KST 날짜별 오늘 케미 캐시
  {
    index: 20260521011419,
    file: '20260521011419_hapcards_target_date.sql',
    kind: 'dml',
    description: 'hapcards.target_date backfill + daily lookup index',
  },

  // §20260521060000 wallet payments — TossPayments V2 pending/confirm RPC
  {
    index: 20260521060000,
    file: '20260521060000_wallet_payments.sql',
    kind: 'function',
    functionName: 'confirm_token_purchase',
  },

  // §20260524090000 hapcard share tokens — public PII-safe share links
  {
    index: 20260524090000,
    file: '20260524090000_hapcard_shares.sql',
    kind: 'table',
    tableName: 'hapcard_shares',
    columns: [
      'share_id',
      'user_id',
      'hapcard_id',
      'relation_id',
      'token_hash',
      'range',
      'channel',
      'title',
      'message_text',
      'created_at',
      'expires_at',
      'completed_at',
      'revoked_at',
    ],
    checkEnums: [
      { col: 'range', values: ['nickname-only', 'nickname-ohaeng', 'nickname-gender'] },
      { col: 'channel', values: ['kakao', 'web_share', 'instagram', 'copy_link'] },
    ],
    foreignKeys: [
      { col: 'user_id', refs: 'public.users' },
      { col: 'hapcard_id', refs: 'public.hapcards' },
      { col: 'relation_id', refs: 'public.relations' },
    ],
    rls: { enabled: true, policies: ['hapcard_shares_own_read'] },
  },
  {
    index: 20260524090001,
    file: '20260524090000_hapcard_shares.sql',
    kind: 'table',
    tableName: 'hapcard_share_rewards',
    columns: [
      'reward_id',
      'user_id',
      'hapcard_id',
      'share_id',
      'channel',
      'ledger_id',
      'reward_date_kst',
      'webhook_resource_id',
      'awarded_at',
    ],
    checkEnums: [{ col: 'channel', values: ['kakao'] }],
    foreignKeys: [
      { col: 'user_id', refs: 'public.users' },
      { col: 'hapcard_id', refs: 'public.hapcards' },
      { col: 'share_id', refs: 'public.hapcard_shares' },
      { col: 'ledger_id', refs: 'public.token_ledger' },
    ],
    rls: { enabled: true, policies: ['hapcard_share_rewards_own_read'] },
  },
  {
    index: 20260524090002,
    file: '20260524090000_hapcard_shares.sql',
    kind: 'function',
    functionName: 'award_hapcard_share_reward',
  },
  {
    index: 20260525090000,
    file: '20260525090000_free_talisman_rewards.sql',
    kind: 'function',
    functionName: 'award_free_talisman_session_rewards',
  },
  {
    index: 20260525110000,
    file: '20260525110000_legal_consents.sql',
    kind: 'table',
    tableName: 'legal_consents',
    columns: [
      'consent_id',
      'auth_user_id',
      'token_hash',
      'flow',
      'provider',
      'terms_version',
      'privacy_version',
      'age_confirmed',
      'consented_at',
      'expires_at',
      'claimed_at',
      'created_at',
      'updated_at',
    ],
    checkEnums: [
      { col: 'flow', values: ['email', 'oauth'] },
      { col: 'provider', values: ['google', 'kakao'] },
    ],
    foreignKeys: [{ col: 'auth_user_id', refs: 'auth.users' }],
    rls: { enabled: true, policies: [] },
  },
  {
    index: 20260526010000,
    file: '20260526010000_guest_legal_consents.sql',
    kind: 'dml',
    description: 'legal_consents guest flow + provider constraint update',
  },
  // ADR-039 Amended: 인연 등록 슬롯 과금 — 현금 결제(비동기) 동안 인연 초안을 스테이징
  {
    index: 20260610000000,
    file: '20260610000000_relation_slot_registration.sql',
    kind: 'table',
    tableName: 'pending_relation_registrations',
    columns: [
      'pending_id',
      'user_id',
      'draft',
      'relation_id',
      'materialized_at',
      'created_at',
    ],
    checkEnums: [],
    foreignKeys: [
      { col: 'user_id', refs: 'public.users' },
      { col: 'relation_id', refs: 'public.relations' },
    ],
    rls: { enabled: true, policies: ['pending_relation_registrations_own'] },
  },
  // 결제 이탈 draft PII 자동 정리 (§1.1 확정 2026-06-10: 30일 삭제 + 7일 스크럽)
  {
    index: 20260610120000,
    file: '20260610120000_pending_draft_purge.sql',
    kind: 'function',
    functionName: 'purge_pending_relation_drafts',
    cronJobs: ['purge-pending-relation-drafts'],
  },
  // relation_slot materialize FK 충돌 수정 — delivered_at 도입 + purge 재작성 (/qa 2026-06-10)
  {
    index: 20260610130000,
    file: '20260610130000_pending_delivered_at.sql',
    kind: 'function',
    functionName: 'purge_pending_relation_drafts',
  },
];
