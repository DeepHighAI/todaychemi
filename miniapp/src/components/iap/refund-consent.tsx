/**
 * refund-consent.tsx — 결제 전 청약철회 제한 고지·동의 (전자상거래법 §17)
 *
 * 케미카드·오늘의 나는?·케미 다시 맞추기·인연 슬롯은 "개별 생산·즉시 제공 디지털콘텐츠"라
 * 제공 개시 시 청약철회가 제한된다. 그 제한이 법적으로 유효하려면 결제 전에 별도로
 * 고지하고 회원의 동의를 받아야 한다(전자상거래법 §17 제2항 제5호·제6항).
 *
 * 각 결제 지점(IAP 시트)에서 이 컴포넌트를 결제 버튼 위에 두고, checked 가 true 일 때만
 * 결제 버튼을 활성화한다.
 */

/** 기본 고지 문구 — 생성·열람형 디지털콘텐츠(케미카드·오늘의 나는?·케미 다시 맞추기) */
const DEFAULT_NOTICE =
  '생성·열람 즉시 제공되는 디지털콘텐츠로, 제공이 시작되면 「전자상거래법」상 청약철회가 제한됩니다.';

interface RefundRestrictionConsentProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** 고지 문구 재정의(예: 인연 등록 슬롯). 미지정 시 디지털콘텐츠 기본 문구. */
  notice?: string;
}

export function RefundRestrictionConsent({
  checked,
  onCheckedChange,
  notice = DEFAULT_NOTICE,
}: RefundRestrictionConsentProps) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        cursor: 'pointer',
        textAlign: 'left',
        padding: '8px 0',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        style={{ marginTop: 2, flexShrink: 0, width: 16, height: 16, accentColor: 'var(--primary)' }}
      />
      <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
        {notice}{' '}
        <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
          위 내용을 확인했으며 동의합니다.
        </strong>
      </span>
    </label>
  );
}
