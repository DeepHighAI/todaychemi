// 12지 (지지 Earthly Branches)
export const BRANCH_READINGS: Record<string, string> = {
  '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진',
  '巳': '사', '午': '오', '未': '미', '申': '신', '酉': '유',
  '戌': '술', '亥': '해',
};

// 10간 (천간 Heavenly Stems)
export const STEM_READINGS: Record<string, string> = {
  '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무',
  '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계',
};

// 오행 (Five Elements)
export const ELEMENT_READINGS: Record<string, string> = {
  '木': '목', '火': '화', '土': '토', '金': '금', '水': '수',
};

// 관계자 및 동사
export const RELATION_READINGS: Record<string, string> = {
  '合': '합', '刑': '형', '沖': '충', '害': '해',
  '生': '생', '剋': '극', '殺': '살', '柱': '주', '局': '국',
  '破': '파', '半': '반',
};

// 십신 (Ten Gods)
export const SIPSIN_READINGS: Record<string, string> = {
  '正印': '정인', '正財': '정재', '偏財': '편재', '食神': '식신',
  '傷官': '상관', '比肩': '비견', '比劫': '비겁', '七殺': '칠살',
  '正官': '정관', '偏印': '편인',
};

// 신살 (Special Stars) — multi-char, must be matched before single chars
export const SHINSAL_READINGS: Record<string, string> = {
  '桃花殺': '도화살', '桃花': '도화',
  '紅艶殺': '홍염살', '紅艶': '홍염',
  '月德貴人': '월덕귀인',
  '天乙貴人': '천을귀인',
};

// 고전 chapter 이름 (verbatim RAG chapter names → Korean)
export const CHAPTER_READINGS: Record<string, string> = {
  '通神頌': '통신송',
  '體用': '체용',
  '十神論': '십신론',
  '月令論·春': '월령론·춘',
  '神煞論': '신살론',
  '三命通會': '삼명통회',
  '子平眞詮': '자평진전',
  '滴天髓': '적천수',
  '淵海子平': '연해자평',
  '命理探源': '명리탐원',
  '窮通寶鑑': '궁통보감',
  '神峰通考': '신봉통고',
};

// 기타 명리 용어 (multi-char compound Hanja — match before single chars)
export const COMPOUND_READINGS: Record<string, string> = {
  '日主': '일주', '日柱': '일주', '月柱': '월주', '年柱': '연주', '時柱': '시주',
  '日干': '일간', '月干': '월간', '年干': '연간', '時干': '시간',
  '子午沖': '자오충', '丑未沖': '축미충', '寅申沖': '인신충',
  '卯酉沖': '묘유충', '辰戌沖': '진술충', '巳亥沖': '사해충',
  '寅午戌': '인오술', '申子辰': '신자진', '巳酉丑': '사유축', '亥卯未': '해묘미',
  '甲己': '갑기', '乙庚': '을경', '丙辛': '병신', '丁壬': '정임', '戊癸': '무계',
  '財庫': '재고', '入墓': '입묘', '三合': '삼합', '半合': '반합',
  '合化': '합화', '天干合': '천간합',
  '水剋火': '수극화', '土剋水': '토극수', '火剋金': '화극금',
  '金剋木': '금극목', '木剋土': '목극토',
  '水克火': '수극화', '土克水': '토극수', '火克金': '화극금',
  '金克木': '금극목', '木克土': '목극토',
  '金生水': '금생수', '水生木': '수생목', '木生火': '목생화',
  '火生土': '화생토', '土生金': '토생금',
};

// 통합 단일 문자 매핑 (lookup priority: COMPOUND > SIPSIN > SHINSAL > single chars)
export const SINGLE_CHAR_READINGS: Record<string, string> = {
  ...BRANCH_READINGS,
  ...STEM_READINGS,
  ...ELEMENT_READINGS,
  ...RELATION_READINGS,
};
