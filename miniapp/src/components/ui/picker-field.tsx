/**
 * picker-field.tsx — 탭하면 휠 트레이를 여는 입력 필드
 *
 * 와이어 ref: UIDesign/interactive.jsx MockInput.
 * 기존 <input type=date/time> 자리에 들어가는 탭 가능한 버튼. 현재 값(또는
 * placeholder) + chevron 을 보여준다. 라벨은 상위 폼이 유지(htmlFor 구조 보존).
 */

interface PickerFieldProps {
  /** 표시 텍스트(빈 문자열이면 placeholder 표시) */
  value: string;
  placeholder: string;
  ariaLabel: string;
  onTap: () => void;
  id?: string;
  /** 트레이 열림 상태 — aria-expanded 로 노출(미지정 시 생략) */
  expanded?: boolean;
}

export function PickerField({ value, placeholder, ariaLabel, onTap, id, expanded }: PickerFieldProps) {
  const filled = value.length > 0;
  return (
    <button
      id={id}
      type="button"
      onClick={onTap}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        borderRadius: 'var(--r-sm)',
        backgroundColor: 'var(--surface-1)',
        border: '1px solid var(--border)',
        padding: '12px 14px',
        fontSize: 15,
        color: filled ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span>{filled ? value : placeholder}</span>
      <span aria-hidden style={{ color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1 }}>
        ›
      </span>
    </button>
  );
}
