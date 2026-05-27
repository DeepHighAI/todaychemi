# RAG Classics Human Review Packet

> Scope: 고전 20건은 **오늘 우리는**과 **그럴리 없어! 다시**의 근거 인용에 쓰인다. 이 문서는 검수 운영용이며, 실제 명리 검수 결과가 들어오기 전까지 YAML `review_status`는 `approved_ai_pending_human`으로 유지한다.

## Review Rule

검수자는 각 항목을 1~5점으로 평가한다.

| Field | 기준 |
|---|---|
| `source_accuracy` | 원문·출전·장 번호가 맞는가 |
| `translation_accuracy` | 현대어 풀이가 원문 의미를 왜곡하지 않는가 |
| `mingli_fit` | 오늘 우리는/그럴리 없어! 다시의 관계 해석 근거로 쓰기에 적합한가 |
| `beginner_clarity` | 한자·전문 용어를 모르는 사용자에게도 설명 가능한가 |
| `risk_note` | 과장, 단정, 성별 고정관념, 운명론적 표현 위험이 있는가 |

승격 기준은 `source_accuracy`, `translation_accuracy`, `mingli_fit`, `beginner_clarity` 평균이 **3.5 이상**이고 `risk_note`에 P0/P1 차단 사유가 없는 항목이다. 통과한 항목만 `approved_ai_and_crowd`로 승격한다.

## Reviewer Form Columns

아래 컬럼 그대로 Google Form, Sheet, Airtable 중 하나에 만든다.

| Column | Type |
|---|---|
| reviewer_id | Short text |
| asset_id | Dropdown |
| source_accuracy | 1-5 |
| translation_accuracy | 1-5 |
| mingli_fit | 1-5 |
| beginner_clarity | 1-5 |
| risk_level | P0/P1/P2/None |
| reviewer_comment | Long text |
| approved | Yes/No |

## Target Inventory

| asset_id | file | source | chapter | current status |
|---|---|---|---|---|
| `classic_gtbg_001` | `rag_content/classics/gungtong_001.yaml` | 궁통보감 | 月令論·春 | `approved_ai_pending_human` |
| `classic_gtbg_002` | `rag_content/classics/gungtong_002.yaml` | 궁통보감 | 月令論·夏 | `approved_ai_pending_human` |
| `classic_gtbg_003` | `rag_content/classics/gungtong_003.yaml` | 궁통보감 | 月令論·秋 | `approved_ai_pending_human` |
| `classic_gtbg_004` | `rag_content/classics/gungtong_004.yaml` | 궁통보감 | 月令論·冬 | `approved_ai_pending_human` |
| `classic_gtbg_005` | `rag_content/classics/gungtong_005.yaml` | 궁통보감 | 月令論·土 | `approved_ai_pending_human` |
| `classic_jcs_001` | `rag_content/classics/jeokcheonsu_001.yaml` | 적천수 | 通神頌 | `approved_ai_pending_human` |
| `classic_jcs_002` | `rag_content/classics/jeokcheonsu_002.yaml` | 적천수 | 體用 | `approved_ai_pending_human` |
| `classic_jcs_003` | `rag_content/classics/jeokcheonsu_003.yaml` | 적천수 | 體用 | `approved_ai_pending_human` |
| `classic_jcs_004` | `rag_content/classics/jeokcheonsu_004.yaml` | 적천수 | 順逆 | `approved_ai_pending_human` |
| `classic_jcs_005` | `rag_content/classics/jeokcheonsu_005.yaml` | 적천수 | 順逆 | `approved_ai_pending_human` |
| `classic_smth_001` | `rag_content/classics/sammyeong_001.yaml` | 삼명통회 | 神煞論 | `approved_ai_pending_human` |
| `classic_smth_002` | `rag_content/classics/sammyeong_002.yaml` | 삼명통회 | 神煞論 | `approved_ai_pending_human` |
| `classic_smth_003` | `rag_content/classics/sammyeong_003.yaml` | 삼명통회 | 神煞論 | `approved_ai_pending_human` |
| `classic_smth_004` | `rag_content/classics/sammyeong_004.yaml` | 삼명통회 | 合化論 | `approved_ai_pending_human` |
| `classic_smth_005` | `rag_content/classics/sammyeong_005.yaml` | 삼명통회 | 六沖論 | `approved_ai_pending_human` |
| `classic_yhzp_001` | `rag_content/classics/yeonhae_001.yaml` | 연해자평 | 十神論 | `approved_ai_pending_human` |
| `classic_yhzp_002` | `rag_content/classics/yeonhae_002.yaml` | 연해자평 | 十神論 | `approved_ai_pending_human` |
| `classic_yhzp_003` | `rag_content/classics/yeonhae_003.yaml` | 연해자평 | 六親論 | `approved_ai_pending_human` |
| `classic_yhzp_004` | `rag_content/classics/yeonhae_004.yaml` | 연해자평 | 十神論 | `approved_ai_pending_human` |
| `classic_yhzp_005` | `rag_content/classics/yeonhae_005.yaml` | 연해자평 | 六親論 | `approved_ai_pending_human` |

## Result Application

1. 검수 결과 Sheet에서 `approved = Yes`이고 평균 점수 3.5 이상인 `asset_id`만 추린다.
2. 해당 YAML의 `review_status`를 `approved_ai_and_crowd`로 바꾼다.
3. 미달 항목은 원문/번역/태그를 수정한 뒤 다시 검수한다.
4. 반영 후 `pnpm seed:classics`로 Supabase `classics` 테이블을 갱신한다.
5. 검증 쿼리로 `approved_ai_and_crowd` 건수와 미승격 건수를 기록한다.
