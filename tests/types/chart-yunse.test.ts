import { describe, it, expect } from 'vitest';
import type { YunseCore, YunseDaeun, YunseSeyun, YunseWolun, YunseIliun } from '@/types/chart';

// YunseCore 타입 계약 검증 — 컴파일 에러가 RED, 통과가 GREEN

const mockDaeun: YunseDaeun = {
  start_age: 7,
  list: [{ age: 7, pillar: '갑자', year: 1990 }],
  current_index: 0,
};

const mockSeyun: YunseSeyun = {
  current_pillar: '병오',
  current_year: 2026,
};

const mockWolun: YunseWolun = {
  current_pillar: '계사',
  current_month: '2026-05',
};

const mockIliun: YunseIliun = {
  today_pillar: '갑자',
  today_date: '2026-05-07',
};

const mockYunse: YunseCore = {
  daeun: mockDaeun,
  seyun: mockSeyun,
  wolun: mockWolun,
  iliun: mockIliun,
};

describe('YunseCore 타입 계약', () => {
  it('YunseDaeun has start_age, list, current_index', () => {
    expect(mockDaeun.start_age).toBe(7);
    expect(mockDaeun.list).toHaveLength(1);
    expect(mockDaeun.list[0].pillar).toBe('갑자');
    expect(mockDaeun.list[0].year).toBe(1990);
    expect(mockDaeun.current_index).toBe(0);
  });

  it('YunseSeyun has current_pillar, current_year', () => {
    expect(mockSeyun.current_pillar).toBe('병오');
    expect(mockSeyun.current_year).toBe(2026);
  });

  it('YunseWolun has current_pillar, current_month (YYYY-MM)', () => {
    expect(mockWolun.current_pillar).toBe('계사');
    expect(mockWolun.current_month).toMatch(/^\d{4}-\d{2}$/);
  });

  it('YunseIliun has today_pillar, today_date (YYYY-MM-DD)', () => {
    expect(mockIliun.today_pillar).toBe('갑자');
    expect(mockIliun.today_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('YunseCore composes all four sub-types', () => {
    expect(mockYunse.daeun).toBe(mockDaeun);
    expect(mockYunse.seyun).toBe(mockSeyun);
    expect(mockYunse.wolun).toBe(mockWolun);
    expect(mockYunse.iliun).toBe(mockIliun);
  });
});
