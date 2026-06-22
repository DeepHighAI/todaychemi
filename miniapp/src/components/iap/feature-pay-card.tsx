/**
 * feature-pay-card.tsx — 공용 결제 안내 카드 (Phase 6 페이월 드리프트 통합)
 *
 * 케미카드·또 다른 나·케미 다시 맞추기·인연 슬롯의 네 페이월이 각자 제목/금액/
 * 청약철회 동의/결제·닫기 버튼을 손수 그려 결제 버튼 라벨("₩X 결제하기"·"결제 중…"),
 * 오류 문구, "동의 전 결제 버튼 비활성" 게이트(전자상거래법 §17)가 네 곳에 중복돼 있었다.
 *
 * 이 컴포넌트는 그 표현 계층만 단일화한다 — **결제 제어흐름·머니패스는 호스트가 그대로 소유**:
 *   - 동의 상태(consentChecked)·결제/닫기 핸들러(onPay/onClose)·payInfo 게이트(payDisabled)는
 *     모두 호스트가 controlled prop 으로 주입한다.
 *   - 이 컴포넌트는 결제도 IAP 호출도 하지 않는다(ADR-039 원자성·금액·SKU 무변경).
 *
 * 단일화의 핵심 가치: "동의해야 결제 버튼 활성" 게이트가 네 곳에서 한 곳으로 모인다.
 */

import { RefundRestrictionConsent } from '@/components/iap/refund-consent';
import { Button } from '@/components/ui/button';

/** 컨테이너 배경 톤 — 호스트별 맥락 보존(인연 슬롯은 추가 비용을 알리는 warn 톤). */
export type FeaturePayTone = 'primary' | 'card' | 'warn';

const TONE_BG: Record<FeaturePayTone, string> = {
  primary: 'color-mix(in srgb, var(--primary) 8%, transparent)',
  card: 'var(--bg-card)',
  warn: 'var(--warn-bg, #fff8e1)',
};

/** 결제 중 발생한 오류 안내 — 네 페이월 공통 문구. */
const PAY_ERROR_TEXT = '결제 중 오류가 발생했어요. 다시 시도해 주세요.';

interface FeaturePayCardProps {
  /** 결제 안내 제목 (feature별 문구) */
  title: string;
  /** 부가 설명 (선택) */
  description?: string;
  /** 결제 금액(원) — 결제 버튼 라벨 `₩{amount} 결제하기` */
  amountKrw: number;
  /** 청약철회 동의 상태 (controlled — 호스트 소유) */
  consentChecked: boolean;
  onConsentChange: (checked: boolean) => void;
  /** 청약철회 고지 문구 재정의(예: 인연 슬롯). 미지정 시 디지털콘텐츠 기본 문구. */
  consentNotice?: string;
  /** 결제 진행 중 — 버튼 비활성 + "결제 중…" 라벨 */
  isPurchasing: boolean;
  /** 결제 오류 발생 — 안내 문구 표시 */
  hasError?: boolean;
  /** 결제 오류 문구 재정의(예: SKU 미설정 출시 가드). */
  errorMessage?: string;
  /** 결제 버튼 추가 비활성 조건(예: payInfo 부재). 기본 false */
  payDisabled?: boolean;
  /** 결제 시작 — 호스트가 IAP 시트를 연다 */
  onPay: () => void;
  /** 닫기 — 호스트가 페이월을 닫는다(payDismissed 등) */
  onClose: () => void;
  /** 닫기 버튼 라벨. 기본 '닫기' */
  closeLabel?: string;
  /** 컨테이너 톤. 기본 'primary' */
  tone?: FeaturePayTone;
  /** 루트 data-testid (회귀 테스트용) */
  testId?: string;
}

export function FeaturePayCard({
  title,
  description,
  amountKrw,
  consentChecked,
  onConsentChange,
  consentNotice,
  isPurchasing,
  hasError = false,
  errorMessage,
  payDisabled = false,
  onPay,
  onClose,
  closeLabel = '닫기',
  tone = 'primary',
  testId,
}: FeaturePayCardProps) {
  const priceLabel = `₩${amountKrw.toLocaleString()}`;
  return (
    <div
      data-testid={testId}
      style={{
        borderRadius: 'var(--r-lg)',
        backgroundColor: TONE_BG[tone],
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <p style={{ font: 'var(--t-h3)', color: 'var(--text-primary)', margin: 0 }}>{title}</p>
      {description && (
        <p style={{ font: 'var(--t-sub)', color: 'var(--text-secondary)', margin: 0 }}>{description}</p>
      )}
      {hasError && (
        <p style={{ font: 'var(--t-cap)', color: 'var(--destructive)', margin: 0 }}>{errorMessage ?? PAY_ERROR_TEXT}</p>
      )}
      <RefundRestrictionConsent
        checked={consentChecked}
        onCheckedChange={onConsentChange}
        notice={consentNotice}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button
          type="button"
          size="cta"
          className="btn-cta"
          disabled={isPurchasing || !consentChecked || payDisabled}
          onClick={onPay}
        >
          {isPurchasing ? '결제 중…' : `${priceLabel} 결제하기`}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} style={{ width: '100%' }}>
          {closeLabel}
        </Button>
      </div>
    </div>
  );
}
