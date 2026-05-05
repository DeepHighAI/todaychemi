import type { GlossaryKey, GlossaryTerm } from '@/types/glossary';

export type { GlossaryTerm } from '@/types/glossary';

export const GLOSSARY_TERMS: Record<GlossaryKey, GlossaryTerm> = {
  일주: {
    term: '일주',
    reading: '日柱',
    definition:
      '태어난 날의 천간(天干)과 지지(地支)가 합쳐진 기둥으로, 사주에서 자신의 본질을 나타내는 핵심 기둥입니다. 일주는 성격·대인관계·배우자 인연을 읽는 출발점이 됩니다.',
    classic_quote: null,
  },
  십신: {
    term: '십신',
    reading: '十神',
    definition:
      '일간(日干)을 기준으로 다른 천간과의 관계를 10가지 유형으로 분류한 체계입니다. 정관·식신·상관 등 각 십신은 삶의 특정 영역(권위·창의·재물·정서)에 흐르는 에너지를 보여줍니다.',
    classic_quote: {
      source: '연해자평 (淵海子平)',
      original: '比肩多者, 妻財損',
    },
  },
  합: {
    term: '합',
    reading: '合',
    definition:
      '천간합·지지합·삼합 등 두 글자 이상이 결합해 새로운 오행을 이루거나 기운을 합치는 현상입니다. 합이 형성되면 해당 오행의 힘이 배가되며, 두 사람 사이의 친화력과 협력을 가늠하는 근거가 됩니다.',
    classic_quote: {
      source: '삼명통회 (三命通會)',
      original: '三合化局, 力量倍增',
    },
  },
  형: {
    term: '형',
    reading: '刑',
    definition:
      '특정 지지 조합이 서로 불협화음을 일으키는 관계입니다. 형은 갈등·마찰·구속의 긴장 에너지를 나타내며, 관계에서 역할 경계가 불분명할 때 드러나기 쉽습니다.',
    classic_quote: null,
  },
  충: {
    term: '충',
    reading: '沖',
    definition:
      '정반대 지지가 부딪혀 에너지가 격렬하게 충돌하는 현상입니다. 충은 분리·변화의 에너지를 담고 있어 상황의 전환점이 되기도 하며, 해소되지 않으면 불안과 단절로 이어질 수 있습니다.',
    classic_quote: {
      source: '삼명통회 (三命通會)',
      original: '六沖無解, 主分離',
    },
  },
  해: {
    term: '해',
    reading: '害',
    definition:
      '두 지지가 서로 해를 끼쳐 기운을 약화시키는 관계입니다. 충만큼 격렬하지 않으나 은근한 불편함과 오해의 에너지를 나타내며, 지속되면 관계의 피로감으로 쌓입니다.',
    classic_quote: null,
  },
};
