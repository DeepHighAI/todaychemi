# RAG 고전 자산 AI 사전검토 (Triage) — 2026-05-27

**This is an AI PRE-REVIEW (triage) only, not a final authority.**

Per **ADR-018** (모트 = 명리 정확성 자산), a human / crowd 명리 review gate is still required
before any asset is promoted to `approved_ai_and_crowd`. This document does **NOT** change any
`review_status` field; all 20 assets remain `approved_ai_pending_human`. The scores below exist
solely to make the human reviewers' pass faster and cheaper by surfacing likely blockers and
misattributions up front.

**Promotion threshold (for reviewers' reference — NOT applied by this AI review):**
first-4-dimension average ≥ 3.5 AND no P0/P1 risk.

**Scope:** 20 assets in `rag_content/classics/`
- 궁통보감 (窮通寶鑑) × 5 — classic_gtbg_001..005
- 적천수 (滴天髓) × 5 — classic_jcs_001..005
- 삼명통회 (三命通會) × 5 — classic_smth_001..005
- 연해자평 (淵海子平) × 5 — classic_yhzp_001..005

These assets are used as citation grounding for relationship-compatibility readings (합카드, 오늘 우리는)
and re-interpretations (그럴리 없어! 다시).

**Research method:** All 20 YAML files read. 4 targeted WebSearch citation checks performed on the
most doubtful attributions (적천수 通神頌 chapter structure, "食神有氣 勝似財官" chapter placement,
"傷官見官 為禍百端" source text, 궁통보감 月令論 chapter label form). No `.yaml` files were edited.

---

## Section 1 — Scoring Table

Dimensions scored 1–5. `avg` covers only the first 4 dimensions (source_accuracy, translation_accuracy,
mingli_fit, beginner_clarity). `risk_level` is separate: **P0** = blocking, **P1** = serious (needs
rewrite), **P2** = minor note, **None** = no flag.

| asset_id | source_acc | trans_acc | mingli_fit | beginner | risk_level | avg(1-4) | ai_comment |
|---|---|---|---|---|---|---|---|
| classic_gtbg_001 | 3 | 4 | 4 | 5 | None | 4.00 | 調候 doctrine authentic; "月令論·春" is a reconstructed label, phrase is a mnemonic not verbatim |
| classic_gtbg_002 | 3 | 4 | 4 | 5 | None | 4.00 | Summer fire/water 調候 sound; same chapter-label caveat as gtbg_001 |
| classic_gtbg_003 | 3 | 4 | 4 | 4 | P2 | 3.75 | 調候 authentic; "단련/진가" framing slightly implies incompleteness — minor note only |
| classic_gtbg_004 | 3 | 4 | 4 | 5 | P2 | 4.00 | Textbook 調候; translation has a raw "Fire(온기·열정)" mixed-script string — ADR-038 hanja/script note |
| classic_gtbg_005 | 3 | 4 | 3 | 4 | None | 3.50 | 土旺得木 authentic; weakest relationship fit of the seasonal set; borderline avg |
| classic_jcs_001 | 3 | 4 | 4 | 4 | None | 3.75 | Concept sound; "通神頌" is NOT a real 적천수 chapter (WebSearch confirmed) — chapter label must be corrected |
| classic_jcs_002 | 3 | 4 | 4 | 4 | None | 3.75 | 財旺비겁護身 fine for 돈합/친구합; "體用" is a recognized 적천수 topic area but exact line is paraphrased |
| classic_jcs_003 | 3 | 4 | 4 | 4 | None | 3.75 | 印重喜財 authentic doctrine; chapter attribution loose, phrase paraphrased |
| classic_jcs_004 | 4 | 4 | 4 | 4 | None | 4.00 | "食神有氣 勝似財官" is a genuine 적천수 line (confirmed); placed in 食神/六親 commentary, not 順逆 — chapter mislabel |
| classic_jcs_005 | 4 | 3 | 3 | 3 | P2 | 3.25 | 從格 content is genuinely in 順逆 — best chapter match of jcs set; loose translation + mild fatalism note |
| classic_smth_001 | 3 | 3 | 3 | 4 | P1 | 3.25 | 天乙貴人 is real 신살 but "凶事化吉" is an absolute good-outcome guarantee — superstitious, de-absolutize before promotion |
| classic_smth_002 | 3 | 3 | 2 | 4 | P1 | 3.00 | 桃花/咸池 신살; translation injects "이성의 인연이 활발" romance-forecast + objectification risk — reframe as personality tendency |
| classic_smth_003 | 3 | 3 | 2 | 4 | P1 | 3.00 | 驛馬逢沖 is individual-fate 신살; "정착 못하는 불안" is fatalistic when applied to couple stability |
| classic_smth_004 | 4 | 4 | 5 | 4 | None | 4.25 | 三合化局 合化論 — best relationship-grounding asset in the full set; clean, highly relevant |
| classic_smth_005 | 4 | 3 | 4 | 4 | P1 | 3.75 | 六沖論 attribution solid; "主分離" → "분리로 이어질 수 있다" is a directional breakup claim — conflicts with ADR-035 spirit |
| classic_yhzp_001 | 3 | 3 | 3 | 3 | P0 | 3.00 | "妻財損" rendered as "배우자 손상" — gender-stereotype (wife-as-possession) + fatalistic harm claim in couple reading; BLOCKING |
| classic_yhzp_002 | 4 | 4 | 4 | 4 | None | 4.00 | 七殺有制大貴 textbook; constructive pressure→achievement framing; clean |
| classic_yhzp_003 | 3 | 4 | 4 | 4 | P2 | 3.75 | "傷官見官 為禍百端" is genuine but likely misattributed: primary source is 적천수 commentary, not 연해자평 六親論 |
| classic_yhzp_004 | 4 | 4 | 4 | 4 | None | 4.00 | 正官端正 君子之風 — authentic; trust/integrity framing excellent for 오래합 |
| classic_yhzp_005 | 4 | 4 | 4 | 4 | None | 4.00 | 偏財好義 慷慨疎財 — authentic; generosity/loyalty positive for 돈합/친구합 |

**Risk tally: P0 = 1 | P1 = 4 | P2 = 3 | None = 12**

---

## Section 2 — High-Risk Priority List

Sorted worst-first. Reviewers should address P0 first, then P1, then below-threshold.

### P0 — Blocking (must not ship as-is)

#### classic_yhzp_001 — `比肩多者, 妻財損`
The classical Chinese "妻財" means "wife (and) wealth." The translation correctly renders "배우자·재물"
(spouse and wealth), but that faithful rendering is precisely the problem: used as relationship grounding,
this asset asserts that having many 비견 in one's chart *damages a spouse*. The framing encodes both
gender-stereotype (妻 = a man's possession/財) and a fatalistic harm claim about a specific relationship.
A user receiving this as a citation in a couple reading could interpret it as "your chart is damaging
your partner." **Human reviewer must either (a) drop the 배우자 framing entirely and keep only the
wealth-competition reading, fully conditionalized, or (b) exclude this asset from relationship grounding
entirely.** The 十神論 attribution is plausible; the problem is not the source but the relational misuse
of 妻財損.

---

### P1 — Serious (needs rewrite before promotion)

#### classic_smth_002 — `桃花咸池, 主多情`
桃花 and 咸池 are real 삼명통회 神煞. The problem is in the translation: "이성의 인연이 활발해진다"
injects a romance-fortune *forecast* that "多情" (emotionally rich / sensual) does not literally imply.
Used on a couple, this reads as telling one partner they are romantically active/promiscuous by fate —
an objectification and determinism risk. Human reviewer should (1) verify 三命通會 神煞論 verbatim source
for this pairing, and (2) reframe the translation as a personality tendency ("감수성이 풍부하고 인간관계가
활발할 수 있다") rather than a relationship forecast or 이성-specific prediction. Also reconsider 첫합/썸합
tagging: this is the primary grounding for under-covered modes, so the rewrite quality matters.

#### classic_smth_003 — `驛馬逢沖, 動而不安`
驛馬 (이동·변화) is a real 삼명통회 신살. The individual-chart reading is fine. The problem is applying
"쉽게 정착하지 못하는 불안이 따른다" to a *couple* — it becomes a near-absolute "this relationship won't
settle." Human reviewer should (1) verify 三命通會 神煞論 verbatim attribution, and (2) either restrict
this asset to individual 오래합 self-awareness framing (not couple-stability predictions) or add strong
conditionality. mingli_fit for relationship grounding is 2 regardless of fix — this asset may be better
suited to individual profile sections than hapcard citations.

#### classic_smth_005 — `六沖無解, 主分離`
The 六沖論 attribution is solid and this is relevant to relationship compatibility. The risk is that
"主分離" (governs separation) rendered as "관계나 환경의 분리로 이어질 수 있다" is still a directional
breakup claim. Per ADR-035, LLM output must not be outcome-deterministic; a citation that says "separation
follows" pushes the LLM toward deterministic conclusions even with the "~수 있다" hedge. Human reviewer
should (1) add a 해소(解消) counter-condition explicitly in the translation ("단, 충을 해소하는 작용이
있을 때는 별개"), and (2) pair with a 合化 or resolution citation. Asset should not be used in isolation
as a 오래합/첫합 breakup-risk anchor.

#### classic_smth_001 — `天乙貴人, 凶事化吉`
天乙貴人 is real 三命通會 神煞. The problem is twofold: (1) "凶事化吉" is framed as an absolute
good-outcome guarantee ("어려운 상황도 의외의 도움으로 순조롭게 풀린다" — "순조롭게 풀린다" is assertive),
and (2) 신살 superstition ("귀인이 도와준다") sits at the edge of what can be responsibly cited in
relationship grounding without implying lucky-charm thinking. Human reviewer should (1) verify 三命通會
verbatim attribution for "天乙貴人, 凶事化吉" as a paired unit, (2) de-absolutize the translation
("도움을 받을 가능성이 높아진다" / "순조롭게 풀릴 가능성이 있다"), and (3) evaluate whether a 신살 asset
without explicit relationship application belongs in the hapcard citation pool at all.

---

### Below-threshold (avg < 3.5, no P0/P1 flag — but still need human attention)

| asset_id | avg | Primary concern |
|---|---|---|
| classic_jcs_005 | 3.25 | 從格 translation loose + mild fatalism; individual-chart concept weakly mapped to couple reading |
| classic_smth_001 | 3.25 | Listed above (P1) |
| classic_smth_002 | 3.00 | Listed above (P1) |
| classic_smth_003 | 3.00 | Listed above (P1) |
| classic_yhzp_001 | 3.00 | Listed above (P0) |

**classic_jcs_005 note:** "從強從弱, 順其勢可" — 從格 follow-strong/follow-weak is genuinely in the
適천수 順逆 section (best chapter match of the jcs set), but the loose translation "거스르지 말고 흐름에
맞춰 나가는 것이 유리하다" reads motivationally deterministic ("just go with the flow"). The mingli_fit
for couple reading is weak (3): 從格 is a chart-structure classification for individuals, and extrapolating
it to a couple dynamic requires a relational framing the current translation lacks. Human reviewer should
tighten the translation and add explicit relationship framing if keeping this in the couple-reading pool.

---

## Section 3 — Likely-Pass List

**AI triage only — human confirmation still required (ADR-018).**

The following 11 assets appear to clear avg ≥ 3.5 with no P0/P1 risk. Human reviewers may fast-track
verification, though the chapter-attribution notes below should still be confirmed:

| asset_id | avg | Notes for fast-track reviewer |
|---|---|---|
| classic_gtbg_001 | 4.00 | Verify 궁통보감 "月令論·春" label is acceptable as a reconstructed chapter designation |
| classic_gtbg_002 | 4.00 | Same chapter-label note as gtbg_001 |
| classic_gtbg_003 | 3.75 | P2 note: "단련" framing — confirm acceptable |
| classic_gtbg_004 | 4.00 | P2 note: raw "Fire(온기·열정)" string — confirm ADR-038 hanja/script handler applied at render |
| classic_gtbg_005 | 3.50 | Borderline avg — confirm relationship framing is adequate |
| classic_jcs_001 | 3.75 | "通神頌" is NOT a real 적천수 chapter — chapter field needs correction before promotion |
| classic_jcs_002 | 3.75 | "體用" is a loose label; paraphrased line — acceptable if noted |
| classic_jcs_003 | 3.75 | Same chapter-label caveat; content authentic |
| classic_jcs_004 | 4.00 | Genuine 적천수 line but placed in 食神/六親 not 順逆 — correct chapter field |
| classic_yhzp_002 | 4.00 | Clean; verify 七殺有制大貴 verbatim in 연해자평 十神論 |
| classic_yhzp_004 | 4.00 | Clean; verify 正官端正 君子之風 verbatim |
| classic_yhzp_005 | 4.00 | Clean; verify 偏財好義 慷慨疎財 verbatim |
| classic_smth_004 | 4.25 | Best asset in the set; 三合化局 合化論 — strong confirm |

Note: classic_yhzp_003 (avg 3.75, P2) is technically above threshold but has a likely source
misattribution; it can be fast-tracked only after the attribution is corrected. classic_smth_005
(avg 3.75, P1) does NOT pass the combined threshold despite high avg.

**Conservative clean-pass count (avg ≥ 3.5, no risk flag at all): 11**
(gtbg_001, gtbg_002, gtbg_004, jcs_001, jcs_002, jcs_003, jcs_004, smth_004, yhzp_002, yhzp_004, yhzp_005)

**With P2 and borderline included (still above threshold): up to 15**
(adds gtbg_003, gtbg_005, jcs_005... wait: jcs_005 avg = 3.25, excluded. Adds yhzp_003 pending fix.)
Revised: 13 assets clear 3.5 avg with no P0/P1 (all above minus jcs_005 and smth_001/002/003/005/yhzp_001).

---

## Section 4 — Per-Asset Detail

For each asset: original_text, dimension-by-dimension reasoning, and risk flag rationale.

---

### classic_gtbg_001
**original_text:** `春木喜火, 發榮之象`
**source (月令論·春):** 궁통보감 is organized by element (論木/論火 etc.) and then by seasonal month.
"月令論·春" is a reconstructed/paraphrase label — the actual sections are headed e.g. "三春甲木 總論."
The 調候 principle (spring wood benefits from fire) is thoroughly authentic to 궁통보감. The 4-char
phrase appears to be a mnemonic condensation, not a verbatim line. Source accuracy: **3**.
**translation_accuracy 4:** "봄에 태어난 木 일간은 火(온기·열정)를 반기니" faithfully renders 春木喜火;
"성장과 번영의 기운" is a fair gloss of 發榮之象.
**mingli_fit 4:** Seasonal warmth/growth maps cleanly to 오래합 (long-term vitality) and 일합
(day-to-day energy balance).
**beginner_clarity 5:** Fully accessible; no unexplained jargon.
**risk None:** Positive, aspirational, non-deterministic.

---

### classic_gtbg_002
**original_text:** `夏火炎上, 喜水潤之`
**source (月令論·夏):** Authentic 調候 (summer fire must be cooled/moistened by water). Same
chapter-label caveat as gtbg_001. Source accuracy: **3**.
**translation_accuracy 4:** "열정이 지나칠수록 차분한 균형이 필요하다" is a slight motivational
paraphrase of 喜水潤之 but is not distorted.
**mingli_fit 4:** Heat/coolness balance reads naturally for 오래합 (sustained equilibrium) and 돈합
(grounded decisiveness vs impulsive spending).
**beginner_clarity 5.**
**risk None.**

---

### classic_gtbg_003
**original_text:** `秋金銳利, 須火煉之`
**source (月令論·秋):** 調候 (autumn metal needs fire to be refined) is textbook 궁통보감. Chapter-label caveat. Source accuracy: **3**.
**translation_accuracy 4:** Faithful. "비로소 진가를 발휘한다" is slightly stronger than 須火煉之 (must be
refined by fire) but not a distortion.
**mingli_fit 4:** Sharp edges softened by warmth is a strong relationship metaphor for 오래합/일합.
**beginner_clarity 4:** "날카롭지만 단련" is accessible but "금 일간" may need a tooltip.
**risk P2:** "비로소 진가를 발휘한다" implies the person is incomplete / only valuable after challenge.
Minor framing concern; not blocking.

---

### classic_gtbg_004
**original_text:** `冬水寒凍, 必以火暖`
**source (月令論·冬):** "겨울에 태어난 水 일간은 반드시 火로 따뜻하게 녹여야 생기가 돈다" — textbook 調候. Source accuracy: **3**.
**translation_accuracy 4:** Faithful. Minor: the translation writes "Fire(온기·열정)" with a capital
Roman-script "Fire" — this mixed-script form could expose a Hanja/script rendering issue under ADR-038's
처리 layer.
**mingli_fit 4:** Warmth/thaw dynamic maps naturally to 오래합 and 썸합 (gradual emotional opening).
**beginner_clarity 5.**
**risk P2:** The raw "Fire(온기·열정)" string should be caught by the ADR-038 `convertHanja()` / display
rendering layer; flag for a technical check (not a content risk per se).

---

### classic_gtbg_005
**original_text:** `土旺四季, 木疏為貴`
**source (月令論·土):** 土旺得木而疏 is genuine 궁통보감 doctrine. Chapter-label caveat. Source accuracy: **3**.
**translation_accuracy 4:** "흐트러진 기운을 소통시켜야 귀하게 쓰인다" is a fair paraphrase.
**mingli_fit 3:** The most abstract of the seasonal five. "포용(土)이 방향성(木)을 만나야 한다" can map to
couple complementarity but requires more interpretive work than other 調候 assets. Weakest relationship
grounding of the gtbg set.
**beginner_clarity 4:** "木이 소통시킨다" is accessible with the gloss provided.
**risk None.**

---

### classic_jcs_001
**original_text:** `官多者身弱, 食傷可用`
**source (通神頌):** The principle (excess 官 exhausts a weak 일간; 食傷 relieves it) is thoroughly
authentic 적천수 체용 logic. However, **"通神頌" is not a chapter of 적천수**. WebSearch confirmed the
적천수 (滴天髓) opens with 天道 and proceeds through 地道, 人道, 知命, 理氣, 配合 etc. "通神頌" may be
confused with 神峰通考's 通神頌 or is being used as an informal label. The substantive content belongs
more in 體用 or 格局 sections. Source accuracy: **3**.
**translation_accuracy 4:** Faithful; "과부하를 풀어 균형을 잡는다" is a clear, modern rendering.
**mingli_fit 4:** Pressure-relief through creative expression maps well to 일합 (work/productivity pairing).
**beginner_clarity 4:** "관성(압박·책임)" and "식신·상관(표현·창의)" are well-glossed.
**risk None.**

---

### classic_jcs_002
**original_text:** `財星太旺, 比劫護身`
**source (體用):** 財旺比劫護身 is an authentic 적천수 조후/格局 principle. "體用" is a recognized topic
area in 적천수. The exact 4-char phrase is a paraphrase. Source accuracy: **3**.
**translation_accuracy 4:** "동류·협력자가 일간을 보호해야 균형이 잡힌다" is faithful and clear.
**mingli_fit 4:** Peer support in the face of resource overload is a natural frame for 돈합 (financial
dynamics) and 친구합 (mutual protection).
**beginner_clarity 4.**
**risk None.**

---

### classic_jcs_003
**original_text:** `印綬重重, 喜見財星`
**source (體用):** 印重喜財 (excess seal benefits from wealth star) is textbook 적천수 體用 doctrine.
Exact phrase is paraphrased. Source accuracy: **3**.
**translation_accuracy 4:** "실용 능력이 살아난다" is a reasonable modern gloss of 喜見財星 in this context.
**mingli_fit 4:** Learning/dependency loosened by real-world challenge maps naturally to 돈합/일합 couple
dynamics.
**beginner_clarity 4:** "인성(학습·보호·의존)" well-glossed.
**risk None.**

---

### classic_jcs_004
**original_text:** `食神有氣, 勝似財官`
**source (順逆):** WebSearch confirmed "食神有氣, 勝似財官" is a **genuine 적천수 line**, not a
paraphrase. However it lives in the 食神 / 六親 commentary section, not in 順逆. The chapter field
should be corrected to 食神 or 六親. Source accuracy: **4** (genuine line, wrong chapter label).
**translation_accuracy 4:** "재성·관성보다 더 큰 삶의 풍요와 안정을 이끌 수 있다" is a faithful, slightly
expansive rendering.
**mingli_fit 4:** Creative expression surpassing material/authority pursuits maps well to 오래합/일합.
**beginner_clarity 4:** "식신(창의·표현)" well-glossed.
**risk None.**

---

### classic_jcs_005
**original_text:** `從強從弱, 順其勢可`
**source (順逆):** 從格 follow-strong/follow-weak is genuinely in the 적천수 順逆 section — this is the
best chapter match of the entire jcs set. Source accuracy: **4**.
**translation_accuracy 3:** "거스르지 말고 그 흐름에 맞춰 나가는 것이 유리하다" is a loose, motivational
rendering. 從格 is a specific chart-structure classification (the chart has no useful opposition to the
dominant qi), not a general "go with the flow" life philosophy. The translation elides the technical
specificity.
**mingli_fit 3:** 從格 is an individual chart structure; mapping it to couple dynamics requires a
relational frame this translation lacks. "두 사람의 흐름이 같은 방향일 때" framing would improve fit.
**beginner_clarity 3:** "세력이 한쪽으로 쏠릴 때" is somewhat abstract without more context.
**risk P2:** "거스르지 말라" can be read as mild fatalism (surrender to forces). Note only; not blocking.

---

### classic_smth_001
**original_text:** `天乙貴人, 凶事化吉`
**source (神煞論):** 天乙貴人 is a real and prominent 신살 in 三命通會 神煞論. The pairing "凶事化吉" as
a 4-char unit needs verbatim verification; "흉사화길" is a common formula associated with 貴人 mythology.
Source accuracy: **3**.
**translation_accuracy 3:** "어려운 상황도 의외의 도움으로 순조롭게 풀린다" over-commits: "순조롭게 풀린다"
asserts a guaranteed resolution, which amplifies the absolute claim in 化吉.
**mingli_fit 3:** 귀인·보호자 luck is individual-fate 신살; its connection to *couple* compatibility is
indirect (does one partner act as the other's 귀인?). The relationship application requires more bridging
than the current translation provides.
**beginner_clarity 4:** Accessible translation.
**risk P1:** Two problems: (1) superstitious absolute good-outcome guarantee ("흉사화길" → "순조롭게
풀린다"), and (2) 신살 fortune-telling without conditionality. Human reviewer should de-absolutize
("도움을 받을 가능성이 있다"), add conditionality, and evaluate whether 귀인 신살 belongs in the hapcard
citation pool without explicit relational framing.

---

### classic_smth_002
**original_text:** `桃花咸池, 主多情`
**source (神煞論):** 桃花 and 咸池 are both recognized 신살 in 三命通會 神煞論. Their pairing is
documented. Source accuracy: **3**.
**translation_accuracy 3:** "감정이 풍부하고 인간관계에서 이성의 인연이 활발해진다" adds a romance-forecast
("이성의 인연이 활발") that "主多情" (= emotionally rich / sensual / multi-feeling) does not literally
entail. This is an added interpretation, not a distortion per se, but it points the meaning toward
romantic-partner prediction.
**mingli_fit 2:** As couple grounding, this reads as fortune-telling about one partner's romantic
activity — potential to objectify or imply promiscuity. Even as 첫합/썸합 content, predicting "you will
attract many people" in the context of a specific relationship reading is inappropriate.
**beginner_clarity 4:** Clear Korean.
**risk P1:** (1) Romantic-forecast determinism from 신살. (2) "이성의 인연이 활발" in a *couple* reading
context risks implying the person naturally attracts others outside the relationship — objectification
and relationship-harm risk. Reframe entirely as a character tendency ("감수성과 매력이 풍부할 수 있다")
with no romance-forecast, and remove "이성의 인연" framing.

---

### classic_smth_003
**original_text:** `驛馬逢沖, 動而不安`
**source (神煞論):** 驛馬 (travel/movement star) encountering 沖 (clash) is documented 신살 doctrine.
Exact 4-char phrase needs verbatim check. Source accuracy: **3**.
**translation_accuracy 3:** "쉽게 정착하지 못하는 불안이 따른다" faithfully renders "動而不安" but
asserts a certainty ("따른다") that makes the claim stronger than "may tend toward instability."
**mingli_fit 2:** 역마 is individual-fate (travel/career/mobility). When used in a couple reading, "정착
못하는 불안" becomes a prediction about whether the *relationship* will be stable — a harmful application.
**beginner_clarity 4:** Accessible.
**risk P1:** "정착하지 못하는 불안이 따른다" in a couple context is a near-absolute "this relationship
won't settle" claim. Even framed individually, using this as a hapcard citation implies to users that
a partner's chart means they cannot commit. Restrict to individual self-awareness use or strongly
conditionalize ("이동과 변화 에너지가 강해 안정보다 모험을 선호할 수 있다") before allowing in
relationship grounding.

---

### classic_smth_004
**original_text:** `三合化局, 力量倍增`
**source (合化論):** 三合化局 is core 合化論 material — three 地支 combining into a transformed element
bureau. The chapter match is solid (合化論 is exactly where 三合化局 belongs). Source accuracy: **4**.
**translation_accuracy 4:** "각각의 기운이 하나로 합쳐져 힘이 크게 증폭된다" faithfully renders 力量倍增.
**mingli_fit 5:** This is the **best relationship-grounding asset in the entire set.** 三合化局 maps
directly to the 합(合) concept at the core of the product (오늘사이 / 합카드). Synergy amplification
through combining energies is an ideal citation anchor for compatibility readings.
**beginner_clarity 4:** "세 지지가 삼합으로 합을 이루면" is clear enough with minor glossing.
**risk None.** Positive, constructive, directly relevant.

---

### classic_smth_005
**original_text:** `六沖無解, 主分離`
**source (六沖論):** 六沖論 is the correct chapter for six-clash (六沖) content. "主分離" as a 六沖 outcome
is consistent with the classic. Source accuracy: **4**.
**translation_accuracy 3:** "관계나 환경의 분리로 이어질 수 있다" is a soft hedge ("~수 있다") but the
framing is still directional. The original 無解 (no resolution) condition is partially preserved but
the translation could make the conditionality clearer.
**mingli_fit 4:** 六沖 is directly relevant to relationship dynamics (tension, incompatibility assessment).
High relevance is exactly what makes the P1 risk matter most here.
**beginner_clarity 4.**
**risk P1:** "主分離" → "분리로 이어질 수 있다" — even with the hedge, this is a breakup-direction claim
used in relationship citation. Per ADR-035, the LLM must not drive deterministic outcomes; a grounding
citation that says "separation follows unresolved clash" primes the LLM toward fatalistic conclusions.
Human reviewer must: (1) add explicit 해소 conditionality ("육충을 해소하는 합(合)이나 시간 변화가 있으면
별개"), (2) pair with a 合化 or complementary citation in the same card, and (3) review whether this
can be framed as a warning/awareness rather than a prediction.

---

### classic_yhzp_001
**original_text:** `比肩多者, 妻財損`
**source (十神論):** 比肩損財 is authentic 십신론 doctrine — 比肩 (peer/competition) competes with 財星
(wealth star). The "妻" in 妻財 reflects classical gendered framing (wife = the male 일간's 財). The
章 attribution (연해자평 十神論) is plausible. Source accuracy: **3**.
**translation_accuracy 3:** The translation "재성(배우자·재물)이 분산·손상되기 쉽다" is *literally
faithful* — and that literal faithfulness is the problem. "배우자" keeps the classical 妻 coding intact.
**mingli_fit 3:** In isolation, this could apply to 친구합 (peer competition depleting resources) or
돈합. But the "배우자" embedding makes it toxic for any reading that involves a partner.
**beginner_clarity 3:** "비견(동료·경쟁자)" is well-glossed; "재성(배우자·재물)" conflating spouse and
wealth is the harm vector.
**risk P0 — BLOCKING:** Two compounding problems:
(1) **Gender stereotype:** 妻財 encodes wife as financial possession (女=財), a classical framing that
must not be propagated in a modern Korean relationship app. Keeping "배우자" in the translation
re-activates this stereotype for any user who receives this as a citation about their couple.
(2) **Fatalistic harm claim:** "배우자가 손상되기 쉽다" asserts a person's chart damages their spouse —
a direct relational harm statement. This is exactly the kind of absolute/deterministic claim about a
specific person that the product's design explicitly avoids (ADR-002, ADR-035).
**Required action before any promotion:** Either (a) rewrite to wealth-only framing ("재물·공유 자원이
분산될 수 있다") with full conditionality and no spouse reference, OR (b) exclude this asset from
relationship grounding entirely and reassign to individual 십신 profile content only.

---

### classic_yhzp_002
**original_text:** `七殺有制, 大貴之命`
**source (十神論):** 七殺有制爲貴 is one of the most canonical 십신 doctrines across all major classics.
The 연해자평 十神論 attribution is appropriate. Source accuracy: **4**.
**translation_accuracy 4:** "그 압박은 오히려 큰 성취를 이끄는 동력이 된다" is a constructive, faithful
rendering of 大貴 driven by controlled 七殺.
**mingli_fit 4:** Pressure-transformed-into-achievement maps naturally to couple dynamics where challenge
(편관-heavy partner) drives growth — good for 일합/오래합.
**beginner_clarity 4:** "편관(칠살, 강한 압박·도전)" is well-glossed.
**risk None.** Constructive, non-deterministic.

---

### classic_yhzp_003
**original_text:** `傷官見官, 為禍百端`
**source (六親論):** WebSearch found "傷官見官, 為禍百端" primarily in 적천수 (滴天髓) commentary by
任鐵樵 and associated 格局 discussions — it is a famous classical formula but its canonical home is the
적천수 傷官 chapter or 格局 section, NOT 연해자평 六親論. 연해자평 certainly discusses 傷官/正官 tension,
but attributing this specific phrase there needs verification by a human expert. Source accuracy: **3**
(content plausible in context; exact attribution likely wrong).
**translation_accuracy 4:** "다양한 갈등과 마찰이 반복해서 일어날 수 있다" is faithful and appropriately
hedges "為禍百端" (a hundred disasters) without literal exaggeration.
**mingli_fit 4:** 上官(자기표현) vs 正官(규칙·권위) tension dynamic is a real relationship compatibility
axis — relevant to 썸합 (attraction vs constraint) and 일합 (workplace dynamics).
**beginner_clarity 4:** "상관(자기표현·반항)과 정관(규칙·권위)이 충돌하면" is clear.
**risk P2:** "為禍百端" (hundred disasters) is hyperbolic; the translation de-escalates it appropriately
("반복해서 일어날 수 있다"). Main action item is source attribution correction, not content rewrite.

---

### classic_yhzp_004
**original_text:** `正官端正, 君子之風`
**source (十神論):** 正官 = principled / 君子 character is canonical 십신론 doctrine. 연해자평 十神論 attribution appropriate. Source accuracy: **4**.
**translation_accuracy 4:** "신의 있고 원칙적인 품성이 자연스럽게 드러난다" is faithful.
**mingli_fit 4:** Trust, principle, and steady character are strong 오래합 (long-term compatibility) and
일합 (work ethic pairing) anchors.
**beginner_clarity 4:** "정관(책임·규범)" well-glossed.
**risk None.** Clean, constructive.

---

### classic_yhzp_005
**original_text:** `偏財好義, 慷慨疎財`
**source (六親論):** 偏財 characterized by generosity and义 (义리) is authentic 십신 doctrine.
연해자평 六親論 attribution is plausible. Source accuracy: **4**.
**translation_accuracy 4:** "의리를 중히 여기고 재물을 아낌없이 나누는 성향이 있다" is faithful.
"임기응변" for 偏財 is a reasonable characterization.
**mingli_fit 4:** Generosity / loyalty over money dynamic is a natural fit for 돈합 (financial-values
compatibility) and 친구합 (loyalty as a friendship anchor).
**beginner_clarity 4:** "편재(현실 감각·임기응변)" is reasonably glossed.
**risk None.** Positive, non-deterministic.

---

## Section 5 — Mode-Coverage Tally

Counting `topic_tags` mode tags across all 20 assets (one asset may carry multiple mode tags):

| Mode | Count | Asset IDs |
|---|---|---|
| 오래합 | 11 | gtbg_001, gtbg_002, gtbg_003, gtbg_004, gtbg_005, jcs_004, jcs_005, smth_001, smth_003, smth_004, smth_005, yhzp_002, yhzp_004 |
| 일합 | 8 | gtbg_001, gtbg_003, jcs_001, jcs_003, jcs_004, yhzp_002, yhzp_003, yhzp_004 |
| 돈합 | 6 | gtbg_002, gtbg_005, jcs_002, jcs_003, yhzp_001, yhzp_005 |
| 친구합 | 5 | jcs_002, smth_001, yhzp_001, yhzp_003 (approx; note yhzp_005 tagged 돈합+친구합) |
| 첫합 | 4 | smth_002, smth_003, smth_004, smth_005 |
| 썸합 | 3 | gtbg_004, smth_002, yhzp_003 |

**Imbalance confirmed — matches the known gap documented in `docs/specs/`:**
- 오래합 and 일합 are heavily over-covered (11 and 8 tags respectively).
- 썸합 (3), 첫합 (4), 친구합 (~5) are significantly under-covered.

**Critical compounding problem:** Much of the 첫합/썸합 coverage comes from the *high-risk* 神煞 assets
(smth_002, smth_003) and a borderline (smth_005 with P1). smth_004 (三合化局) is the only clean
first-attraction/long-term synergy anchor in that mode group. This means:

> The modes with the fewest grounding citations are also grounded by the *lowest-quality* and
> *highest-risk* assets in the collection.

**Recommended human reviewer action:** Prioritize sourcing 2–3 clean, relationship-positive 첫합/썸합
grounding citations to replace or supplement the risky 神煞 fillers. Strong candidates from the
classical canon:
- 合化論: 天干合 (甲己合化土 etc.) — two different energies drawn together by natural affinity
- 六親論: 夫星 / 妻星 relevant passages reframed as mutual-recognition, not fate
- 적천수 or 연해자평 passages on 情 (감정·인연) that are aspirational, not predictive

---

*Report generated by Claude Sonnet 4.6 AI pre-review, 2026-05-27.*
*No YAML files were modified. No `review_status` fields were changed.*
*Human 명리 review gate (ADR-018) remains required for any status promotion.*
