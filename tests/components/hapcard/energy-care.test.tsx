// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';

import { HapcardEnergyCare } from '@/components/hapcard/energy-care';
import type { EnergyFood, MeetingVibe } from '@/types/hapcard';

import { renderWithProviders } from '../../utils/render-with-providers';

const FOOD: EnergyFood = {
  element: '수',
  reason: '두 사람 모두 수 기운이 부족한 편이라, 짠맛 나는 음식이 균형을 채워줘요.',
  foods: ['미역국', '굴', '담백한 해산물'],
  copy: '함께 미역국 한 그릇 어때요?',
};

const VIBE: MeetingVibe = {
  element: '수',
  archetype: '물가처럼 잔잔한 분위기',
  copy: '잔잔한 곳에서 만나면 두 사람 기운이 편안하게 어울려요.',
};

describe('HapcardEnergyCare', () => {
  it('음식 copy·음식 목록·명리 근거를 렌더한다 (ADR-015)', () => {
    renderWithProviders(<HapcardEnergyCare energyFood={FOOD} />);
    expect(screen.getByTestId('hapcard-energy-care')).toBeInTheDocument();
    expect(screen.getByText(FOOD.copy)).toBeInTheDocument();
    expect(screen.getByText('미역국')).toBeInTheDocument();
    expect(screen.getByText(FOOD.reason)).toBeInTheDocument();
  });

  it('meeting_vibe 미제공 시 만남 분위기를 렌더하지 않는다', () => {
    renderWithProviders(<HapcardEnergyCare energyFood={FOOD} />);
    expect(screen.queryByText(VIBE.archetype)).not.toBeInTheDocument();
  });

  it('meeting_vibe 제공 시 만남 분위기를 렌더한다 (첫합·썸합)', () => {
    renderWithProviders(<HapcardEnergyCare energyFood={FOOD} meetingVibe={VIBE} />);
    expect(screen.getByText(VIBE.archetype)).toBeInTheDocument();
  });

  it('ADR-038: LLM 문자열의 한자를 convertHanja로 변환해 노출 차단한다', () => {
    renderWithProviders(<HapcardEnergyCare energyFood={{ ...FOOD, copy: '함께 比肩 음식 어때요(安定)' }} />);
    const root = screen.getByTestId('hapcard-energy-care');
    expect(root.textContent ?? '').not.toMatch(/[一-鿿]/u);
  });

  it('energyFood 가 없으면 안내 문구를 보여준다', () => {
    renderWithProviders(<HapcardEnergyCare />);
    expect(screen.getByTestId('hapcard-energy-care')).toBeInTheDocument();
    expect(screen.getByText(/아직 준비되지/)).toBeInTheDocument();
  });
});
